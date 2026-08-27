const fs = require('fs');

const code = fs.readFileSync('server.js', 'utf8');
const lines = code.split('\n');

const superRoutes = [];
lines.forEach((line, idx) => {
  if (/app\.(get|post|put|delete|patch)\s*\(\s*['"]\/api\/super\//.test(line)) {
    superRoutes.push({ line: idx + 1, text: line.trim() });
  }
});

console.log('Found /api/super/ routes in server.js:', superRoutes.length);
superRoutes.forEach(r => console.log(`L${r.line}: ${r.text}`));
