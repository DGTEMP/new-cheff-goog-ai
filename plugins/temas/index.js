/**
 * plugin: temas — Temas globais multi-versão (claro + escuro)
 * Extraído de server.js linhas 2379-2503
 */
module.exports = function({ app, masterDb, io, options }) {
  const { superAdminAuth } = options;

  masterDb.run(`CREATE TABLE IF NOT EXISTS temas_global (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    versao TEXT UNIQUE,
    nome TEXT,
    ativo INTEGER DEFAULT 0,
    cfg_claro TEXT DEFAULT '{}',
    cfg_escuro TEXT DEFAULT '{}',
    criada_em DATETIME DEFAULT (datetime('now','localtime'))
  )`);

  // Seed: migra o tema global atual para a versão 1.1 (uma única vez)
  masterDb.get(`SELECT id FROM temas_global LIMIT 1`, [], (eSeed, seedRow) => {
    if (!eSeed && !seedRow) {
      masterDb.get(`SELECT valor FROM configuracoes_global WHERE chave = 'custom_theme'`, [], (eCfg, cfgRow) => {
        const cfgAtual = (!eCfg && cfgRow && cfgRow.valor) ? cfgRow.valor : '{}';
        masterDb.run(
          `INSERT OR IGNORE INTO temas_global (versao, nome, ativo, cfg_claro, cfg_escuro) VALUES ('1.1', 'Tema Base (migrado)', 1, ?, ?)`,
          [cfgAtual, cfgAtual], () => { }
        );
      });
    }
  });

  function propagarTemaAtivo(cfgClaro, cfgEscuro, coringa) {
    const payload = Object.assign({ modo_dual: true, claro: cfgClaro || {}, escuro: cfgEscuro || {} }, coringa ? { coringa } : {});
    masterDb.run(`INSERT INTO configuracoes_global (chave, valor) VALUES ('custom_theme', ?)
      ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`, [JSON.stringify(payload)], () => { });
    try { io.emit('tema_global_atualizado', payload); } catch (e) { }
  }

  app.get('/api/super/temas', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT id, versao, nome, ativo, cfg_claro, cfg_escuro, criada_em FROM temas_global ORDER BY CAST(versao AS REAL) ASC`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      const temas = (rows || []).map(t => {
        let claro = {}, escuro = {};
        try { claro = JSON.parse(t.cfg_claro || '{}'); } catch (e) { }
        try { escuro = JSON.parse(t.cfg_escuro || '{}'); } catch (e) { }
        return { id: t.id, versao: t.versao, nome: t.nome, ativo: !!t.ativo, criada_em: t.criada_em, cfg_claro: claro, cfg_escuro: escuro };
      });
      res.json({ ok: true, temas });
    });
  });

  app.post('/api/super/temas', superAdminAuth, (req, res) => {
    const nome = String((req.body || {}).nome || '').trim().slice(0, 60) || 'Tema sem nome';
    const baseadoEmId = parseInt((req.body || {}).baseado_em_id, 10);
    const criar = (baseClaro, baseEscuro) => {
      masterDb.get(`SELECT MAX(CAST(versao AS REAL)) as maxV FROM temas_global`, [], (eMax, maxRow) => {
        if (eMax) return res.json({ ok: false, erro: eMax.message });
        const proxima = ((maxRow && maxRow.maxV) || 1.0) + 0.1;
        const versao = proxima.toFixed(1);
        masterDb.run(
          `INSERT INTO temas_global (versao, nome, ativo, cfg_claro, cfg_escuro) VALUES (?, ?, 0, ?, ?)`,
          [versao, nome, JSON.stringify(baseClaro || {}), JSON.stringify(baseEscuro || {})],
          function (eIns) {
            if (eIns) return res.json({ ok: false, erro: eIns.message });
            res.json({ ok: true, id: this.lastID, versao, mensagem: `Tema ${versao} criado! Agora edite o modo Claro e o modo Escuro dele.` });
          }
        );
      });
    };
    if (baseadoEmId) {
      masterDb.get(`SELECT cfg_claro, cfg_escuro FROM temas_global WHERE id = ?`, [baseadoEmId], (eB, bRow) => {
        if (eB || !bRow) return criar(null, null);
        let c = {}, e = {};
        try { c = JSON.parse(bRow.cfg_claro || '{}'); } catch (x) { }
        try { e = JSON.parse(bRow.cfg_escuro || '{}'); } catch (x) { }
        criar(c, e);
      });
    } else {
      criar(null, null);
    }
  });

  app.post('/api/super/temas/:id', superAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const b = req.body || {};
    const campos = [], params = [];
    if (b.nome !== undefined) { campos.push('nome = ?'); params.push(String(b.nome).trim().slice(0, 60)); }
    if (b.cfg_claro !== undefined) { campos.push('cfg_claro = ?'); params.push(JSON.stringify(b.cfg_claro)); }
    if (b.cfg_escuro !== undefined) { campos.push('cfg_escuro = ?'); params.push(JSON.stringify(b.cfg_escuro)); }
    if (!campos.length) return res.json({ ok: false, erro: 'Nada para salvar.' });
    params.push(id);
    masterDb.run(`UPDATE temas_global SET ${campos.join(', ')} WHERE id = ?`, params, (err) => {
      if (err) return res.json({ ok: false, erro: err.message });
      masterDb.get(`SELECT ativo, cfg_claro, cfg_escuro FROM temas_global WHERE id = ?`, [id], (eGet, row) => {
        if (!eGet && row && row.ativo) {
          let claro = {}, escuro = {};
          try { claro = JSON.parse(row.cfg_claro || '{}'); } catch (x) { }
          try { escuro = JSON.parse(row.cfg_escuro || '{}'); } catch (x) { }
          propagarTemaAtivo(claro, escuro, (claro && claro.coringa) || (escuro && escuro.coringa) || null);
        }
        res.json({ ok: true, mensagem: 'Tema salvo!' + ((!eGet && row && row.ativo) ? ' Como está ATIVO, já foi aplicado em todos os terminais.' : '') });
      });
    });
  });

  app.post('/api/super/temas/:id/ativar', superAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    masterDb.run(`UPDATE temas_global SET ativo = CASE WHEN id = ? THEN 1 ELSE 0 END`, [id], (errUp) => {
      if (errUp) return res.json({ ok: false, erro: errUp.message });
      masterDb.get(`SELECT * FROM temas_global WHERE id = ?`, [id], (eGet, tema) => {
        if (eGet || !tema) return res.json({ ok: false, erro: 'Tema não encontrado.' });
        let claro = {}, escuro = {};
        try { claro = JSON.parse(tema.cfg_claro || '{}'); } catch (x) { }
        try { escuro = JSON.parse(tema.cfg_escuro || '{}'); } catch (x) { }
        propagarTemaAtivo(claro, escuro, (claro && claro.coringa) || (escuro && escuro.coringa) || null);
        res.json({ ok: true, mensagem: `Tema ${tema.versao} (${tema.nome}) ativado e propagado em tempo real!` });
      });
    });
  });

  app.delete('/api/super/temas/:id', superAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    masterDb.run(`DELETE FROM temas_global WHERE id = ? AND ativo = 0`, [id], function (err) {
      if (err) return res.json({ ok: false, erro: err.message });
      if (!this.changes) return res.json({ ok: false, erro: 'Só é possível excluir temas INATIVOS.' });
      res.json({ ok: true, mensagem: 'Tema excluído.' });
    });
  });
};
