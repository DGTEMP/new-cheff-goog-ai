const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const textToReplace = "      valor TEXT\r\n    )\r\n  `);\r\n\r\n  // Inserir um cupom de teste inicial";
const textToReplaceLF = "      valor TEXT\n    )\n  `);\n\n  // Inserir um cupom de teste inicial";

if (content.includes(textToReplace)) {
  content = content.replace(textToReplace, "  // Inserir um cupom de teste inicial");
  fs.writeFileSync('server.js', content, 'utf8');
  console.log("Deleted garbage lines (CRLF)!");
} else if (content.includes(textToReplaceLF)) {
  content = content.replace(textToReplaceLF, "  // Inserir um cupom de teste inicial");
  fs.writeFileSync('server.js', content, 'utf8');
  console.log("Deleted garbage lines (LF)!");
} else {
  console.log("Could not find garbage lines to replace!");
}
