/**
 * license-manager.js
 * Módulo de gerenciamento de licenças do Chef Cozinha.
 * Verifica licença no startup e a cada 24h.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const http = require('http');
const https = require('https');

// ── Configurações ──────────────────────────────────────────
const APPS_SCRIPT_URL = process.env.LICENSE_URL || '__LICENSE_URL_PLACEHOLDER__';
const APP_VERSION     = '1.0.0';
const OFFLINE_GRACE_MS = 48 * 60 * 60 * 1000; // 48h
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // verificar a cada 24h

// Caminho do arquivo de licença (por plataforma: %APPDATA%\ChefCozinha no
// Windows; $XDG_DATA_HOME/ChefCozinha ou ~/.local/share/ChefCozinha no Linux)
const DATA_DIR = (() => {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ChefCozinha');
  }
  const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(xdg, 'ChefCozinha');
})();
const LICENSE_FILE = path.join(DATA_DIR, 'license.json');
const LICENSE_CONFIG_FILE = path.join(DATA_DIR, 'license-config.json');

// URL do hub central (servidor Chef Cozinha que emite chaves): vem do env
// CHEF_HUB_URL ou do campo "hubUrl" salvo no license-config.json.
//
// Múltiplos hubs: o restaurante sincroniza com o HUB principal E com o
// pendrive (último caso). A lista vem de:
//   1) process.env.CHEF_HUB_URL
//   2) cfg.hubUrl            (HUB principal)
//   3) cfg.hubUrls[]         (lista completa, ex.: [principal, pendrive])
//   4) cfg.hubBackupUrl / cfg.hubPendriveUrl  (pendrive / backup)
//   5) config puxada do HUB (puxarConfigHub)
function getHubUrls() {
  const urls = [];
  const push = (u) => {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (u && !u.includes('__HUB_URL') && !u.includes('__LICENSE_URL') && urls.indexOf(u) === -1) urls.push(u);
  };
  push(process.env.CHEF_HUB_URL);
  try {
    if (fs.existsSync(LICENSE_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(LICENSE_CONFIG_FILE, 'utf8'));
      push(cfg.hubUrl);
      if (Array.isArray(cfg.hubUrls)) cfg.hubUrls.forEach(push);
      push(cfg.hubBackupUrl);
      push(cfg.hubPendriveUrl);
    }
  } catch (e) {}
  return urls;
}

// Hub principal (primeiro da lista) — compatibilidade com chamadas antigas
function getHubUrl() {
  return getHubUrls()[0] || '';
}
const HUB_URL = ''; // resolvido dinamicamente via getHubUrl()

// True quando existe ao menos um hub central configurado (não é placeholder)
function hubConfigurado() {
  return getHubUrls().length > 0;
}

// Valida o formato de uma chave de licença localmente (ex.: CHEF-AB12-CD34-EF56)
function validarChaveFormato(chave) {
  return /^CHEF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(chave || '').trim().toUpperCase());
}

// Envia dados para os hubs configurados (principal + pendrive).
// Retorna ok:true se pelo menos um hub aceitou; lista os resultados por hub.
async function enviarParaHub(caminho, dados) {
  const hubs = getHubUrls();
  if (!hubs.length) return { ok: false, error: 'Hub não configurado.' };
  const resultados = [];
  let sucesso = false;
  for (const hub of hubs) {
    try {
      const result = await fetchJson(`${hub}${String(caminho || '').startsWith('/') ? caminho : '/' + caminho}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados || {}),
        timeout: 10000
      });
      const ok = !!(result && result.ok);
      resultados.push({ hub, ok, status: ok ? 'ok' : 'rejeitado' });
      if (ok) {
        sucesso = true;
        marcarContatoRede();
      }
    } catch (err) {
      resultados.push({ hub, ok: false, status: 'offline', error: err.message });
    }
  }
  return { ok: sucesso, resultados };
}

// Estado global da licença
let licenseState = {
  status:          'unknown',  // unknown | trial | ativo | expirado | bloqueado | offline
  restaurante:     '',
  diasRestantes:   null,
  trialEnd:        null,
  validade:        null,
  plano:           'trial',
  maxDispositivos: 0,
  installId:       null,
  chave:           null,
  lastCheck:       null,
  isRestricted:    false,      // true quando em modo restrito
  pendingUpdate:   null,       // { version: "1.1.0", message: "...", url: "..." } ou null
};

// ── Inicialização ──────────────────────────────────────────
async function initLicense() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Carregar dados salvos
  const saved = loadLicenseFile();

  // Garantir que temos um installId
  if (!saved.installId) {
    saved.installId = 'INST-' + generateUUID().substring(0, 8).toUpperCase() + '-' +
                      generateUUID().substring(0, 8).toUpperCase();
    saveLicenseFile(saved);
  }

  licenseState.installId = saved.installId;
  licenseState.chave     = saved.chave || '';
  licenseState.restaurante = saved.restaurante || '';

  // Verificar se o modo offline está ativado
  let modoOffline = false;
  try {
    if (fs.existsSync(LICENSE_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(LICENSE_CONFIG_FILE, 'utf8'));
      if (cfg.modoOffline) modoOffline = true;
    }
  } catch {}

  if (modoOffline) {
    licenseState.status = 'ativo';
    licenseState.isRestricted = false;
    licenseState.restaurante = saved.restaurante || 'Chef Cozinha (Offline)';
    licenseState.plano = 'pro';
    console.log('[Licença] Iniciado em Modo 100% Offline (Sem Internet)');
  } else {
    // Tentar verificar online
    try {
      const result = await checkOnline(saved.chave || '', saved.installId);
      applyLicenseResult(result, saved.chave || '');
      saveLicenseFile({ ...saved, ...licenseState, lastCheck: Date.now() });
      marcarContatoRede();
      console.log(`[Licença] Status: ${licenseState.status} | Restaurante: ${licenseState.restaurante || '(não configurado)'}`);
    } catch (err) {
      console.log('[Licença] Sem internet — usando cache local');
      applyOfflineFallback(saved);
      aplicarCarencia();
    }
  }

  // Inicia sincronização: puxa config do hub, envia fila pendente e agenda.
  setTimeout(() => {
    puxarConfigHub().then(r => {
      if (r.ok) console.log('[Sync] Configuração puxada do hub:', JSON.stringify(r.config).substring(0, 200));
    }).catch(() => {});
    enviarFilaSync().then(r => {
      if (r.enviados > 0) console.log(`[Sync] ${r.enviados} item(ns) da fila enviado(s).`);
    }).catch(() => {});
  }, 2000);
  // Repete a cada 30min: puxa config, envia fila, reavalia carência
  setInterval(() => {
    puxarConfigHub().catch(() => {});
    enviarFilaSync().catch(() => {});
    aplicarCarencia();
  }, 30 * 60 * 1000);

  // Agendar verificação periódica
  setInterval(async () => {
    let innerOffline = false;
    try {
      if (fs.existsSync(LICENSE_CONFIG_FILE)) {
        const cfg = JSON.parse(fs.readFileSync(LICENSE_CONFIG_FILE, 'utf8'));
        if (cfg.modoOffline) innerOffline = true;
      }
    } catch {}

    if (innerOffline) {
      licenseState.status = 'ativo';
      licenseState.isRestricted = false;
      return;
    }

    try {
      const saved2 = loadLicenseFile();
      const result = await checkOnline(saved2.chave || '', saved2.installId);
      applyLicenseResult(result, saved2.chave || '');
      saveLicenseFile({ ...saved2, ...licenseState, lastCheck: Date.now() });
      marcarContatoRede();
      console.log(`[Licença] Revalidado: ${licenseState.status}`);
    } catch {
      applyOfflineFallback(loadLicenseFile());
      aplicarCarencia();
    }
  }, CHECK_INTERVAL_MS);

  return licenseState;
}

// ── Ativar chave ────────────────────────────────────────────
async function activateLicense(chave, info) {
  const saved = loadLicenseFile();
  chave = String(chave || '').trim().toUpperCase();
  let resultado = null;
  let falhaRede = false;

  try {
    const hub = getHubUrl();
    if (hub) {
      // Modo hub central: valida contra o servidor do super admin
      resultado = await fetchJson(`${hub}/api/licenca/ativar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, install_id: saved.installId, nome_restaurante: (info && info.restaurante) || '', versao: APP_VERSION, plataforma: process.platform })
      });
    } else {
      resultado = await fetchScript({
        action:    'activate',
        key:       chave,
        installId: saved.installId,
        v:         APP_VERSION,
      });
    }
  } catch (err) {
    falhaRede = true;
  }

  // Validação online com sucesso
  if (resultado && resultado.ok) {
    applyLicenseResult(resultado, chave);
    saveLicenseFile({ ...saved, ...licenseState, chave, lastCheck: Date.now() });
    return { ok: true, ...licenseState };
  }

  // Servidor respondeu e rejeitou a chave
  if (resultado && !resultado.ok) {
    return { ok: false, error: resultado.error || 'Chave inválida' };
  }

  // Falha de rede: aceita offline se a chave tiver formato válido e agenda verificação
  if (falhaRede) {
    if (validarChaveFormato(chave)) {
      licenseState.status = 'ativo';
      licenseState.chave = chave;
      licenseState.restaurante = (info && info.restaurante) || saved.restaurante || '';
      licenseState.isRestricted = false;
      licenseState.offlinePendente = true; // será revalidada no hub assim que possível
      licenseState.lastCheck = Date.now();
      saveLicenseFile({ ...saved, ...licenseState, chave, lastCheck: Date.now() });
      console.warn('[Licença] Ativação offline — chave aceita localmente, aguardando conexão para validar no hub.');
      return { ok: true, offline: true, pendenteVerificacao: true, ...licenseState };
    }
    return { ok: false, error: 'Sem conexão com o servidor. Verifique a chave e a internet.' };
  }

  return { ok: false, error: 'Falha ao ativar a chave.' };
}

// ── Verificar online ────────────────────────────────────────
async function checkOnline(chave, installId) {
  const hub = getHubUrl();
  if (hub) {
    const params = new URLSearchParams({ chave: chave || '', install_id: installId });
    return fetchJson(`${hub}/api/licenca/estado?${params}`, { timeout: 8000 });
  }
  const params = {
    action: chave ? 'validate' : 'register',
    installId,
    v: APP_VERSION,
  };
  if (chave) params.key = chave;
  return fetchScript(params);
}

// ── Fila offline + carência de rede ──────────────────────────
// O restaurante guarda localmente os dados prontos para oferecer ao HUB e ao
// pendrive. A cada ciclo, se a internet caiu, acumula; quando volta, envia tudo.
// Após 48h sem rede: aviso. Após 72h: exige conexão ou chave de ativação.

const SYNC_FILA_FILE = path.join(DATA_DIR, 'sync-fila.json');
const CARENCIA_AVISO_HORAS = 48;   // 48h sem rede → aviso
const CARENCIA_BLOQUEIO_HORAS = 72; // 72h sem rede → bloqueio (exige chave)
const MAX_FILA_ITENS = 500;

function loadSyncFila() {
  try {
    if (!fs.existsSync(SYNC_FILA_FILE)) return [];
    const arr = JSON.parse(fs.readFileSync(SYNC_FILA_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function saveSyncFila(fila) {
  try {
    const final = fila.slice(-MAX_FILA_ITENS);
    fs.writeFileSync(SYNC_FILA_FILE, JSON.stringify(final, null, 2), 'utf8');
  } catch (e) { console.error('[Sync] Erro ao salvar fila:', e.message); }
}

// Registra um item de sincronização offline (fica na fila até enviar)
function enfileirarSync(tipo, payload) {
  const fila = loadSyncFila();
  fila.push({
    id: (Date.now().toString(36)) + '-' + Math.random().toString(36).slice(2, 8),
    tipo,
    payload,
    criado_em: new Date().toISOString(),
    enviado_em: null,
    tentativas: 0
  });
  saveSyncFila(fila);
}

// Tenta enviar TODOS os itens pendentes da fila para todos os hubs
async function enviarFilaSync() {
  const fila = loadSyncFila();
  const pendentes = fila.filter(i => !i.enviado_em);
  if (!pendentes.length) return { ok: true, enviados: 0 };
  let enviados = 0;
  for (const item of pendentes) {
    const rota = item.tipo === 'ativacao' ? '/api/licenca/ativar'
               : item.tipo === 'registro' ? '/api/telemetria'
               : '/api/telemetria';
    const res = await enviarParaHub(rota, item.payload);
    if (res.ok) {
      item.enviado_em = new Date().toISOString();
      enviados++;
    } else {
      item.tentativas = (item.tentativas || 0) + 1;
    }
  }
  // Limpa itens enviados há mais de 7 dias para não crescer infinitamente
  const antigos = fila.filter(i => {
    if (!i.enviado_em) return false;
    const ms = Date.now() - new Date(i.enviado_em).getTime();
    return ms > 7 * 24 * 60 * 60 * 1000;
  });
  const restante = fila.filter(i => antigos.indexOf(i) === -1);
  saveSyncFila(restante);
  return { ok: true, enviados, pendentes: restante.filter(i => !i.enviado_em).length };
}

// Estado da carência de rede (baseado no último contato bem-sucedido com hubs)
function getCarenciaRede() {
  const saved = loadLicenseFile();
  const ultimo = saved.ultimoContatoRede || 0;
  const agora = Date.now();
  const horasOffline = ultimo ? (agora - ultimo) / (60 * 60 * 1000) : null;
  const modoOffline = (() => {
    try {
      if (fs.existsSync(LICENSE_CONFIG_FILE)) {
        const cfg = JSON.parse(fs.readFileSync(LICENSE_CONFIG_FILE, 'utf8'));
        if (cfg.modoOffline) return true;
      }
    } catch (e) {}
    return false;
  })();

  // Modo 100% offline é uma escolha do dono — não aplica carência
  if (modoOffline) {
    return { aviso: false, bloqueio: false, horasOffline: null, modoOffline: true };
  }

  if (horasOffline === null) {
    // Nunca registrou contato com rede: sem histórico, sem bloqueio.
    // O contato é marcado apenas quando um hub responde de fato (marcarContatoRede).
    return { aviso: false, bloqueio: false, horasOffline: null, modoOffline: false };
  }

  const aviso = horasOffline >= CARENCIA_AVISO_HORAS;
  const bloqueio = horasOffline >= CARENCIA_BLOQUEIO_HORAS;
  return { aviso, bloqueio, horasOffline, modoOffline: false };
}

// Registra o momento em que o restaurante conseguiu falar com um hub
function marcarContatoRede() {
  const saved = loadLicenseFile();
  saved.ultimoContatoRede = Date.now();
  saveLicenseFile(saved);
}

// Aplica a política de carência no estado da licença
function aplicarCarencia() {
  const carencia = getCarenciaRede();
  licenseState.carenciaRede = carencia;
  if (carencia.modoOffline) {
    licenseState.status = 'ativo';
    licenseState.isRestricted = false;
    return;
  }
  if (carencia.bloqueio) {
    // 72h+ sem rede: exige conexão ou chave de ativação para estender
    licenseState.isRestricted = true;
    licenseState.status = 'bloqueado_rede';
    licenseState.avisoRede = true;
  } else if (carencia.aviso) {
    licenseState.isRestricted = false;
    licenseState.status = licenseState.status || 'ativo';
    licenseState.avisoRede = true;
  } else {
    licenseState.avisoRede = false;
  }
}

// Puxa do HUB a configuração de telemetria deste restaurante (appscript, sheets,
// frequência, IP do pendrive) e aplica no license-config.json.
async function puxarConfigHub() {
  const hubs = getHubUrls();
  if (!hubs.length) return { ok: false, error: 'Hub não configurado.' };
  const saved = loadLicenseFile();
  for (const hub of hubs) {
    try {
      const result = await fetchJson(`${hub}/api/telemetria/config?install_id=${encodeURIComponent(saved.installId || '')}`, { timeout: 8000 });
      if (result && result.ok && result.config) {
        const cfgAtual = (() => {
          try { if (fs.existsSync(LICENSE_CONFIG_FILE)) return JSON.parse(fs.readFileSync(LICENSE_CONFIG_FILE, 'utf8')); } catch (e) {}
          return {};
        })();
        const novo = {
          ...cfgAtual,
          ...result.config,
          _config_puxada_em: new Date().toISOString()
        };
        try { fs.writeFileSync(LICENSE_CONFIG_FILE, JSON.stringify(novo, null, 2), 'utf8'); } catch (e) {}
        marcarContatoRede();
        return { ok: true, config: result.config };
      }
    } catch (err) {
      // tenta o próximo hub
    }
  }
  return { ok: false, error: 'Nenhum hub respondeu.' };
}


async function enviarTelemetria(dados) {
  const hubs = getHubUrls();
  if (!hubs.length) return { ok: false, error: 'Hub não configurado.' };
  const resultados = [];
  let sucesso = false;
  for (const hub of hubs) {
    try {
      const result = await fetchJson(`${hub}/api/telemetria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados || {}),
        timeout: 10000
      });
      const ok = !!(result && result.ok);
      resultados.push({ hub, ok });
      if (ok) {
        sucesso = true;
        marcarContatoRede();
      }
    } catch (err) {
      resultados.push({ hub, ok: false, error: err.message });
    }
  }
  return { ok: sucesso, resultados };
}

// ── Fallback offline ────────────────────────────────────────
// Sem internet o sistema NUNCA interrompe a operação: mantém o último estado
// conhecido, valida pela data salva (apenas informativa) e nunca entra em modo
// restrito por falta de conexão. A validação online continua ocorrendo sempre
// que houver internet, e é nela que chaves expiradas/revogadas são bloqueadas.
function applyOfflineFallback(saved) {
  const chave    = saved.chave || '';
  const validade = saved.validade || '';
  const hoje     = new Date().toISOString().split('T')[0];

  licenseState.chave         = chave;
  licenseState.restaurante   = saved.restaurante || '';
  licenseState.pendingUpdate = saved.pendingUpdate || null;
  licenseState.isRestricted  = false;
  licenseState.status        = 'ativo';
  licenseState.validade      = validade || saved.validade || null;

  if (chave && validade) {
    if (validade < hoje) {
      console.warn(`[Licença] Offline — chave ${chave} com validade ${validade} vencida; mantendo operação (sem internet, bloqueio só ocorre online).`);
    } else {
      console.log(`[Licença] Offline — licença válida até ${validade}.`);
    }
    return;
  }
  if (chave) {
    console.log(`[Licença] Offline — chave ${chave} sem validade salva; operação mantida.`);
    return;
  }
  console.log('[Licença] Offline — sem chave/config e sem internet; operação mantida (validação será feita quando houver conexão).');
}

// ── Aplicar resultado da API ────────────────────────────────
function applyLicenseResult(result, chave) {
  licenseState.status       = result.status || (result.ok ? 'ativo' : 'bloqueado');
  licenseState.restaurante  = result.restaurante || '';
  licenseState.diasRestantes = result.diasRestantes || null;
  licenseState.trialEnd     = result.trialEnd || null;
  licenseState.validade     = result.validade || null;
  licenseState.plano        = result.plano || 'trial';
  licenseState.maxDispositivos = result.maxDispositivos || 0;
  licenseState.chave        = chave;
  licenseState.isRestricted = !result.ok || ['expirado', 'bloqueado'].includes(licenseState.status);
  licenseState.pendingUpdate = result.pendingUpdate || null;
}

// ── Fetch JSON genérico (hub central) ──────────────────────
function fetchJson(url, opts) {
  return new Promise((resolve, reject) => {
    const method = (opts && opts.method) || 'GET';
    const timeout = (opts && opts.timeout) || 8000;
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method, timeout, headers: (opts && opts.headers) || {} }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400 && !parsed.ok) reject(new Error(parsed.error || parsed.message || `HTTP ${res.statusCode}`));
          else resolve(parsed);
        } catch { reject(new Error('Resposta inválida do hub')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (opts && opts.body) req.write(opts.body);
    req.end();
  });
}

// ── Fetch para o Apps Script ────────────────────────────────
function fetchScript(params) {
  return new Promise((resolve, reject) => {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('__LICENSE_URL')) {
      // URL não configurada — modo de desenvolvimento
      resolve({ ok: true, status: 'ativo', restaurante: 'Dev Mode', plano: 'pro', maxDispositivos: 0 });
      return;
    }

    const query  = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const url    = `${APPS_SCRIPT_URL}&${query}`;
    const mod    = url.startsWith('https') ? https : http;

    const req = mod.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Resposta inválida do servidor de licenças')); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── Helpers ─────────────────────────────────────────────────
function loadLicenseFile() {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveLicenseFile(data) {
  try { fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('[Licença] Erro ao salvar:', e.message); }
}

function generateUUID() {
  // UUID simples sem dependência externa
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── API pública ─────────────────────────────────────────────
function getState() { return { ...licenseState }; }

function isRestricted() { return licenseState.isRestricted; }

function getRestaurantName() { return licenseState.restaurante || 'Chef Cozinha'; }

async function recheckLicense() {
  const saved = loadLicenseFile();
  let modoOffline = false;
  try {
    if (fs.existsSync(LICENSE_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(LICENSE_CONFIG_FILE, 'utf8'));
      if (cfg.modoOffline) modoOffline = true;
    }
  } catch {}

  if (modoOffline) {
    licenseState.status = 'ativo';
    licenseState.isRestricted = false;
    licenseState.restaurante = saved.restaurante || 'Chef Cozinha (Offline)';
    licenseState.plano = 'pro';
    console.log('[Licença] Forçado em Modo 100% Offline (Ativo)');
  } else {
    try {
      const result = await checkOnline(saved.chave || '', saved.installId);
      applyLicenseResult(result, saved.chave || '');
      marcarContatoRede();
    } catch {
      applyOfflineFallback(saved);
      aplicarCarencia();
    }
  }
}

module.exports = {
  initLicense, activateLicense, getState, isRestricted, getRestaurantName,
  recheckLicense, enviarTelemetria, getHubUrl, getHubUrls, hubConfigurado,
  validarChaveFormato, enviarParaHub, enfileirarSync, enviarFilaSync,
  getCarenciaRede, aplicarCarencia, puxarConfigHub
};
