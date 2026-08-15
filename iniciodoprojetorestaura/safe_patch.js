const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// 1. Remove the Mesas info-group safely
const startMesaGroup = indexHtml.indexOf('<div class="group-title">Mesas</div>');
if (startMesaGroup > 0) {
    const startInfoGroup = indexHtml.lastIndexOf('<div class="info-group">', startMesaGroup);
    
    // We want to delete from startInfoGroup up to the end of its block, which is just before `<div class="info-group summary">`
    const endInfoGroup = indexHtml.indexOf('<div class="info-group summary">', startMesaGroup);
    
    if (startInfoGroup > 0 && endInfoGroup > startInfoGroup) {
        const toDelete = indexHtml.substring(startInfoGroup, endInfoGroup);
        // Delete it!
        indexHtml = indexHtml.replace(toDelete, '');
        console.log('Mesas info group removed from sidebar.');
    } else {
        console.log('Could not find the end of the Mesas info group.');
    }
} else {
    console.log('Could not find the Mesas info group.');
}

// 2. Add detailed Mesas info to the footer
const targetFooter = '<span>Mesas: <span id="status-mesas-count">0</span></span>';
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
  console.log('Footer updated.');
} else {
  console.log('Footer not found or already updated.');
}

// 3. Fix weird BOM character at the start if it exists
if (indexHtml.charCodeAt(0) === 0xFEFF || indexHtml.charCodeAt(0) === 0xFFFD) {
    indexHtml = indexHtml.substring(1);
    console.log('Removed BOM or weird char at start.');
}

// 4. Check for double RELATORIOS OVERLAY due to my previous script
const relatoriosCount = (indexHtml.match(/<!-- RELATORIOS OVERLAY -->/g) || []).length;
if (relatoriosCount > 1) {
    // Only keep one
    let parts = indexHtml.split('<!-- RELATORIOS OVERLAY -->');
    // First part is up to the first OVERLAY
    indexHtml = parts[0] + '<!-- RELATORIOS OVERLAY -->' + parts[1]; // discard parts[2] onwards if they are just empty or dups
    console.log('Removed duplicate RELATORIOS OVERLAY comment.');
}

fs.writeFileSync('index.html', indexHtml);
