const fs = require('fs');

const code = fs.readFileSync('server.js', 'utf8');
const lines = code.split('\n');

const sqlConcatLines = [];
lines.forEach((line, idx) => {
  if (/(db|masterDb)\.(all|get|run|each)\s*\(\s*`[^`]*\$\{/.test(line)) {
    sqlConcatLines.push({ line: idx + 1, text: line.trim() });
  }
});

console.log('Found SQL with string interpolation:', sqlConcatLines.length);
sqlConcatLines.forEach(l => console.log(`L${l.line}: ${l.text}`));
