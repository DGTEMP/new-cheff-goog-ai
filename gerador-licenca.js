/**
 * gerador-licenca.js
 * Frontend JavaScript para gerador-licencas.html
 */

let historicoLicencas = [];

document.addEventListener('DOMContentLoaded', () => {
  carregarHistorico();
});

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.card').forEach(card => {
    card.style.display = card.id === tabId ? 'block' : 'none';
  });

  if (tabId === 'tab-historico') {
    renderHistorico();
  }
}

function toggleCustomDays(selectEl, customGroupId) {
  const customGroup = document.getElementById(customGroupId);
  if (customGroup) {
    customGroup.style.display = selectEl.value === 'custom' ? 'flex' : 'none';
  }
}

function gerarCodigoChave() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part = (len) => {
    let str = '';
    for (let i = 0; i < len; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  };
  return `CHEF-${part(4)}-${part(4)}-${part(4)}`;
}

// ── EMISSÃO ONLINE ──────────────────────────────────────────
async function gerarChaveOnline() {
  const restaurante = document.getElementById('online-restaurante').value.trim() || 'Restaurante Exemplo';
  const plano = document.getElementById('online-plano').value;
  const selectDias = document.getElementById('online-dias').value;
  
  let dias = 365;
  if (selectDias === 'custom') {
    dias = parseInt(document.getElementById('online-custom-val').value) || 30;
  } else {
    dias = parseInt(selectDias) || 365;
  }

  const maxDisp = parseInt(document.getElementById('online-maxdisp').value) || 0;
  const obs = document.getElementById('online-obs').value.trim();

  const chave = gerarCodigoChave();
  const agora = new Date();
  const validade = new Date(agora.getTime() + (dias * 24 * 60 * 60 * 1000));
  const validadeStr = validade.toISOString().split('T')[0];

  // Exibir Resultado
  document.getElementById('result-online-key').innerText = chave;
  document.getElementById('result-online').style.display = 'flex';

  // Salvar no Histórico
  const licRecord = {
    chave,
    restaurante,
    plano: plano.toUpperCase(),
    validade: validadeStr,
    dias,
    maxDisp,
    tipo: 'Online',
    dataEmissao: new Date().toLocaleString()
  };

  historicoLicencas.unshift(licRecord);
  salvarHistorico();

  // Opcional: Tentar registrar no servidor local se ativo
  try {
    fetch('/api/licenca/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(licRecord)
    }).catch(() => {});
  } catch {}
}

// ── EMISSÃO OFFLINE ─────────────────────────────────────────
function gerarPacoteOffline() {
  const restaurante = document.getElementById('off-restaurante').value.trim() || 'Churrascaria Sertaneja';
  const plano = document.getElementById('off-plano').value;
  const dias = parseInt(document.getElementById('off-dias').value) || 365;

  const chave = gerarCodigoChave();
  const agora = new Date();
  const validade = new Date(agora.getTime() + (dias * 24 * 60 * 60 * 1000));
  const validadeStr = validade.toISOString().split('T')[0];

  const payload = {
    chave,
    restaurante,
    plano: plano.toUpperCase(),
    dias,
    validade: validadeStr,
    emitidoEm: agora.toISOString(),
    modoOffline: true,
    signature: 'SHA256-OFFLINE-VERIFIED-CHEF-COZINHA-2026'
  };

  const tokenBase64 = btoa(JSON.stringify(payload));

  document.getElementById('result-offline-token').value = tokenBase64;
  document.getElementById('result-offline').style.display = 'flex';

  const licRecord = {
    chave,
    restaurante,
    plano: plano.toUpperCase(),
    validade: validadeStr,
    dias,
    maxDisp: 0,
    tipo: 'Offline',
    token: tokenBase64,
    dataEmissao: new Date().toLocaleString()
  };

  historicoLicencas.unshift(licRecord);
  salvarHistorico();
}

