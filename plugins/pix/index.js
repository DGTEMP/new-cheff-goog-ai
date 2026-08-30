'use strict';
/**
 * plugin: pix — Integração Pix Completa e Gerador de QR Code Dinâmico (BR Code EMV / BACEN)
 * Vinculação automática com o valor de cada venda, comanda e mesa.
 */

function pixSanitize(texto, maxLen) {
  if (!texto) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^A-Za-z0-9 ]/g, '')   // remove caracteres especiais
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}

function pixTlv(id, valor) {
  const v = String(valor || '');
  return String(id).padStart(2, '0') + String(v.length).padStart(2, '0') + v;
}

function pixCrc16(payload) {
  let crc = 0xFFFF;
  for (const byte of Buffer.from(payload, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function montarPixPayload({ chave, nome, cidade, valor, txid, descricao }) {
  if (!chave) throw new Error('Chave Pix obrigatória.');

  // Limpeza da chave conforme tipo
  let chaveLimpa = String(chave).trim();
  
  // Tag 26: Merchant Account Information
  let gui = pixTlv('00', 'br.gov.bcb.pix') + pixTlv('01', chaveLimpa);
  if (descricao) {
    const descSanitizada = pixSanitize(descricao, 40);
    if (descSanitizada) gui += pixTlv('02', descSanitizada);
  }

  // Tag 01: 12 (Dynamic) se houver valor/txid único, 11 (Static) se geral
  const isDynamic = (valor != null && Number(valor) > 0);
  const pointOfInitiation = isDynamic ? '12' : '11';

  let payload =
    pixTlv('00', '01') +
    pixTlv('01', pointOfInitiation) +
    pixTlv('26', gui) +
    pixTlv('52', '0000') +
    pixTlv('53', '986'); // BRL

  // Tag 54: Valor da Transação (Dinâmico vinculado à venda)
  if (isDynamic) {
    const valorNum = Number(valor);
    if (Number.isFinite(valorNum) && valorNum > 0) {
      payload += pixTlv('54', valorNum.toFixed(2));
    }
  }

  // Sanitização de Nome (max 25) e Cidade (max 15)
  const nomeSanitizado = pixSanitize(nome || 'CHEF COZINHA', 25) || 'RESTAURANTE';
  const cidadeSanitizada = pixSanitize(cidade || 'BRASIL', 15) || 'BRASIL';

  // Tag 62: Additional Data Field (TXID)
  let txidLimpo = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
  if (!txidLimpo) {
    txidLimpo = isDynamic ? ('VD' + Date.now().toString(36).toUpperCase()).slice(0, 25) : '***';
  }

  payload +=
    pixTlv('58', 'BR') +
    pixTlv('59', nomeSanitizado) +
    pixTlv('60', cidadeSanitizada) +
    pixTlv('62', pixTlv('05', txidLimpo));

  // Tag 63: CRC16
  payload += '6304';
  const crc = pixCrc16(payload);
  return {
    payload: payload + crc,
    txid: txidLimpo,
    nome: nomeSanitizado,
    cidade: cidadeSanitizada,
    chave: chaveLimpa,
    valor: isDynamic ? Number(valor) : 0
  };
}

const path = require('path');

function gerarQrDataUrlServer(texto, size) {
  try {
    const qrcodePath = path.join(__dirname, '../../public/vendor/qrcode/qrcode-generator.js');
    const qrcodePathAlt = path.join(process.cwd(), 'public/vendor/qrcode/qrcode-generator.js');
    let qrLib;
    try {
      qrLib = require(qrcodePathAlt);
    } catch (e) {
      qrLib = require(qrcodePath);
    }
    const qr = qrLib(0, 'M');
    qr.addData(texto);
    qr.make();
    const sz = size || 220;
    const cell = Math.max(2, Math.floor(sz / qr.getModuleCount()));
    return qr.createDataURL(cell, 4);
  } catch (err) {
    console.warn('[Pix QR Server Generator Error]', err.message);
    return null;
  }
}

module.exports = function({ app, db, io }) {
  const PIX_CONFIG_KEYS = [
    'pix_chave',
    'pix_tipo_chave',
    'pix_nome_recebedor',
    'pix_cidade',
    'pix_txid_prefix',
    'pix_auto_qr_venda',
    'pix_ativo'
  ];

  function carregarConfigPix(callback) {
    const placeholders = PIX_CONFIG_KEYS.map(() => '?').join(',');
    db.all(`SELECT chave, valor FROM configuracoes WHERE chave IN (${placeholders})`, PIX_CONFIG_KEYS, (err, rows) => {
      if (err) return callback(err);
      const cfg = {
        pix_chave: '',
        pix_tipo_chave: 'cpf',
        pix_nome_recebedor: '',
        pix_cidade: '',
        pix_txid_prefix: 'VD',
        pix_auto_qr_venda: 'true',
        pix_ativo: 'true'
      };
      (rows || []).forEach(r => {
        cfg[r.chave] = r.valor;
      });
      callback(null, cfg);
    });
  }

  // GET /api/pix/config
  app.get('/api/pix/config', (req, res) => {
    carregarConfigPix((err, config) => {
      if (err) return res.status(500).json({ ok: false, erro: err.message });
      res.json({ ok: true, config });
    });
  });

  // POST /api/pix/config
  app.post('/api/pix/config', (req, res) => {
    const body = req.body || {};
    const entries = [];
    PIX_CONFIG_KEYS.forEach(k => {
      if (body[k] !== undefined) {
        entries.push([k, String(body[k]).trim()]);
      }
    });

    if (entries.length === 0) {
      return res.json({ ok: true, mensagem: 'Nenhuma alteração enviada.' });
    }

    let pendentes = entries.length;
    let teveErro = null;

    entries.forEach(([chave, valor]) => {
      db.run(
        `INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
        [chave, valor],
        (err) => {
          if (err) teveErro = err;
          pendentes--;
          if (pendentes === 0) {
            if (teveErro) return res.status(500).json({ ok: false, erro: teveErro.message });

            carregarConfigPix((errGet, updatedConfig) => {
              if (!errGet && io) {
                io.emit('pix_config_atualizada', updatedConfig);
                io.emit('configuracoes_atualizadas', updatedConfig);
              }
              res.json({ ok: true, mensagem: 'Configurações Pix salvas com sucesso!', config: updatedConfig });
            });
          }
        }
      );
    });
  });

  // POST /api/pix/gerar-dinamico
  app.post('/api/pix/gerar-dinamico', (req, res) => {
    const { valor, mesa, comanda_id, pedido_id, ref, txid_custom, descricao, chave_custom, nome_custom, cidade_custom } = req.body || {};
    const valorNum = parseFloat(String(valor || '0').replace(',', '.'));

    carregarConfigPix((err, cfg) => {
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const chave = (chave_custom || cfg.pix_chave || '').trim();
      if (!chave) {
        return res.status(400).json({
          ok: false,
          erro: 'Chave Pix não cadastrada. Acesse Configurações > Chave Pix para configurar.'
        });
      }

      const prefixo = (cfg.pix_txid_prefix || 'VD').replace(/[^A-Za-z0-9]/g, '').slice(0, 5) || 'VD';
      let txid = txid_custom || ref || '';
      if (!txid) {
        if (comanda_id) txid = `${prefixo}CMD${comanda_id}`;
        else if (mesa) txid = `${prefixo}M${String(mesa).replace(/[^A-Za-z0-9]/g, '')}`;
        else if (pedido_id) txid = `${prefixo}PED${pedido_id}`;
        else txid = `${prefixo}${Date.now().toString(36).toUpperCase()}`;
      }
      txid = txid.slice(0, 25);

      try {
        const resultado = montarPixPayload({
          chave,
          nome: nome_custom || cfg.pix_nome_recebedor || 'CHEF COZINHA',
          cidade: cidade_custom || cfg.pix_cidade || 'BRASIL',
          valor: valorNum > 0 ? valorNum : null,
          txid,
          descricao: descricao || (mesa ? `Mesa ${mesa}` : 'Venda Chef Cozinha')
        });

        const qrCodeDataUrl = gerarQrDataUrlServer(resultado.payload, 240);

        res.json({
          ok: true,
          payload: resultado.payload,
          qrCodeDataUrl,
          valor: resultado.valor,
          txid: resultado.txid,
          nome: resultado.nome,
          cidade: resultado.cidade,
          chave: resultado.chave,
          mesa: mesa || null,
          comanda_id: comanda_id || null
        });
      } catch (e) {
        res.status(400).json({ ok: false, erro: 'Falha ao gerar Pix dinâmico: ' + e.message });
      }
    });
  });

  // GET /api/pix/copiacola (compatibilidade com frontend existente)
  app.get('/api/pix/copiacola', (req, res) => {
    const valor = parseFloat(String(req.query.valor || '').replace(',', '.'));
    const mesaRef = String(req.query.mesa || '').slice(0, 40);
    const refParam = String(req.query.ref || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25);

    carregarConfigPix((err, cfg) => {
      if (err) return res.json({ ok: false, erro: err.message });
      const chave = String(cfg.pix_chave || '').trim();
      if (!chave) {
        return res.json({
          ok: false,
          erro: 'Chave Pix não configurada. Defina em Configurações > Chave Pix & QR Code Dinâmico.'
        });
      }

      let txid = refParam;
      if (!txid) {
        const prefixo = (cfg.pix_txid_prefix || 'VD').replace(/[^A-Za-z0-9]/g, '').slice(0, 5) || 'VD';
        txid = `${prefixo}${Date.now().toString(36).toUpperCase()}`.slice(0, 25);
      }

      try {
        const resultado = montarPixPayload({
          chave,
          nome: cfg.pix_nome_recebedor || '',
          cidade: cfg.pix_cidade || '',
          valor: Number.isFinite(valor) && valor > 0 ? valor : null,
          txid,
          descricao: mesaRef ? `Mesa ${mesaRef}` : 'Venda'
        });

        const qrCodeDataUrl = gerarQrDataUrlServer(resultado.payload, 240);

        res.json({
          ok: true,
          payload: resultado.payload,
          qrCodeDataUrl,
          valor: resultado.valor,
          txid: resultado.txid,
          mesa: mesaRef
        });
      } catch (e) {
        res.json({ ok: false, erro: 'Falha ao gerar Pix: ' + e.message });
      }
    });
  });

  // Socket handlers para sincronização em tempo real
  if (io) {
    io.on('connection', (socket) => {
      socket.on('get_pix_config', () => {
        carregarConfigPix((err, config) => {
          if (!err) socket.emit('pix_config_atual', config);
        });
      });

      socket.on('admin_atualizar_pix_config', (cfg) => {
        if (!cfg) return;
        const entries = [];
        PIX_CONFIG_KEYS.forEach(k => {
          if (cfg[k] !== undefined) {
            entries.push([k, String(cfg[k]).trim()]);
          }
        });
        if (entries.length === 0) return socket.emit('pix_config_salvo', { success: true });

        let pendentes = entries.length;
        entries.forEach(([chave, valor]) => {
          db.run(
            `INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
            [chave, valor],
            () => {
              pendentes--;
              if (pendentes === 0) {
                carregarConfigPix((errGet, updated) => {
                  socket.emit('pix_config_salvo', { success: true, config: updated });
                  if (!errGet) socket.broadcast.emit('pix_config_atualizada', updated);
                });
              }
            }
          );
        });
      });

      socket.on('gerar_pix_venda', (dados) => {
        const { valor, mesa, comanda_id, ref } = dados || {};
        const valorNum = parseFloat(String(valor || '0').replace(',', '.'));
        carregarConfigPix((err, cfg) => {
          if (err || !cfg.pix_chave) {
            return socket.emit('pix_venda_gerado', { ok: false, erro: 'Chave Pix não configurada.' });
          }
          try {
            const prefixo = (cfg.pix_txid_prefix || 'VD').replace(/[^A-Za-z0-9]/g, '').slice(0, 5) || 'VD';
            const txid = ref || `${prefixo}${Date.now().toString(36).toUpperCase()}`.slice(0, 25);
            const resultado = montarPixPayload({
              chave: cfg.pix_chave,
              nome: cfg.pix_nome_recebedor,
              cidade: cfg.pix_cidade,
              valor: valorNum > 0 ? valorNum : null,
              txid,
              descricao: mesa ? `Mesa ${mesa}` : 'Venda'
            });
            const qrCodeDataUrl = gerarQrDataUrlServer(resultado.payload, 240);
            socket.emit('pix_venda_gerado', {
              ok: true,
              payload: resultado.payload,
              qrCodeDataUrl,
              valor: resultado.valor,
              txid: resultado.txid,
              mesa
            });
          } catch (e) {
            socket.emit('pix_venda_gerado', { ok: false, erro: e.message });
          }
        });
      });
    });
  }
};
