/**
 * ══════════════════════════════════════════════════════════════════
 * 🛡️ CHEF COZINHA - LICENSE GUARD & SYNCCHEFF PROVISIONING
 * ══════════════════════════════════════════════════════════════════
 * - Online: Auto-preenche restaurante, funcionários, mesas, produtos, módulos
 * - Offline: Modo de emergência (Apenas PDV + 1 dispositivo, sem PWA)
 * - Auto-destruição / Bloqueio rígido em 7 dias se nunca conectou à internet
 * - Desbloqueio e provisionamento automático assim que a internet conectar
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

    this.iniciarMonitorConexao();
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
      status: 'pendente_ativacao', // 'ativo' | 'offline_restrito_7d' | 'destruido_7d' | 'quarentena_30d' | 'bloqueado'
      modoOfflineRestrito: false,
      limiteDispositivos: 999,
      pwaLiberado: false,
      autoDestruicaoEm: null,
      dadosRestaurante: null,
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

  getHardwareFingerprint() {
    if (this.cachedFingerprint) return this.cachedFingerprint;

    let rawId = '';
    if (process.platform === 'win32') {
      try {
        const out = execSync('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString();
        const lines = out.split(/\r?\n/).map(l => l.trim()).filter(l => l && l !== 'UUID');
        if (lines.length > 0) rawId += lines[0] + '-';
      } catch (e) {}
    }

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
   * Inicialização e ativação da chave no instalador
   */
  async processarInstalacaoInicial(chave, dbInstance) {
    this.state.chave = chave;
    this.state.machineId = this.getHardwareFingerprint();

    // 1. Tenta validar Online na central
    try {
      const response = await fetch(`${this.centralServerUrl}/api/licenca/validar-instalacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave,
          machineId: this.state.machineId,
          hostname: os.hostname()
        }),
        signal: AbortSignal.timeout(6000)
      });

      const data = await response.json();
      if (data && data.ok) {
        // ONLINE COMPLETO: Preenche todos os dados e libera 100%
        this.state.ativado = true;
        this.state.status = 'ativo';
        this.state.modoOfflineRestrito = false;
        this.state.limiteDispositivos = data.limiteDispositivos || 999;
        this.state.pwaLiberado = true;
        this.state.autoDestruicaoEm = null;
        this.state.tenantId = data.tenantId;
        this.state.modulos = data.modulos || {};
        this.state.dadosRestaurante = data.restaurante || {};
        this.state.dataAtivacao = new Date().toISOString();
        this.saveState();

        // Popula o banco de dados com os dados baixados da chave
        if (data.payloadCompleto && dbInstance) {
          await this.aplicarProvisionamentoBanco(dbInstance, data.payloadCompleto);
        }

        console.log(`[LicenseGuard] 🚀 Instalação ONLINE concluída com sucesso para o restaurante '${data.restaurante?.nome || chave}'!`);
        return { sucesso: true, modo: 'online', dados: data };
      }
    } catch (netErr) {
      console.warn('[LicenseGuard] Sem conexão com a central. Ativando modo offline restrito (7 dias)...');
    }

    // 2. MODO OFFLINE RESTRITO DE EMERGÊNCIA (7 DIAS)
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
    this.state.ativado = true;
    this.state.status = 'offline_restrito_7d';
    this.state.modoOfflineRestrito = true;
    this.state.limiteDispositivos = 1; // Apenas o PDV + 1 aparelho
    this.state.pwaLiberado = false;   // Sem PWA até conectar
    this.state.autoDestruicaoEm = new Date(Date.now() + seteDiasMs).toISOString();
    this.state.dataAtivacao = new Date().toISOString();
    this.saveState();

    console.warn(`[LicenseGuard] ⚠️ Modo Offline Restrito ativado. Prazo limite de validação: ${this.state.autoDestruicaoEm} (7 dias).`);
    return {
      sucesso: true,
      modo: 'offline_restrito',
      mensagem: 'Instalação inicial em modo offline de emergência. Conecte à internet em até 7 dias para desbloquear todos os módulos.',
      autoDestruicaoEm: this.state.autoDestruicaoEm,
      limiteDispositivos: 1
    };
  }

  /**
   * Monitor que detecta volta da internet e faz o provisionamento completo pendente
   */
  iniciarMonitorConexao() {
    setInterval(async () => {
      // Se estiver no modo offline restrito, tenta conectar na central
      if (this.state.status === 'offline_restrito_7d') {
        const agora = Date.now();
        const limite = new Date(this.state.autoDestruicaoEm).getTime();

        // Se estourou 7 dias sem internet, bloqueia / auto-destrói
        if (agora >= limite) {
          this.state.status = 'destruido_7d';
          this.state.ativado = false;
          this.saveState();
          console.error('[LicenseGuard] 🚫 Auto-destruição ativada: 7 dias expirados sem conexão com a central.');
          return;
        }

        // Tenta sincronizar agora que a internet pode ter voltado
        try {
          const res = await fetch(`${this.centralServerUrl}/api/licenca/validar-instalacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chave: this.state.chave,
              machineId: this.getHardwareFingerprint(),
              hostname: os.hostname()
            }),
            signal: AbortSignal.timeout(8000)
          });

          const data = await res.json();
          if (data && data.ok) {
            this.state.status = 'ativo';
            this.state.modoOfflineRestrito = false;
            this.state.limiteDispositivos = data.limiteDispositivos || 999;
            this.state.pwaLiberado = true;
            this.state.autoDestruicaoEm = null;
            this.state.tenantId = data.tenantId;
            this.state.modulos = data.modulos || {};
            this.saveState();
            console.log('[LicenseGuard] ✅ Conexão restabelecida! Instalação e chave desbloqueadas 100%!');
          }
        } catch (e) {}
      }
    }, 30000); // Testa a cada 30 segundos
  }

  /**
   * Popula banco local com o catálogo/dados da nuvem
   */
  async aplicarProvisionamentoBanco(dbInstance, payload) {
    if (!dbInstance || !payload) return;
    try {
      dbInstance.serialize(() => {
        // Popula dados do restaurante
        if (payload.restaurante) {
          const r = payload.restaurante;
          dbInstance.run(
            `INSERT INTO configuracoes (nome_restaurante, cnpj, telefone, endereco) VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET nome_restaurante = excluded.nome_restaurante, cnpj = excluded.cnpj, telefone = excluded.telefone, endereco = excluded.endereco`,
            [r.nome, r.cnpj, r.telefone, r.endereco]
          );
        }
        // Popula mesas se houver
        if (Array.isArray(payload.mesas)) {
          for (const m of payload.mesas) {
            dbInstance.run(`INSERT OR IGNORE INTO mesas (nome, status) VALUES (?, 'Livre')`, [m.nome || m]);
          }
        }
        // Popula funcionários se houver
        if (Array.isArray(payload.funcionarios)) {
          for (const f of payload.funcionarios) {
            dbInstance.run(`INSERT OR IGNORE INTO funcionarios (nome, pin, cargo) VALUES (?, ?, ?)`, [f.nome, f.pin, f.cargo || 'Garçom']);
          }
        }
        // Popula produtos se houver
        if (Array.isArray(payload.produtos)) {
          for (const p of payload.produtos) {
            dbInstance.run(
              `INSERT OR IGNORE INTO produtos (nome, categoria, preco, descricao, imagem) VALUES (?, ?, ?, ?, ?)`,
              [p.nome, p.categoria || 'Geral', p.preco || 0, p.descricao || '', p.imagem || '']
            );
          }
        }
      });
      console.log('[LicenseGuard] ✅ Banco SQLite local populado com o pacote da chave!');
    } catch (e) {
      console.error('[LicenseGuard] Erro ao provisionar banco:', e.message);
    }
  }

  getQuarentenaBannerData() {
    if (this.state.status === 'destruido_7d') {
      return {
        ativo: true,
        bloqueioTotal: true,
        mensagem: 'Instalação expirada. É necessária conexão com a internet para validar a chave de licença.',
        telefoneSuporte: '(11) 98765-4321'
      };
    }

    if (this.state.status === 'offline_restrito_7d' && this.state.autoDestruicaoEm) {
      const agora = Date.now();
      const expira = new Date(this.state.autoDestruicaoEm).getTime();
      const restanteMs = Math.max(0, expira - agora);

      const dias = Math.floor(restanteMs / (24 * 60 * 60 * 1000));
      const horas = Math.floor((restanteMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

      return {
        ativo: true,
        modoOfflineRestrito: true,
        dias,
        horas,
        mensagem: `Modo de emergência (1 dispositivo). Conecte à internet em até ${dias} dias para desbloquear todos os módulos e o cardápio PWA.`,
        telefoneSuporte: '(11) 98765-4321'
      };
    }

    return null;
  }
}

module.exports = LicenseGuard;
