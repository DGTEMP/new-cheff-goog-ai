const fs = require('fs');

// Patch main.js
let mainJs = fs.readFileSync('main.js', 'utf8');
mainJs = mainJs.replace(/if\s*\(\s*order\.status\s*!==\s*'Pago'\s*\)\s*\{\s*groupedOrders\[mesaName\]\.total\s*\+=\s*val;\s*\}/g, 'groupedOrders[mesaName].total += val;');
fs.writeFileSync('main.js', mainJs);
console.log('main.js patched');

// Patch garcom.js
let garcomJs = fs.readFileSync('garcom.js', 'utf8');
garcomJs = garcomJs.replace(/curr\.status\s*!==\s*'Pago'/g, 'true');
fs.writeFileSync('garcom.js', garcomJs);
console.log('garcom.js patched');
