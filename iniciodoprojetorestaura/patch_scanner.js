const fs = require('fs');

// --- 1. Patch painel-funcionario.html ---
let html = fs.readFileSync('painel-funcionario.html', 'utf8');

// Include script
if (!html.includes('html5-qrcode')) {
  html = html.replace('</body>', '  <script src="https://unpkg.com/html5-qrcode"></script>\n</body>');
}

// Include Modal UI
const qrModal = `
  <!-- QR SCANNER MODAL -->
  <div class="modal-overlay" id="modal-qr-scanner" style="display: none; z-index: 10000; padding:20px;">
    <div class="modal" style="width: 100%; max-width: 400px; padding: 20px; text-align:center;">
      <div class="modal-header">
        <h3 style="margin: 0; display:flex; align-items:center; gap:8px;"><i class="ph ph-camera"></i> Escanear Ponto</h3>
        <button class="modal-close" onclick="fecharScannerPonto()"><i class="ph ph-x"></i></button>
      </div>
      <p style="font-size:14px; color:#666; margin-bottom:15px;">Aponte a câmera para o QR Code na tela do Caixa Principal.</p>
      <div id="qr-reader" style="width: 100%; margin: 0 auto;"></div>
      <button class="btn-action" onclick="fecharScannerPonto()" style="margin-top:15px; width:100%; justify-content:center; padding:12px;">Cancelar</button>
    </div>
  </div>
`;

if (!html.includes('modal-qr-scanner')) {
  html = html.replace('</body>', qrModal + '\n</body>');
  fs.writeFileSync('painel-funcionario.html', html, 'utf8');
  console.log("HTML Patched!");
}

// --- 2. Patch painel-funcionario.js ---
let js = fs.readFileSync('painel-funcionario.js', 'utf8');

const jsScannerLogic = `
let html5QrcodeScanner = null;

window.fecharScannerPonto = function() {
  document.getElementById('modal-qr-scanner').style.display = 'none';
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(e => console.error("Falha ao limpar scanner", e));
  }
};

function abrirScanner(acao) {
  document.getElementById('modal-qr-scanner').style.display = 'flex';
  if (!html5QrcodeScanner) {
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
  }
  html5QrcodeScanner.render((decodedText, decodedResult) => {
    // Decoded text is usually the URL: https://ip:5173/painel-funcionario.html?t=XXXXX
    try {
      const url = new URL(decodedText);
      const t = url.searchParams.get('t');
      if (t) {
        fecharScannerPonto();
        socket.emit('bater_ponto', { funcionario_id: currentUser.id, acao, token: t });
      } else {
        alert("QR Code inválido. Token não encontrado.");
      }
    } catch(e) {
      alert("QR Code não reconhecido. Certifique-se de escanear o código correto.");
    }
  }, (errorMessage) => {
    // ignore scanning errors (happens constantly while looking for qr code)
  });
}
`;

if (!js.includes('html5QrcodeScanner')) {
  js += '\n' + jsScannerLogic;
  
  // Replace the alert with the scanner trigger
  js = js.replace(
    "if (!token) return alert('Você precisa escanear o QR Code no Caixa para bater o ponto e validar sua presença!');\n    socket.emit('bater_ponto', { funcionario_id: currentUser.id, acao, token });",
    `if (!token) {
      abrirScanner(acao);
      return;
    }
    socket.emit('bater_ponto', { funcionario_id: currentUser.id, acao, token });`
  );

  // Fallback if the replacement failed due to encoding or small differences
  if (!js.includes('abrirScanner(acao)')) {
    // Regex replace
    js = js.replace(/if\s*\(!token\)\s*return\s*alert\([^;]+;\s*socket\.emit\('bater_ponto',\s*\{\s*funcionario_id:\s*currentUser\.id,\s*acao,\s*token\s*\}\);/g, 
    `if (!token) { abrirScanner(acao); return; } socket.emit('bater_ponto', { funcionario_id: currentUser.id, acao, token });`);
  }
  
  fs.writeFileSync('painel-funcionario.js', js, 'utf8');
  console.log("JS Patched!");
}
