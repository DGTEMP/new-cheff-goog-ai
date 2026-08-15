const fs = require('fs');
const path = require('path');

const files = [
  'index.html',
  'dashboard.html',
  'financeiro.html',
  'configuracoes.html',
  'fila-pedidos.html',
  'garcom.html'
];

files.forEach(file => {
  const filepath = path.join(__dirname, file);
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf8');
    if (!content.includes('src="/auth.js"')) {
      content = content.replace('</head>', '  <script type="module" src="/auth.js"></script>\n</head>');
      fs.writeFileSync(filepath, content, 'utf8');
      console.log('Injetado auth.js em', file);
    } else if (content.includes('<script src="/auth.js"></script>')) {
      content = content.replace('<script src="/auth.js"></script>', '<script type="module" src="/auth.js"></script>');
      fs.writeFileSync(filepath, content, 'utf8');
      console.log('Atualizado auth.js para module em', file);
    }
  }
});
