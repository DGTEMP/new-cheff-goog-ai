const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');
let missingChunk = fs.readFileSync('missing_chunk.txt', 'utf8');

// The missing chunk has `<!-- RELATORIOS OVERLAY -->` at the end because of the regex.
// We remove `<!-- RELATORIOS OVERLAY -->` from the missing chunk so we don't duplicate it.
missingChunk = missingChunk.replace(/<!-- RELATORIOS OVERLAY -->/g, '');

// Inject the missing chunk back into index.html
if (indexHtml.includes('<!-- RELATORIOS OVERLAY -->')) {
  indexHtml = indexHtml.replace(
    /<!-- RELATORIOS OVERLAY -->/,
    missingChunk + '\n  <!-- RELATORIOS OVERLAY -->'
  );
}

// Re-inject the search bar into pdv-menu-items if it's missing (it is, because it came from the old backup)
if (!indexHtml.includes('id="pdv-search-product"')) {
  indexHtml = indexHtml.replace(
    /<div id="pdv-menu-items"/,
    `<input type="text" id="pdv-search-product" placeholder="🔍 Buscar produto..." onkeyup="window.pdvSearchQuery=this.value.toLowerCase(); window.renderPdvMenu();" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 10px; font-size: 16px;">\n          <div id="pdv-menu-items"`
  );
}

fs.writeFileSync('index.html', indexHtml);
console.log('index.html restaurado!');
