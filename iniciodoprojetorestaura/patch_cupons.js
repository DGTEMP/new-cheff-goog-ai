const fs = require('fs');

// --- 1. Patch server.js ---
let server = fs.readFileSync('server.js', 'utf8');

const serverLogic = `
  // -- CRIAR CUPOM --
  socket.on('criar_cupom', (data) => {
    const itensStr = JSON.stringify(data.itens);
    db.run("INSERT INTO cupons (codigo, itens_json, usado) VALUES (?, ?, 0)", [data.codigo, itensStr], function(err) {
      if (err) {
         socket.emit('cupom_criado_error', 'Código já existe ou erro no banco.');
      } else {
         socket.emit('cupom_criado_sucesso', { codigo: data.codigo, itens: data.itens });
      }
    });
  });
`;

if (!server.includes("socket.on('criar_cupom'")) {
  server = server.replace("io.on('connection', (socket) => {", "io.on('connection', (socket) => {" + serverLogic);
  fs.writeFileSync('server.js', server, 'utf8');
  console.log("Server patched.");
}

// --- 2. Patch configuracoes.html ---
let html = fs.readFileSync('configuracoes.html', 'utf8');

const geradorUI = `
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
              <h4 style="margin-top:0; margin-bottom: 10px; color: #166534;"><i class="ph ph-qr-code"></i> Gerador de Cupons QR Code</h4>
              <p style="font-size: 13px; color: #15803d; margin-bottom: 10px;">Crie cupons físicos ou digitais para distribuir aos clientes. O garçom pode escaneá-los para resgatar os produtos na mesa.</p>
              
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-bottom: 10px;">
                 <input type="text" id="admin-cupom-codigo" placeholder="Cód (Ex: VIP123 ou deixe vazio p/ aleatório)" style="padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                 <input type="text" id="admin-cupom-produto" placeholder="Nome do Produto (Ex: 1x Cerveja 600ml)" style="padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
              </div>
              <button class="btn-action" style="background: #22c55e; color: white; border: none; padding: 10px 15px; font-weight: bold; border-radius: 6px;" onclick="window.gerarCupomQr()">
                <i class="ph ph-plus-circle"></i> Gerar Cupom e QR Code
              </button>
              
              <div id="cupom-qr-result" style="margin-top: 15px; display: none; flex-direction: column; align-items: center; background: white; padding: 20px; border-radius: 8px; border: 2px dashed #ccc;">
                  <h3 style="margin:0 0 10px 0; color: #333;" id="cupom-qr-title"></h3>
                  <img id="cupom-qr-image" src="" alt="QR Code" style="width: 200px; height: 200px; margin-bottom: 15px;">
                  <p style="font-size: 24px; font-weight: bold; margin: 0 0 15px 0; letter-spacing: 2px; color: #fc4b15;" id="cupom-qr-code-text"></p>
                  <button onclick="window.printCupom()" style="padding: 10px 20px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;"><i class="ph ph-printer"></i> Imprimir Cupom</button>
              </div>
            </div>
`;

if (!html.includes('Gerador de Cupons QR Code')) {
  // Insert before the existing "Nova Promoção Avançada" block in tab-promocoes
  html = html.replace('<div id="admin-tab-promocoes" class="admin-tab-content" style="display: none;">', 
    '<div id="admin-tab-promocoes" class="admin-tab-content" style="display: none;">\n' + geradorUI);
  fs.writeFileSync('configuracoes.html', html, 'utf8');
  console.log("HTML patched.");
}

// --- 3. Patch configuracoes.js ---
let js = fs.readFileSync('configuracoes.js', 'utf8');

const jsLogic = `
window.gerarCupomQr = () => {
    let codigo = document.getElementById('admin-cupom-codigo').value.trim().toUpperCase();
    const produto = document.getElementById('admin-cupom-produto').value.trim();

    if (!produto) return alert("Digite qual produto o cupom dará direito.");
    if (!codigo) {
        codigo = 'PROMO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const itens = [
        {
            nome: produto,
            emoji: "🎁",
            quantity: 1,
            sector: "Bar" // Default
        }
    ];

    socket.emit('criar_cupom', { codigo, itens });
};

socket.on('cupom_criado_error', (msg) => alert(msg));
socket.on('cupom_criado_sucesso', (data) => {
    const resDiv = document.getElementById('cupom-qr-result');
    document.getElementById('cupom-qr-title').innerText = data.itens[0].nome;
    document.getElementById('cupom-qr-code-text').innerText = data.codigo;
    document.getElementById('cupom-qr-image').src = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(data.codigo);
    
    resDiv.style.display = 'flex';
    document.getElementById('admin-cupom-codigo').value = '';
    document.getElementById('admin-cupom-produto').value = '';
});

window.printCupom = () => {
    const titulo = document.getElementById('cupom-qr-title').innerText;
    const cod = document.getElementById('cupom-qr-code-text').innerText;
    const imgSrc = document.getElementById('cupom-qr-image').src;
    
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(\`
      <html><head><style>
        body { font-family: monospace; text-align: center; margin: 0; padding: 20px; }
        .bold { font-weight: bold; }
      </style></head><body>
        <div class="bold" style="font-size:20px; margin-bottom:10px;">CHEF COZINHA</div>
        <div style="font-size:16px; margin-bottom:15px;">VALE PRESENTE / CORTESIA</div>
        <div class="bold" style="font-size:18px; margin-bottom:20px;">\${titulo}</div>
        <img src="\${imgSrc}" style="width: 200px; height: 200px; margin-bottom: 10px;">
        <div style="font-size:24px; font-weight:bold; margin-bottom:20px;">\${cod}</div>
        <div style="font-size:12px; margin-top:30px;">Apresente este QR Code para o garçom no momento do pedido.</div>
        <div style="font-size:10px; margin-top:5px; color:#666;">Uso único e intransferível.</div>
      </body></html>
    \`);
    w.document.close();
    setTimeout(() => { w.print(); }, 1000);
};
`;

if (!js.includes('gerarCupomQr')) {
  js += '\n' + jsLogic;
  fs.writeFileSync('configuracoes.js', js, 'utf8');
  console.log("JS patched.");
}
