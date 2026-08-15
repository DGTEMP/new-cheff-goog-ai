const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Inject the search bar
if (!html.includes('pdv-search-product')) {
    html = html.replace(
        '<div id="pdv-menu-items"',
        '<input type="text" id="pdv-search-product" placeholder="🔍 Buscar produto..." onkeyup="window.pdvSearchQuery=this.value.toLowerCase(); window.renderPdvMenu();" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 10px; font-size: 16px;">\n          <div id="pdv-menu-items"'
    );
}

fs.writeFileSync('index.html', html);
console.log('Search bar added.');
