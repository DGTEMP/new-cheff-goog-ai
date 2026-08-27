/**
 * ══════════════════════════════════════════════════════════════════
 * 🛡️ CHEF COZINHA - LICENSE GUARD & SYNCCHEFF ACTIVATION SYSTEM
 * ══════════════════════════════════════════════════════════════════
 * - Validação obrigatória no 1º acesso (Hardware Fingerprint + Hash SHA-256)
 * - Auditoria Silenciosa (Shadow Audit) com 7 dias de carência e envio de DIFFs
 * - Aviso de Quarentena com contagem regressiva de 30 dias (Retenção Segura)
 * - Integração nativa com o Servidor Central / Super Admin
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

class LicenseGuard {
  constructor(options = {}) {
    this.baseDir = options.baseDir || __dirname;
    this.licenseFile = path.join(this.baseDir, 'sync_license.json');
    this.centralServerUrl = process.env.CENTRAL_SERVER_URL || 'https://chefcozinha.com.br';
    this.cachedFingerprint = null;
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(this.licenseFile)) {
        return JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
      }
    } catch (e) {
      console.error('[LicenseGuard] Erro ao carregar sync_license.json:', e.message);
    }
    return {
      ativado: false,
      chave: null,
      tenantId: null,
      machineId: null,
      modulos: {},
      dataAtivacao: null,
      dataExpiracao: null,
      status: 'pendente_ativacao', // 'ativo' | 'carencia_tamper' | 'quarentena_30d' | 'bloqueado'
      carenciaTamperAte: null,
      quarentenaAte: null,
      tentativasTamper: []
    };
  }

  saveState() {
    try {
      fs.writeFileSync(this.licenseFile, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (e) {
      console.error('[LicenseGuard] Erro ao salvar sync_license.json:', e.message);
    }
  }

  /**
   * Captura a impressão digital do hardware (Motherboard UUID + CPU + MACs)
   */
  getHardwareFingerprint() {
    if (this.cachedFingerprint) return this.cachedFingerprint;

    let rawId = '';
    // Tenta coletar UUID da placa-mãe no Windows
    if (process.platform === 'win32') {
      try {
        const out = execSync('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString();
        const lines = out.split(/\r?\n/).map(l => l.trim()).filter(l => l && l !== 'UUID');
        if (lines.length > 0) rawId += lines[0] + '-';
      } catch (e) {}
    }

    // Coleta MAC addresses de interfaces de rede físicas
    const ifaces = os.networkInterfaces();
    const macs = [];
    for (const name in ifaces) {
      for (const net of ifaces[name]) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          macs.push(net.mac);
        }
      }
    }
    rawId += macs.sort().join('-') + '-' + os.hostname() + '-' + os.cpus()[0]?.model;

    this.cachedFingerprint = crypto.createHash('sha256').update(rawId).digest('hex').substring(0, 32).toUpperCase();
    return this.cachedFingerprint;
  }

  /**
   * Calcula hash SHA-256 dos arquivos de código vitais para auditoria
   */
  calculateCodeIntegrity() {
    const filesToAudit = ['server.js', 'main.js', 'style.css'];
    const hashes = {};

    for (const file of filesToAudit) {
      const fullPath = path.join(this.baseDir, file);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          hashes[file] = crypto.createHash('sha256').update(content).digest('hex');
        } catch (e) {
          hashes[file] = 'read_error';
        }
      }
    }

    return hashes;
  }

  /**
   * Registra e audita alterações silenciosas de código (Carência de 7 dias)
   */
  handleTamperDetected(arquivo, diffPreview = '') {
    const agora = Date.now();
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;

    if (!this.state.carenciaTamperAte) {
      this.state.carenciaTamperAte = new Date(agora + seteDiasMs).toISOString();
      this.state.status = 'carencia_tamper';
    }

    const payload = {
      tenantId: this.state.tenantId,
      chave: this.state.chave,
      machineId: this.getHardwareFingerprint(),
      hostname: os.hostname(),
      arquivo,
      diffPreview: diffPreview.substring(0, 2000),
      dataDeteccao: new Date().toISOString(),
      carenciaExpiraEm: this.state.carenciaTamperAte
    };

    this.state.tentativasTamper.push(payload);
    if (this.state.tentativasTamper.length > 20) this.state.tentativasTamper.shift();
    this.saveState();

    console.warn(`[LicenseGuard] ⚠️ Alerta: Código modificado no arquivo '${arquivo}'. Modo carência ativo até ${this.state.carenciaTamperAte}.`);
    return payload;
  }

  /**
   * Ativa a contagem regressiva de quarentena de 30 dias
   */
  triggerQuarentena30Dias(motivo = 'Licença expirada / Pendente de pagamento') {
    const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;
    if (!this.state.quarentenaAte) {
      this.state.quarentenaAte = new Date(Date.now() + trintaDiasMs).toISOString();
    }
    this.state.status = 'quarentena_30d';
    this.state.motivoQuarentena = motivo;
    this.saveState();
  }

  /**
   * Gera o HTML injetável do aviso de 30 dias para o PDV
   */
  getQuarentenaBannerData() {
    if (this.state.status !== 'quarentena_30d' || !this.state.quarentenaAte) {
      return null;
    }

    const agora = Date.now();
    const expira = new Date(this.state.quarentenaAte).getTime();
    const restanteMs = Math.max(0, expira - agora);

    const dias = Math.floor(restanteMs / (24 * 60 * 60 * 1000));
    const horas = Math.floor((restanteMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutos = Math.floor((restanteMs % (60 * 60 * 1000)) / (60 * 1000));

    return {
      ativo: true,
      dias,
      horas,
      minutos,
      dataLimite: this.state.quarentenaAte,
      mensagem: 'Conforme os Termos de Uso, todos os dados fiscais e o banco de dados deste estabelecimento serão excluídos do servidor se a licença não for regularizada.',
      telefoneSuporte: '(11) 98765-4321',
      emailSuporte: 'suporte@chefcozinha.com.br'
    };
  }
}

module.exports = LicenseGuard;
