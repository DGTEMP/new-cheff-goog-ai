const fs = require('fs');

let mainJs = fs.readFileSync('main.js', 'utf8');

mainJs = mainJs.replace(
  /groupedOrders\[mesaName\]\.items\.push\(order\);\s*groupedOrders\[mesaName\]\.total \+= val;/g,
  "groupedOrders[mesaName].items.push(order);\n" +
  "        groupedOrders[mesaName].totalBruto = (groupedOrders[mesaName].totalBruto || 0) + val;\n" +
  "        if (order.status !== 'Pago') {\n" +
  "          groupedOrders[mesaName].total += val;\n" +
  "        }"
);

mainJs = mainJs.replace(/let totalBase = isGroup \? item\.total : 0;/g, 'let totalBase = isGroup ? (item.totalBruto || item.total) : 0;');
mainJs = mainJs.replace(/updateSummaryValue\('resumo-subtotal', item\.total\);/g, "updateSummaryValue('resumo-subtotal', item.totalBruto || item.total);");
mainJs = mainJs.replace(/updateSummaryValue\('resumo-produtos', item\.total\);/g, "updateSummaryValue('resumo-produtos', item.totalBruto || item.total);");

mainJs = mainJs.replace(
  /const falta = finalTotal - pago;/g,
  "const paidItemsTotal = (window.mesaAtual.totalBruto || window.mesaAtual.total) - window.mesaAtual.total;\n" +
  "            const falta = finalTotal - pago - paidItemsTotal;"
);

mainJs = mainJs.replace(/let totalComTaxa = item\.total \+ window\.servicoAdicional - window\.descontoAdicional;/g, 'let totalComTaxa = (item.totalBruto || item.total) + window.servicoAdicional - window.descontoAdicional;');
mainJs = mainJs.replace(/const baseParaTaxa = Math\.max\(0, item\.total - window\.descontoAdicional\);/g, 'const baseParaTaxa = Math.max(0, (item.totalBruto || item.total) - window.descontoAdicional);');

fs.writeFileSync('main.js', mainJs);
console.log('main.js patched for totalBruto');

let garcomJs = fs.readFileSync('garcom.js', 'utf8');

garcomJs = garcomJs.replace(/return billItems\.reduce\(\(acc, curr\) => \(curr\.totalVal >= 0\) \? acc \+ curr\.totalVal : acc, 0\);/g, "return billItems.reduce((acc, curr) => (curr.totalVal >= 0 && curr.status !== 'Pago') ? acc + curr.totalVal : acc, 0);");

garcomJs = garcomJs.replace(
  /function calcTotal\(billItems\) \{/g,
  "function calcTotalBruto(billItems) { return billItems.reduce((acc, curr) => (curr.totalVal >= 0) ? acc + curr.totalVal : acc, 0); }\nfunction calcTotal(billItems) {"
);

garcomJs = garcomJs.replace(
  /const subtotal = calcTotal\(billItems\);/g,
  "const subtotalBruto = calcTotalBruto(billItems);\n  const subtotal = calcTotal(billItems);"
);

garcomJs = garcomJs.replace(
  /<div style="font-size: 24px; font-weight: 900; color: #3ab55b;">R\$ \$\{subtotal\.toFixed\(2\)\.replace\('\.', ','\)\}<\/div>/g,
  '<div style="font-size: 24px; font-weight: 900; color: #3ab55b;">R$ ${subtotalBruto.toFixed(2).replace(\'.\', \',\')}</div>'
);

fs.writeFileSync('garcom.js', garcomJs);
console.log('garcom.js patched for totalBruto');
