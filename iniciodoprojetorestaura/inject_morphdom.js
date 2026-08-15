const fs = require('fs');
const files = ['index.html', 'garcom.html', 'fila-pedidos.html'];

files.forEach(file => {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes('morphdom')) {
    text = text.replace('</head>', '  <script src="https://cdn.jsdelivr.net/npm/morphdom@2.7.2/dist/morphdom-umd.min.js"></script>\n</head>');
    fs.writeFileSync(file, text);
    console.log(`Added morphdom to ${file}`);
  }
});
