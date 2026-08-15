const fs = require('fs');

// --- 1. UPDATE index.html ---
let indexHtml = fs.readFileSync('index.html', 'utf8');
if (!indexHtml.includes('id="pdv-search-product"')) {
  indexHtml = indexHtml.replace(
    /<div id="pdv-menu-items"/,
    `<input type="text" id="pdv-search-product" placeholder="🔍 Buscar produto..." onkeyup="window.pdvSearchQuery=this.value.toLowerCase(); window.renderPdvMenu();" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 10px; font-size: 16px;">\n            <div id="pdv-menu-items"`
  );
  fs.writeFileSync('index.html', indexHtml);
}

// --- 2. UPDATE main.js ---
let mainJs = fs.readFileSync('main.js', 'utf8');
mainJs = mainJs.replace(
  /const filteredProds = window\.pdvCurrentCategory === 'Todas' \? window\.allProducts : window\.allProducts\.filter\(p => p\.categoria === window\.pdvCurrentCategory\);/g,
  `const query = window.pdvSearchQuery || '';
    let filteredProds = [];
    if (query.trim() !== '') {
      filteredProds = window.allProducts.filter(p => p.nome.toLowerCase().includes(query) || (p.categoria && p.categoria.toLowerCase().includes(query)));
    } else {
      filteredProds = window.pdvCurrentCategory === 'Todas' ? window.allProducts : window.allProducts.filter(p => p.categoria === window.pdvCurrentCategory);
    }`
);
fs.writeFileSync('main.js', mainJs);

// --- 3. UPDATE garcom.html ---
let garcomHtml = fs.readFileSync('garcom.html', 'utf8');
if (!garcomHtml.includes('id="garcom-search-product"')) {
  garcomHtml = garcomHtml.replace(
    /<div id="menu-tabs"><\/div>/,
    `<input type="text" id="garcom-search-product" placeholder="🔍 Buscar produto..." onkeyup="window.garcomSearchQuery=this.value.toLowerCase(); renderMenu();" style="width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 12px; margin-bottom: 16px; font-size: 16px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.02); outline: none;">\n        <div id="menu-tabs"></div>`
  );
  fs.writeFileSync('garcom.html', garcomHtml);
}

// --- 4. UPDATE garcom.js ---
let garcomJs = fs.readFileSync('garcom.js', 'utf8');
garcomJs = garcomJs.replace(
  /const filtered = MENU\.filter\(m => m\.category === currentTab\);/g,
  `const query = window.garcomSearchQuery || '';
  let filtered = [];
  if (query.trim() !== '') {
    filtered = MENU.filter(m => m.name.toLowerCase().includes(query) || (m.category && m.category.toLowerCase().includes(query)));
  } else {
    filtered = MENU.filter(m => m.category === currentTab);
  }`
);
// Make sure renderMenu uses global if needed, but it's local scope in garcom.js
garcomJs = garcomJs.replace(
  /function renderMenu\(\) \{/,
  'window.renderMenu = function renderMenu() {'
);
fs.writeFileSync('garcom.js', garcomJs);

console.log('Search bars injected correctly!');
