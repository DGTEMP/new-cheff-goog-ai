const fs = require('fs');

let js = fs.readFileSync('painel-funcionario.js', 'utf8');

// Replace the old scanner logic with the new direct API logic
const oldLogicPattern = /let html5QrcodeScanner = null;[\s\S]*?ignore scanning errors \(happens constantly while looking for qr code\)\s*\}\);\s*\}/;

const newLogic = `
let html5QrCode = null;

window.fecharScannerPonto = function() {
  document.getElementById('modal-qr-scanner').style.display = 'none';
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      html5QrCode = null;
    }).catch(e => console.error("Falha ao parar scanner", e));
  }
};

function abrirScanner(acao) {
  document.getElementById('modal-qr-scanner').style.display = 'flex';
  
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("qr-reader");
  }

  html5QrCode.start(
    { facingMode: "environment" }, // Tenta usar a câmera traseira automaticamente
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    (decodedText, decodedResult) => {
      // Quando lê com sucesso
      try {
        const url = new URL(decodedText);
        const t = url.searchParams.get('t');
        if (t) {
          fecharScannerPonto();
          socket.emit('bater_ponto', { funcionario_id: currentUser.id, acao, token: t });
        } else {
          fecharScannerPonto();
          alert("QR Code inválido. Token não encontrado.");
        }
      } catch(e) {
        fecharScannerPonto();
        alert("QR Code não reconhecido. Certifique-se de escanear o código correto.");
      }
    },
    (errorMessage) => {
      // ignore
    }
  ).catch(err => {
    alert("Erro ao acessar a câmera. Verifique se deu permissão ao navegador.");
    fecharScannerPonto();
  });
}
`;

if (js.match(oldLogicPattern)) {
    js = js.replace(oldLogicPattern, newLogic);
    fs.writeFileSync('painel-funcionario.js', js, 'utf8');
    console.log("Scanner atualizado com sucesso!");
} else {
    console.log("Padrão antigo não encontrado. Vou tentar substituir tudo após a linha 74.");
    // Emergency replacement if regex fails
    const parts = js.split("let html5QrcodeScanner = null;");
    if(parts.length > 1) {
       js = parts[0] + newLogic;
       fs.writeFileSync('painel-funcionario.js', js, 'utf8');
       console.log("Scanner atualizado via fallback!");
    } else {
       console.log("Falha ao encontrar o scanner.");
    }
}
