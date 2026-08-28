// plugins/tema-v2/index.js - Backend para Tema v2.0 Modular (Apple HIG)
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function carregarConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {}
  return {
    nomeRestaurante: 'Chef Cozinha Gourmet',
    logoUrl: '',
    corPrimaria: '#fc4b15',
    corAcento: '#3b82f6',
    modoVidro: true,
    widgetsAtivos: {
      pdv: true,
      mesas: true,
      balanca: true,
      kds: true,
      metricas: true,
      configExpress: true
    }
  };
}

function salvarConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = function registerThemeV2Routes(ctxOrApp, maybeIo, maybeDb) {
  const app = ctxOrApp && ctxOrApp.app ? ctxOrApp.app : ctxOrApp;
  const io = ctxOrApp && ctxOrApp.io ? ctxOrApp.io : maybeIo;
  const db = ctxOrApp && ctxOrApp.db ? ctxOrApp.db : maybeDb;

  // Retorna as configurações do tema v2.0
  app.get('/api/tema-v2/config', (req, res) => {
    const cfg = carregarConfig();
    res.json({ sucesso: true, config: cfg });
  });

  // Salva e propaga a personalização (nome, logo, cores) em tempo real
  app.post('/api/tema-v2/config', (req, res) => {
    const { nomeRestaurante, logoUrl, corPrimaria, corAcento, modoVidro, widgetsAtivos } = req.body;
    const atual = carregarConfig();

    const novo = {
      ...atual,
      nomeRestaurante: nomeRestaurante !== undefined ? nomeRestaurante : atual.nomeRestaurante,
      logoUrl: logoUrl !== undefined ? logoUrl : atual.logoUrl,
      corPrimaria: corPrimaria || atual.corPrimaria,
      corAcento: corAcento || atual.corAcento,
      modoVidro: modoVidro !== undefined ? modoVidro : atual.modoVidro,
      widgetsAtivos: widgetsAtivos || atual.widgetsAtivos
    };

    salvarConfig(novo);

    // Dispara atualização em tempo real para todos os clientes conectados
    if (io) {
      io.emit('tema_v2_atualizado', novo);
    }

    res.json({ sucesso: true, message: 'Configurações do Tema v2.0 salvas com sucesso!', config: novo });
  });

  console.log('  [Plugin] Tema v2.0 Modular (Apple HIG) inicializado e rotas registradas.');
};
