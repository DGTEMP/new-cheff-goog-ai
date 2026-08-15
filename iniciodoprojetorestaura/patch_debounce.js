const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const debounceFunc = `
let pedidosDebounceTimeout = null;
function broadcastPedidos() {
  if (pedidosDebounceTimeout) clearTimeout(pedidosDebounceTimeout);
  pedidosDebounceTimeout = setTimeout(() => {
    db.all(\`SELECT * FROM pedidos WHERE status != 'Finalizado'\`, (e, r) => {
      if(!e) io.emit('pedidos_atualizados', r || []);
    });
  }, 300);
}

// Configurações e Produtos com cache
let lastProdutos = null;
let lastConfig = null;
`;

code = code.replace('const mesasFechando = new Set();', 'const mesasFechando = new Set();\n' + debounceFunc);

// Replace instances
code = code.replace(/db\.all\(`SELECT \* FROM pedidos WHERE status \!= 'Finalizado'`, \(e, r\) => io\.emit\('pedidos_atualizados', r \|\| \[\]\)\);/g, 'broadcastPedidos();');
code = code.replace(/db\.all\(`SELECT \* FROM pedidos`, \(e, r\) => io\.emit\('pedidos_atualizados', r \|\| \[\]\)\);/g, 'broadcastPedidos();');
code = code.replace(/io\.emit\('pedidos_atualizados'\);/g, 'broadcastPedidos();');

// Optional: cache produtos
// ... keeping it simple for now as requested.

fs.writeFileSync('server.js', code);
console.log('Debounce patched successfully');
