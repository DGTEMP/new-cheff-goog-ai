const fs = require('fs');

let mainJs = fs.readFileSync('main.js', 'utf8');

mainJs = mainJs.replace(
  /if \(window\.mesaAtual && item\.mesaName === window\.mesaAtual\.mesaName\) \{/g,
  "if (window.mesaAtual && (item.mesaName || item.nome) === (window.mesaAtual.mesaName || window.mesaAtual.nome)) {"
);

fs.writeFileSync('main.js', mainJs);
console.log('main.js patch aplicado para a condicional de mesaAtual!');
