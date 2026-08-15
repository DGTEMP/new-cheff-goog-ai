const fs = require('fs');

let garcomJs = fs.readFileSync('garcom.js', 'utf8');

// Update item display to show unit price
garcomJs = garcomJs.replace(
  /const precoItemStr = \`R\$ \$\{\(item\.totalVal\)\.toFixed\(2\)\.replace\('\.', ','\)\}\`;/g,
  "const precoUnitario = (item.totalVal / item.qty) || 0;\n       const precoItemStr = `R$ ${(item.totalVal).toFixed(2).replace('.', ',')}`;"
);

garcomJs = garcomJs.replace(
  /<span>\$\{item\.name\}<\/span>/g,
  "<span>${item.name} <small style=\"color: #999;\">(R$ ${precoUnitario.toFixed(2).replace('.', ',')})</small></span>"
);

// Remove the Taxa de Serviço line and update Total text
garcomJs = garcomJs.replace(
  /<div style="display: flex; justify-content: space-between; font-size: 14px; color: #fc4b15; margin-bottom: 5px;">\s*<span>Taxa de Servio \(\$\{((?:multiplier - 1\.0)\*100)\.toFixed\(0\)\}%(?:| - Opcional)\):<\/span>\s*<span>R\$ \$\{serviceFee\.toFixed\(2\)\.replace\('\.', ','\)\}<\/span>\s*<\/div>/g,
  ""
);

// Fallback replacement if the first one fails due to formatting/accents:
garcomJs = garcomJs.replace(/<div style="display: flex; justify-content: space-between; font-size: 14px; color: #fc4b15; margin-bottom: 5px;">\s*<span>Taxa de Servi.*?<\/div>/s, '');

garcomJs = garcomJs.replace(
  /<span>Total a Pagar:<\/span>/g,
  "<span>Total a Pagar <small style=\"font-size: 12px; color: #888; font-weight: normal;\">(inclui 10%)</small>:</span>"
);

// Also add an "Adicionar Itens" button in the PDV right panel?
// No, the user said "quando eu clicar para selecionar uma mesa e em seguida Abrir / Adicionar eu quero adicionar itens na mesa selecionada em questão"
// Let's also fix the mesaAtual losing selection on socket update in main.js
let mainJs = fs.readFileSync('main.js', 'utf8');
mainJs = mainJs.replace(
  /const card = document\.getElementById\(`mesa-card-\$\{window\.mesaAtual\.uid\}`\);\s*if \(card\) card\.click\(\);/g,
  "const card = Array.from(document.querySelectorAll('.mesa-item')).find(c => c.querySelector('.mesa-nome') && c.querySelector('.mesa-nome').innerText === window.mesaAtual.mesaName || c.querySelector('.mesa-nome') && c.querySelector('.mesa-nome').innerText === window.mesaAtual.nome);\n      if (card) card.click();"
);

fs.writeFileSync('garcom.js', garcomJs);
fs.writeFileSync('main.js', mainJs);
console.log('Scripts atualizados com sucesso!');
