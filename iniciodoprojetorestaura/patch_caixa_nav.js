const fs = require('fs');
let indexHtml = fs.readFileSync('index.html', 'utf8');

if (!indexHtml.includes('href="/garcom.html"')) {
  indexHtml = indexHtml.replace(
    /<a href="\/fila-pedidos\.html"/,
    `<a href="/garcom.html" class="toolbar-btn" style="text-decoration: none; color: inherit;" target="_blank"><i class="ph ph-device-mobile"></i> App Garçom</a>\n        <a href="/fila-pedidos.html"`
  );
  fs.writeFileSync('index.html', indexHtml);
}
console.log('Botão adicionado no index.html!');
