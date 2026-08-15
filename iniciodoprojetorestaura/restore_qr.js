const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const qrBlock = `          
          <div id="qr-ponto-container" style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); display: flex; flex-direction: column; align-items: center; border: 1px solid #eee; margin-bottom: 15px;">
            <span style="font-size: 11px; font-weight: bold; color: var(--primary-color); margin-bottom: 5px;">Área do Colaborador</span>
            <img id="qr-ponto-img" src="" alt="QR Ponto" style="width: 100px; height: 100px;">
            <span style="font-size: 10px; color: #666; margin-top: 5px; text-align: center;">Escaneie para registrar o ponto</span>
          </div>
`;

if (!html.includes('qr-ponto-container')) {
    html = html.replace('<aside class="right-info" id="right-panel">', '<aside class="right-info" id="right-panel">\n' + qrBlock);
}

fs.writeFileSync('index.html', html);
console.log('QR Code Ponto injected!');