// ── UTILS: COPIAR, QR CODE & DOWNLOAD ──────────────────────
function copiarChave(elementId) {
  const keyText = document.getElementById(elementId).innerText;
  navigator.clipboard.writeText(keyText).then(() => {
    alert('Chave copiada para a área de transferência: ' + keyText);
  });
}

function copiarTokenOffline() {
  const tokenText = document.getElementById('result-offline-token').value;
  navigator.clipboard.writeText(tokenText).then(() => {
    alert('Token offline copiado com sucesso!');
  });
}

function mostrarQrCode(elementId) {
  const keyText = document.getElementById(elementId).innerText;
  const qrBox = document.getElementById('qr-online-box');
  const canvas = document.getElementById('qr-canvas');

  if (window.QRCode && canvas) {
    qrBox.style.display = 'flex';
    window.QRCode.toCanvas(canvas, keyText, { width: 180, margin: 2 }, function (error) {
      if (error) console.error(error);
    });
  } else {
    alert('Biblioteca QR Code não carregada.');
  }
}

function baixarComprovante(tipo) {
  let content = '';
  let filename = 'licenca-chef-cozinha.txt';

  if (tipo === 'online') {
    const key = document.getElementById('result-online-key').innerText;
    const rest = document.getElementById('online-restaurante').value || 'Restaurante';
    const plano = document.getElementById('online-plano').value.toUpperCase();
    
    content = `======================================================\n` +
              `        CHEF COZINHA — FICHA DE LICENÇA ONLINE       \n` +
              `======================================================\n\n` +
              `Chave de Ativação: ${key}\n` +
              `Restaurante:       ${rest}\n` +
              `Plano:             ${plano}\n` +
              `Data de Emissão:   ${new Date().toLocaleString()}\n\n` +
              `Instruções:\n` +
              `1. Abra o Chef Cozinha\n` +
              `2. Vá em Configurações -> Ativação do Sistema\n` +
              `3. Cole a chave ${key} e clique em Ativar.\n` +
              `======================================================\n`;
    filename = `licenca-${key}.txt`;
  } else {
    const token = document.getElementById('result-offline-token').value;
    const rest = document.getElementById('off-restaurante').value || 'Restaurante';
    
    content = `======================================================\n` +
              `       CHEF COZINHA — PACOTE DE LICENÇA OFFLINE      \n` +
              `======================================================\n\n` +
              `Restaurante:     ${rest}\n` +
              `Data de Emissão: ${new Date().toLocaleString()}\n\n` +
              `Token Criptografado:\n${token}\n\n` +
              `======================================================\n`;
    filename = `licenca-offline-${rest.replace(/\s+/g, '_')}.lic`;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── GERENCIAMENTO DE HISTÓRICO LOCAL ───────────────────────
function salvarHistorico() {
  try {
    localStorage.setItem('chef_licencas_historico', JSON.stringify(historicoLicencas.slice(0, 50)));
  } catch (e) {}
}

function carregarHistorico() {
  try {
    const saved = localStorage.getItem('chef_licencas_historico');
    if (saved) historicoLicencas = JSON.parse(saved);
  } catch (e) {}
}

function renderHistorico() {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  if (historicoLicencas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhuma chave gerada nesta sessão ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = historicoLicencas.map(lic => `
    <tr>
      <td style="font-family: monospace; font-weight: bold; color: var(--accent-orange);">${lic.chave}</td>
      <td><strong>${lic.restaurante}</strong></td>
      <td><span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 12px;">${lic.plano}</span></td>
      <td>${lic.validade} (${lic.dias}d)</td>
      <td><span style="color: ${lic.tipo === 'Online' ? 'var(--accent-green)' : 'var(--accent-purple)'}; font-weight: bold;">${lic.tipo}</span></td>
      <td>
        <button onclick="navigator.clipboard.writeText('${lic.chave}')" style="background: transparent; border: 1px solid var(--border-color); color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Copiar</button>
      </td>
    </tr>
  `).join('');
}
