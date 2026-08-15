const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The lines look like:
// 2: <html lang="pt-BR">
// We need to split by lines and replace ^\d+: 
let lines = html.split('\n');
for (let i = 0; i < lines.length; i++) {
   lines[i] = lines[i].replace(/^\d+:\s?/, '');
}
html = lines.join('\n');

fs.writeFileSync('index.html', html);
console.log('Line numbers removed! Size: ' + html.length);
