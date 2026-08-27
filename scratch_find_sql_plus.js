const fs = require('fs');

const code = fs.readFileSync('server.js', 'utf8');
const lines = code.split('\n');

const sqlPlusLines = [];
lines.forEach((line, idx) => {
  if (/(db|masterDb)\.(all|get|run|each)\s*\([^,)]*\+/.test(line)) {
    sqlPlusLines.push({ line: idx + 1, text: line.trim() });
  }
});

console.log('Found SQL with + string concatenation:', sqlPlusLines.length);
sqlPlusLines.forEach(l => console.log(`L${l.line}: ${l.text}`));
