const fs = require('fs');

let js = fs.readFileSync('configuracoes.js', 'utf8');

const listeners = `
socket.on('cupom_criado_sucesso', (data) => {
    const resDiv = document.getElementById('cupom-qr-result');
    if(resDiv) {
        resDiv.style.display = 'flex';
        document.getElementById('cupom-qr-title').innerText = data.titulo || 'CUPOM PROMOCIONAL';
        document.getElementById('cupom-qr-code-text').innerText = data.codigo;
        
        const qrUrl = "https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=" + encodeURIComponent(data.codigo);
        document.getElementById('cupom-qr-image').src = qrUrl;
        
        alert('Cupom criado no banco! Você já pode imprimir o QR Code.');
    }
});

socket.on('cupom_criado_error', (msg) => {
    alert('Erro ao criar cupom: ' + msg);
});
`;

if (!js.includes("socket.on('cupom_criado_sucesso'")) {
    js += '\n' + listeners;
    fs.writeFileSync('configuracoes.js', js, 'utf8');
    console.log("Listeners de cupom adicionados com sucesso.");
} else {
    console.log("Listeners já existem.");
}
