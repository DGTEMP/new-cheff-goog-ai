const fs = require('fs');

let js = fs.readFileSync('painel-funcionario.js', 'utf8');

// I will re-inject the removed lines safely
const removedLines = `
// Ponto
const btnPonto = document.getElementById('btn-ponto');
const workStatus = document.getElementById('work-status');

btnPonto.onclick = () => {
  if (!currentUser) return;
  const acao = currentStatus === 'fora' ? 'entrada' : 'saida';
  abrirScanner(acao);
};

socket.on('ponto_registrado', ({ acao }) => {
  if (acao === 'entrada') {
    alert('Entrada registrada com sucesso!');
`;

// It looks like it replaced the whole block with nothing!
// Let's find "document.getElementById('btn-logout').onclick = () => { ... };"
// and insert after it.

js = js.replace(/window\.location\.reload\(\);\s*\}\s*else\s*\{/g, 
  "window.location.reload();\n};\n" + removedLines + "\n  } else {");

fs.writeFileSync('painel-funcionario.js', js, 'utf8');
console.log("Repaired JS");
