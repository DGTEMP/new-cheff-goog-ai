const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// The block to remove
const blockToRemove = `        <div class="info-group">
          <div class="group-title">Mesas</div>
          <div class="status-bar" style="margin-bottom: 20px; display: flex; gap: 20px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: #eb5757;"></div>
              <span>Ocupadas:</span>
              <span style="color: #eb5757; font-weight: bold;" id="info-mesas-ocupadas">0</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: #3498db;"></div>
              <span>Para Fechar:</span>
              <span style="color: #3498db; font-weight: bold;" id="info-mesas-fechando">0</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: #9b59b6;"></div>
              <span>Reservadas:</span>
              <span style="color: #9b59b6; font-weight: bold;" id="info-mesas-reservadas">0</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: #3ab55b;"></div>
              <span>Livres:</span>
              <span style="color: #3ab55b; font-weight: bold;" id="info-mesas-livres">0</span>
            </div>
          </div>
        </div>`;

// Check if block exists and remove it
if (indexHtml.includes(blockToRemove)) {
  indexHtml = indexHtml.replace(blockToRemove, '');
} else {
  // Try fallback logic if exact match fails
  const fallbackRegex = /<div class="info-group">\s*<div class="group-title">Mesas<\/div>\s*<div class="status-bar"[\s\S]*?id="info-mesas-livres"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;
  indexHtml = indexHtml.replace(fallbackRegex, '');
}

// The target to replace in the footer
const targetFooter = `<span>Mesas: <span id="status-mesas-count">0</span></span>`;
const newFooter = `<span style="display: flex; gap: 15px; align-items: center; border-left: 1px solid #ccc; border-right: 1px solid #ccc; padding: 0 15px; margin: 0 10px;">
        <div style="display: flex; gap: 6px; align-items: center;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #eb5757;"></div> <span style="color: #eb5757; font-weight: bold;" id="info-mesas-ocupadas">0</span> Ocupadas</div>
        <div style="display: flex; gap: 6px; align-items: center;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #3498db;"></div> <span style="color: #3498db; font-weight: bold;" id="info-mesas-fechando">0</span> Fechando</div>
        <div style="display: flex; gap: 6px; align-items: center;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #9b59b6;"></div> <span style="color: #9b59b6; font-weight: bold;" id="info-mesas-reservadas">0</span> Reservadas</div>
        <div style="display: flex; gap: 6px; align-items: center;"><div style="width: 10px; height: 10px; border-radius: 50%; background: #3ab55b;"></div> <span style="color: #3ab55b; font-weight: bold;" id="info-mesas-livres">0</span> Livres</div>
        <!-- Maintain the total count element invisibly so main.js doesn't crash -->
        <span id="status-mesas-count" style="display: none;">0</span>
      </span>`;

if (indexHtml.includes(targetFooter)) {
  indexHtml = indexHtml.replace(targetFooter, newFooter);
}

fs.writeFileSync('index.html', indexHtml);
console.log('Informações de mesas movidas para o rodapé!');
