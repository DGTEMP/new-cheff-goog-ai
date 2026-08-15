const fs = require('fs');

let garcomJs = fs.readFileSync('garcom.js', 'utf8');

garcomJs = garcomJs.replace(
  /function getBillSubtotal\(\) \{\s*return billItems\.reduce\(\(acc, curr\) => \(curr\.totalVal >= 0 && true\) \? acc \+ curr\.totalVal : acc, 0\);\s*\}/g,
  "function getBillSubtotal() {\n  return billItems.reduce((acc, curr) => (curr.totalVal >= 0 && curr.status !== 'Pago') ? acc + curr.totalVal : acc, 0);\n}"
);

garcomJs = garcomJs.replace(
  /function getBillSubtotal\(\) \{/g,
  "function getBillGrossTotal() {\n  return billItems.reduce((acc, curr) => (curr.totalVal >= 0) ? acc + curr.totalVal : acc, 0);\n}\n\nfunction getBillSubtotal() {"
);

garcomJs = garcomJs.replace(
  /const consumedSubtotal = getBillSubtotal\(\);/g,
  "const consumedSubtotal = getBillSubtotal();\n  const grossSubtotal = getBillGrossTotal();"
);

garcomJs = garcomJs.replace(
  /const totalDaMesa = consumedSubtotal \+ serviceFee;/g,
  "const totalDaMesa = grossSubtotal * multiplier;"
);

fs.writeFileSync('garcom.js', garcomJs);
console.log('garcom.js patched.');

let mainJs = fs.readFileSync('main.js', 'utf8');

mainJs = mainJs.replace(
  /const paidItemsTotal = \(window\.mesaAtual\.totalBruto \|\| window\.mesaAtual\.total\) - window\.mesaAtual\.total;\s*const falta = finalTotal - pago - paidItemsTotal;/g,
  "const taxaMult = (taxaCheckbox && taxaCheckbox.checked) ? 1.1 : 1.0;\n           const paidItemsTotal = ((window.mesaAtual.totalBruto || window.mesaAtual.total) - window.mesaAtual.total) * taxaMult;\n           const falta = finalTotal - pago - paidItemsTotal;"
);

fs.writeFileSync('main.js', mainJs);
console.log('main.js patched.');
