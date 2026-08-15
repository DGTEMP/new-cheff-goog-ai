const fs = require('fs');
let confJs = fs.readFileSync('configuracoes.js', 'utf8');

confJs = confJs.replace(
  /if \(typeof configs\.destaques_itens === 'string'\) configs\.destaques_itens = JSON\.parse\(configs\.destaques_itens \|\| '\[\]'\);/g,
  "if (typeof configs.destaques_itens === 'string') configs.destaques_itens = JSON.parse(configs.destaques_itens || '[]');\n    if (!configs.destaques_itens) configs.destaques_itens = [];"
);

fs.writeFileSync('configuracoes.js', confJs);
console.log('Fixed destaques_itens initialization in configuracoes.js');
