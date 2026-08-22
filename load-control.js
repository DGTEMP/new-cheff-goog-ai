'use strict';
/* ═══════════════════════════════════════════════════════════════════════
 * LOAD CONTROL — Chave de Controle de Carga (Super Admin)
 *
 * Modos operacionais:
 *   normal     → tudo ligado (pushes, broadcasts completos)
 *   evento     → aceita pedidos direto; modo leve (sem push, broadcasts mínimos)
 *   spool      → pedidos novos gravados em fila durável (pedidos_spool) e
 *                processados em background com retry (nenhum pedido perdido)
 *   manutencao → bloqueia novos pedidos com mensagem clara ao operador
 *
 * Circuit breaker automático (opcional): monitora o lag do event loop e o
 * RSS do processo; se ultrapassarem os limites por tempo sustentado, desce
 * temporariamente para 'spool' e restaura o modo base quando recuperar.
 *
 * A fila é durável por tenant (tabela pedidos_spool no banco de cada
 * restaurante) e é reprocessada no boot caso o servidor caia.
 * ═══════════════════════════════════════════════════════════════════════ */

const MODOS = ['normal', 'evento', 'spool', 'manutencao'];
const CONFIG_KEY = 'load_control';
const SPOOL_MAX_TENTATIVAS = 5;
const WORKER_INTERVAL_MS = 600;
const MONITOR_INTERVAL_MS = 500;
const METRICS_WINDOW_MS = 60000;

const DEFAULTS = {
  baseMode: 'normal',
  autoEnabled: false,
  lagThresholdMs: 1500,
  sustainedMs: 10000,
  recoveryLagMs: 300,
  recoverySustainedMs: 30000,
  maxRssMB: 0,
  spikeThreshold: 30,        // pedidos/min por tenant que caracteriza alta demanda
  spikeCooldownMin: 45       // intervalo mínimo entre celebrações por tenant
};

