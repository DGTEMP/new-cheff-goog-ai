/**
 * generate-key.js
 * CLI & Módulo para geração de chaves e pacotes de licença do Chef Cozinha.
 * Uso CLI: node generate-key.js --restaurante "Restaurante Exemplo" --dias 365 --plano pro
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET_SALT = 'CHEF-COZINHA-LICENSE-SECRET-KEY-2026';

/**
 * Gera um código de chave no formato CHEF-XXXX-YYYY-ZZZZ
 */
function gerarCodigoChave() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evita I, O, 0, 1 para evitar ambiguidade
  let part = (len) => {
    let str = '';
    for (let i = 0; i < len; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  };
  return `CHEF-${part(4)}-${part(4)}-${part(4)}`;
}

/**
 * Gera assinatura HMAC para validação offline sem servidor
 */
function assinarLicencaOffline(payload) {
  const dataStr = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', SECRET_SALT);
  hmac.update(dataStr);
  const signature = hmac.digest('hex');
  return {
    ...payload,
    signature
  };
}

/**
 * Valida se um pacote offline possui assinatura válida
 */
function validarLicencaOffline(payloadComAssinatura) {
  if (!payloadComAssinatura || !payloadComAssinatura.signature) return false;
  const { signature, ...payload } = payloadComAssinatura;
  const dataStr = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', SECRET_SALT);
  hmac.update(dataStr);
  const expectedSig = hmac.digest('hex');
  return signature === expectedSig;
}

/**
 * Função principal de geração
 */
function criarLicenca(opts = {}) {
  const restaurante = opts.restaurante || 'Restaurante Exemplo';
  const plano       = opts.plano || 'pro'; // starter | pro | enterprise
  const dias        = parseInt(opts.dias) || 365;
  const maxDisp     = parseInt(opts.maxDisp) || 0; // 0 = ilimitado
  const obs         = opts.obs || 'Emitido via Gerador Chef Cozinha';

  const chave = gerarCodigoChave();
  const agora = new Date();
  const validade = new Date(agora.getTime() + (dias * 24 * 60 * 60 * 1000));

  const licData = {
    chave,
    restaurante,
    plano,
    maxDispositivos: maxDisp,
    emitidoEm: agora.toISOString(),
    validade: validade.toISOString(),
    dias,
    obs
  };

  const offlinePayload = assinarLicencaOffline(licData);
  const offlineToken = Buffer.from(JSON.stringify(offlinePayload)).toString('base64');

  return {
    ok: true,
    chave,
    restaurante,
    plano,
    validade: validade.toISOString().split('T')[0],
    dias,
    maxDispositivos: maxDisp,
    offlineToken,
    offlinePayload
  };
}

// Execução CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const parseArg = (flag, def) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
  };

  const restaurante = parseArg('--restaurante', 'Restaurante Exemplo');
  const plano       = parseArg('--plano', 'pro');
  const dias        = parseArg('--dias', '365');
  const maxDisp     = parseArg('--maxDisp', '0');

  const resultado = criarLicenca({ restaurante, plano, dias, maxDisp });

  console.log('\n======================================================');
  console.log('       CHEF COZINHA — CHAVE DE LICENÇA GERADA');
  console.log('======================================================');
  console.log(`🔑 Chave de Ativação:  ${resultado.chave}`);
  console.log(`🏪 Restaurante:        ${resultado.restaurante}`);
  console.log(`📦 Plano:              ${resultado.plano.toUpperCase()}`);
  console.log(`📅 Validade:           ${resultado.validade} (${resultado.dias} dias)`);
  console.log(`📱 Dispositivos:       ${resultado.maxDispositivos === 0 ? 'Ilimitados' : resultado.maxDispositivos}`);
  console.log('------------------------------------------------------');
  console.log(`🔒 Token Offline (Base64):\n${resultado.offlineToken}`);
  console.log('======================================================\n');
}

module.exports = {
  gerarCodigoChave,
  assinarLicencaOffline,
  validarLicencaOffline,
  criarLicenca
};