function createLoadControl({ masterDb }) {
  const state = Object.assign({}, DEFAULTS, {
    mode: 'normal',      // modo efetivo
    autoActive: false,   // true quando o breaker derrubou p/ spool automaticamente
    startedAt: Date.now(),
    updatedAt: null
  });

  /* ── Métricas (janela deslizante) ─────────────────────────────────── */
  let events = [];
  function record(type) {
    const now = Date.now();
    events.push([now, type]);
  }
  function pruneEvents() {
    const cutoff = Date.now() - 2 * METRICS_WINDOW_MS;
    if (events.length > 4000 || (events.length && events[0][0] < cutoff)) {
      events = events.filter(e => e[0] >= cutoff);
    }
  }
  function countType(type) {
    const cutoff = Date.now() - METRICS_WINDOW_MS;
    let n = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i][0] < cutoff) break;
      if (events[i][1] === type) n++;
    }
    return n;
  }

  /* ── Demanda por tenant (janela 60s) + celebração de pico ─────────── */
  const _tenantWindow = new Map(); // tid -> [timestamps]
  const _spikeState = new Map();   // tid -> { acima, ultimaCelebracao }

  function recordTenantOrder(tid) {
    if (!tid) return;
    const now = Date.now();
    let arr = _tenantWindow.get(tid);
    if (!arr) { arr = []; _tenantWindow.set(tid, arr); }
    arr.push(now);
    if (arr.length > 400) arr.splice(0, arr.length - 200);
  }

  function getTenantOrdersPerMin(tid) {
    const arr = _tenantWindow.get(tid);
    if (!arr || !arr.length) return 0;
    const cutoff = Date.now() - METRICS_WINDOW_MS;
    while (arr.length && arr[0] < cutoff) arr.shift();
    return arr.length;
  }

  /**
   * Detecta cruzamento do limiar de alta demanda de um tenant.
   * Dispara no máximo uma vez por janela de cooldown (edge-trigger).
   * Retorna null ou { pedidos_por_minuto, limite }.
   */
  function checkSpike(tid) {
    const ppm = getTenantOrdersPerMin(tid);
    let st = _spikeState.get(tid);
    if (!st) { st = { acima: false, ultimaCelebracao: 0 }; _spikeState.set(tid, st); }
    const acima = ppm >= state.spikeThreshold;
    if (!acima) { st.acima = false; return null; }
    if (st.acima) return null; // já avisado neste episódio
    const cooldownMs = (state.spikeCooldownMin || 45) * 60000;
    if (Date.now() - st.ultimaCelebracao < cooldownMs) return null;
    st.acima = true;
    st.ultimaCelebracao = Date.now();
    return { pedidos_por_minuto: ppm, limite: state.spikeThreshold };
  }

  /* ── Overrides por tenant (balanceamento fino pelo super admin) ───── */
  const OVERRIDES_KEY = 'load_control_tenant_overrides';
  const _overrides = new Map(); // tid -> 'normal' | 'evento' | 'spool'

  function loadOverrides(cb) {
    masterDb.get(`SELECT valor FROM configuracoes_global WHERE chave = ?`, [OVERRIDES_KEY], (err, row) => {
      if (!err && row && row.valor) {
        try {
          const obj = JSON.parse(row.valor);
          Object.keys(obj).forEach(k => { if (MODOS.includes(obj[k]) && obj[k] !== 'manutencao') _overrides.set(parseInt(k, 10), obj[k]); });
        } catch (e) { }
      }
      if (cb) cb();
    });
  }

  function saveOverrides(cb) {
    const obj = {};
    _overrides.forEach((modo, tid) => { obj[tid] = modo; });
    masterDb.run(
      `INSERT INTO configuracoes_global (chave, valor) VALUES (?, ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
      [OVERRIDES_KEY, JSON.stringify(obj)],
      () => { if (cb) cb(); }
    );
  }

  function setTenantOverride(tid, modo, cb) {
    tid = parseInt(tid, 10);
    if (!tid || tid <= 0) return cb(new Error('Restaurante inválido.'));
    if (modo !== null && !['normal', 'evento', 'spool'].includes(modo)) return cb(new Error('Modo inválido para tenant.'));
    if (modo === null) _overrides.delete(tid); else _overrides.set(tid, modo);
    saveOverrides(cb);
  }

  function getModoEfetivoTenant(tid) {
    return _overrides.get(parseInt(tid, 10)) || state.mode;
  }

  /* ── Monitor do event loop / RSS ──────────────────────────────────── */
  let currentLag = 0;
  let maxLagRecent = 0;
  let _expectedTick = Date.now() + MONITOR_INTERVAL_MS;
  let _overMs = 0;
  let _underMs = 0;
  let _monitorTimer = null;

  function monitorTick() {
    const now = Date.now();
    const lag = now - _expectedTick;
    _expectedTick = now + MONITOR_INTERVAL_MS;
    currentLag = Math.max(0, lag);
    if (currentLag > maxLagRecent) maxLagRecent = currentLag;
    pruneEvents();

    if (!state.autoEnabled) return;
    const baseElegivel = state.baseMode === 'normal' || state.baseMode === 'evento';

    if (!state.autoActive && baseElegivel) {
      let over = currentLag >= state.lagThresholdMs;
      let rssMb = 0;
      try { rssMb = process.memoryUsage().rss / (1024 * 1024); } catch (e) { }
      if (state.maxRssMB > 0 && rssMb >= state.maxRssMB) over = true;
      if (over) {
        _overMs += MONITOR_INTERVAL_MS;
        if (_overMs >= state.sustainedMs) engajarAuto('sobrecarga detectada');
      } else {
        _overMs = Math.max(0, _overMs - MONITOR_INTERVAL_MS);
      }
    }

    if (state.autoActive) {
      if (currentLag <= state.recoveryLagMs) {
        _underMs += MONITOR_INTERVAL_MS;
        if (_underMs >= state.recoverySustainedMs) restaurarBase();
      } else {
        _underMs = 0;
      }
    }
  }

  function engajarAuto(motivo) {
    state.autoActive = true;
    state.mode = 'spool';
    _overMs = 0; _underMs = 0;
    console.warn(`[Load Control] Circuit breaker ATIVO (${motivo}): pedidos entram em fila até a carga normalizar.`);
  }

  function restaurarBase() {
    state.autoActive = false;
    state.mode = state.baseMode;
    _underMs = 0;
    console.log(`[Load Control] Sistema recuperado: restaurando modo "${state.baseMode}".`);
  }

  /* ── Persistência da configuração ─────────────────────────────────── */
  function loadConfig(cb) {
    masterDb.get(`SELECT valor FROM configuracoes_global WHERE chave = ?`, [CONFIG_KEY], (err, row) => {
      if (!err && row && row.valor) {
        try {
          const cfg = JSON.parse(row.valor);
          if (MODOS.includes(cfg.baseMode)) state.baseMode = cfg.baseMode;
          state.autoEnabled = !!cfg.autoEnabled;
          ['lagThresholdMs', 'sustainedMs', 'recoveryLagMs', 'recoverySustainedMs', 'maxRssMB'].forEach(k => {
            if (typeof cfg[k] === 'number' && cfg[k] >= 0) state[k] = cfg[k];
          });
          if (typeof cfg.spikeThreshold === 'number' && cfg.spikeThreshold > 0) state.spikeThreshold = cfg.spikeThreshold;
          if (typeof cfg.spikeCooldownMin === 'number' && cfg.spikeCooldownMin >= 0) state.spikeCooldownMin = cfg.spikeCooldownMin;
          state.updatedAt = cfg.updatedAt || null;
        } catch (e) { }
      }
      state.mode = state.autoActive ? 'spool' : state.baseMode;
      loadOverrides(() => { if (cb) cb(); });
    });
  }

  function saveConfig(cb) {
    state.updatedAt = new Date().toISOString();
    const json = JSON.stringify({
      baseMode: state.baseMode,
      autoEnabled: state.autoEnabled,
      lagThresholdMs: state.lagThresholdMs,
      sustainedMs: state.sustainedMs,
      recoveryLagMs: state.recoveryLagMs,
      recoverySustainedMs: state.recoverySustainedMs,
      maxRssMB: state.maxRssMB,
      spikeThreshold: state.spikeThreshold,
      spikeCooldownMin: state.spikeCooldownMin,
      updatedAt: state.updatedAt
    });
    masterDb.run(
      `INSERT INTO configuracoes_global (chave, valor) VALUES (?, ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
      [CONFIG_KEY, json],
      (err) => { if (cb) cb(err); }
    );
  }

  /* ── API pública de estado/métricas ───────────────────────────────── */
  function getState() {
    let rssMB = 0;
    try { rssMB = Math.round(process.memoryUsage().rss / (1024 * 1024)); } catch (e) { }
    return {
      modo_efetivo: state.mode,
      modo_base: state.baseMode,
      auto_ativo: state.autoActive,
      auto_enabled: state.autoEnabled,
      limites: {
        lagThresholdMs: state.lagThresholdMs,
        sustainedMs: state.sustainedMs,
        recoveryLagMs: state.recoveryLagMs,
        recoverySustainedMs: state.recoverySustainedMs,
        maxRssMB: state.maxRssMB
      },
      spike: { limite: state.spikeThreshold, cooldownMin: state.spikeCooldownMin },
      atualizado_em: state.updatedAt,
      uptime_s: Math.floor((Date.now() - state.startedAt) / 1000)
    };
  }

  function getMetrics(extra) {
    let rssMB = 0; let heapMB = 0;
    try {
      const m = process.memoryUsage();
      rssMB = Math.round(m.rss / (1024 * 1024));
      heapMB = Math.round(m.heapUsed / (1024 * 1024));
    } catch (e) { }
    const snap = {
      chegadas_min: countType('chegada'),
      aceitos_min: countType('aceito'),
      enfileirados_min: countType('enfileirado'),
      recusados_min: countType('recusado'),
      processados_min: countType('processado'),
      event_loop_lag_ms: currentLag,
      event_loop_lag_max_ms_5min: maxLagRecent,
      rss_mb: rssMB,
      heap_mb: heapMB
    };
    if (maxLagRecent > 0 && currentLag < maxLagRecent * 0.3) maxLagRecent = currentLag;
    return Object.assign(snap, extra || {});
  }

  /* ── Admissão de pedidos ──────────────────────────────────────────── */
  const MSG_MANUTENCAO = '⛔ Sistema em manutenção pelo administrador central. Novos pedidos estão temporariamente suspensos para proteger o sistema. Aguarde alguns instantes e reenvie.';

  function admit(tid) {
    record('chegada');
    recordTenantOrder(tid);
    // Manutenção global bloqueia todos os tenants
    if (state.mode === 'manutencao') {
      record('recusado');
      return { allowed: false, msg: MSG_MANUTENCAO };
    }
    const modo = getModoEfetivoTenant(tid);
    if (modo === 'manutencao') {
      record('recusado');
      return { allowed: false, msg: MSG_MANUTENCAO };
    }
    if (modo === 'spool') {
      record('enfileirado');
      return { allowed: true, spool: true, lightMode: false };
    }
    record('aceito');
    return { allowed: true, spool: false, lightMode: modo === 'evento' };
  }

  /**
   * Admissão para pontos de entrada que já são leves/filáveis por natureza
   * (QR grava em qr_pedidos_pendentes; hub e retro fazem INSERT único).
   * Em modo spool eles passam direto — só manutenção bloqueia.
   */
  function admitDirect(tid) {
    record('chegada');
    recordTenantOrder(tid);
    if (state.mode === 'manutencao' || getModoEfetivoTenant(tid) === 'manutencao') {
      record('recusado');
      return { allowed: false, msg: MSG_MANUTENCAO };
    }
    record('aceito');
    return { allowed: true };
  }

  function recordProcessed() { record('processado'); }

  /* ── Fila durável (spool) por tenant ──────────────────────────────── */
  const _spoolReady = new Set();   // tenants com tabela garantida
  const _filaTids = new Set();     // tenants com linhas pendentes

  function ensureSpoolTable(tenantDb, cb) {
    tenantDb.run(`CREATE TABLE IF NOT EXISTS pedidos_spool (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      tentativas INTEGER NOT NULL DEFAULT 0,
      criado_em DATETIME DEFAULT (datetime('now','localtime')),
      processado_em DATETIME,
      erro_msg TEXT
    )`, [], (err) => { cb(err); });
  }

  /**
   * Grava o pedido na fila durável do tenant e devolve via cb(err, filaId).
   * O INSERT é único e rápido — nunca bloqueia atrás de consultas longas.
   */
  function spoolOrder(tenantDb, payload, cb) {
    const json = JSON.stringify(payload);
    ensureSpoolTable(tenantDb, () => {
      tenantDb.run(
        `INSERT INTO pedidos_spool (payload, status) VALUES (?, 'pendente')`,
        [json],
        function (err) {
          if (err) return cb && cb(err);
          cb && cb(null, this && this.lastID);
        }
      );
    });
  }

  function marcarTenantComFila(tid) { _filaTids.add(tid); }

  function buscarLote(tenantDb, limite, cb) {
    tenantDb.all(
      `SELECT id, payload, tentativas FROM pedidos_spool WHERE status = 'pendente' ORDER BY id ASC LIMIT ?`,
      [limite],
      (err, rows) => cb(err, rows || [])
    );
  }

  function marcarProcessando(tenantDb, ids, cb) {
    const ph = ids.map(() => '?').join(',');
    tenantDb.run(`UPDATE pedidos_spool SET status='processando' WHERE id IN (${ph})`, ids, () => cb());
  }

  function concluirOk(tenantDb, id, cb) {
    tenantDb.run(
      `DELETE FROM pedidos_spool WHERE id = ?`,
      [id],
      () => cb && cb()
    );
  }

  function concluirErro(tenantDb, row, errMsg, cb) {
    const tentativas = (row.tentativas || 0) + 1;
    const novoStatus = tentativas >= SPOOL_MAX_TENTATIVAS ? 'erro' : 'pendente';
    tenantDb.run(
      `UPDATE pedidos_spool SET status=?, tentativas=?, erro_msg=? WHERE id=?`,
      [novoStatus, tentativas, String(errMsg || '').substring(0, 300), row.id],
      () => cb && cb()
    );
  }

  /* ── Worker que drena a fila ──────────────────────────────────────── */
  let _workerTimer = null;
  let _draining = false;

  function startWorker({ getTenantDbByTid, processOne }) {
    if (_workerTimer) return;
    _workerTimer = setInterval(() => {
      if (_draining || _filaTids.size === 0) return;
      _draining = true;
      const tids = Array.from(_filaTids).slice(0, 20);
      let pendente = tids.length;

      tids.forEach(tid => {
        const tdb = getTenantDbByTid(tid);
        if (!tdb) { _filaTids.delete(tid); if (--pendente === 0) _draining = false; return; }
        ensureSpoolTable(tdb, () => {
          buscarLote(tdb, 10, (err, rows) => {
            if (err || !rows.length) {
              // Sem linhas visíveis: pode ter sido drenado por outra instância/boot
              tenantCountCheck(tdb, tid, () => {
                if (--pendente === 0) _draining = false;
              });
              return;
            }
            marcarProcessando(tdb, rows.map(r => r.id), () => {
              let restantes = rows.length;
              const done = () => {
                restantes--;
                if (restantes > 0) return;
                tenantCountCheck(tdb, tid, () => {
                  if (--pendente === 0) _draining = false;
                });
              };
              rows.forEach(row => {
                let pedido = null;
                try { pedido = JSON.parse(row.payload); } catch (e) { pedido = null; }
                if (!pedido) {
                  concluirErro(tdb, row, 'payload inválido', done);
                  return;
                }
                Promise.resolve()
                  .then(() => processOne(tid, pedido))
                  .then(() => { recordProcessed(); concluirOk(tdb, row.id, done); })
                  .catch(eProc => { concluirErro(tdb, row, eProc && eProc.message, done); });
              });
            });
          });
        });
      });

      function tenantCountCheck(tdb, tid, cb) {
        tdb.get(`SELECT COUNT(*) AS n FROM pedidos_spool WHERE status IN ('pendente','processando')`, [], (e, r) => {
          if (e || !r || !r.n) _filaTids.delete(tid);
          cb();
        });
      }
    }, WORKER_INTERVAL_MS);
    if (_workerTimer.unref) _workerTimer.unref();
  }

  /**
   * Recuperação no boot: aponta quais tenants têm linhas na fila.
   * Linhas 'processando' (crash no meio) voltam a 'pendente'.
   */
  function recoverPending({ tenantIds, openTenantDb }) {
    let restantes = tenantIds.length;
    if (!restantes) return Promise.resolve(0);
    return new Promise((resolve) => {
      let totalPendente = 0;
      tenantIds.forEach(tid => {
        const tdb = openTenantDb(tid);
        if (!tdb) { if (--restantes === 0) resolve(totalPendente); return; }
        ensureSpoolTable(tdb, () => {
          tdb.run(`UPDATE pedidos_spool SET status='pendente' WHERE status='processando'`, [], () => {
            tdb.get(`SELECT COUNT(*) AS n FROM pedidos_spool WHERE status IN ('pendente','processando')`, [], (e, r) => {
              if (!e && r && r.n > 0) { _filaTids.add(tid); totalPendente += r.n; }
              if (--restantes === 0) resolve(totalPendente);
            });
          });
        });
      });
    });
  }

  function getFilaSnapshot() {
    return {
      tenants_com_fila: Array.from(_filaTids),
      profundidade_estimada: _filaTids.size
    };
  }

  /* ── Setters chamados pela API do super admin ─────────────────────── */
  function setConfig(parcial, cb) {
    if (parcial.baseMode !== undefined) {
      if (!MODOS.includes(parcial.baseMode)) return cb(new Error('Modo inválido.'));
      state.baseMode = parcial.baseMode;
      if (!state.autoActive) state.mode = parcial.baseMode;
    }
    if (parcial.autoEnabled !== undefined) {
      state.autoEnabled = !!parcial.autoEnabled;
      if (!state.autoEnabled && state.autoActive) restaurarBase();
      if (state.autoEnabled) { _overMs = 0; _underMs = 0; }
    }
    ['lagThresholdMs', 'sustainedMs', 'recoveryLagMs', 'recoverySustainedMs', 'maxRssMB'].forEach(k => {
      const v = Number(parcial[k]);
      if (parcial[k] !== undefined && !isNaN(v) && v >= 0) state[k] = Math.floor(v);
    });
    if (parcial.spikeThreshold !== undefined) {
      const v = Number(parcial.spikeThreshold);
      if (!isNaN(v) && v >= 1) state.spikeThreshold = Math.floor(v);
    }
    if (parcial.spikeCooldownMin !== undefined) {
      const v = Number(parcial.spikeCooldownMin);
      if (!isNaN(v) && v >= 0) state.spikeCooldownMin = Math.floor(v);
    }
    saveConfig(cb);
  }

  function startMonitor() {
    if (_monitorTimer) return;
    _monitorTimer = setInterval(monitorTick, MONITOR_INTERVAL_MS);
    if (_monitorTimer.unref) _monitorTimer.unref();
  }

  return {
    MODOS,
    init: loadConfig,
    admit,
    admitDirect,
    recordRejected: () => record('recusado'),
    recordProcessed,
    checkSpike,
    getTenantOrdersPerMin,
    tenantDemandSnapshot: function() {
      const out = [];
      _tenantWindow.forEach((arr, tid) => {
        const ppm = getTenantOrdersPerMin(tid);
        if (ppm > 0) out.push({ tid, pedidos_min: ppm });
      });
      return out;
    },
    setTenantOverride,
    getTenantOverrides: function() { const o = {}; _overrides.forEach((m, t) => { o[t] = m; }); return o; },
    getModoEfetivoTenant,
    spoolOrder,
    marcarTenantComFila,
    ensureSpoolTable,
    startWorker,
    startMonitor,
    recoverPending,
    getState,
    getMetrics,
    getFilaSnapshot,
    setConfig,
    _state: state
  };
}

module.exports = { createLoadControl, MODOS };
