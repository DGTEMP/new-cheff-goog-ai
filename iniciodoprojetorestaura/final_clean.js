const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Clean up weird literals
html = html.replace(/\\r/g, '');
html = html.replace(/\\t/g, '  ');

// Ensure the start is just <!DOCTYPE html>
let docStart = html.indexOf('<!DOCTYPE html>');
if (docStart > 0) {
    html = html.substring(docStart);
}

// Ensure the end is just </html>
let docEnd = html.lastIndexOf('</html>');
if (docEnd !== -1) {
    html = html.substring(0, docEnd + 7);
}

// 1. Remove the Mesas info-group safely
const startMesaGroup = html.indexOf('<div class="group-title">Mesas</div>');
if (startMesaGroup > 0) {
    const startInfoGroup = html.lastIndexOf('<div class="info-group">', startMesaGroup);
    
    const endInfoGroup = html.indexOf('<div class="info-group summary">', startMesaGroup);
    
    if (startInfoGroup > 0 && endInfoGroup > startInfoGroup) {
        const toDelete = html.substring(startInfoGroup, endInfoGroup);
        html = html.replace(toDelete, '');
        console.log('Mesas info group removed from sidebar.');
    }
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

if (html.includes(targetFooter)) {
  html = html.replace(targetFooter, newFooter);
  console.log('Footer updated.');
}

// Fix numbers at start of line from Get-Content possibly?
// Wait, my Get-Content output above showed "2: <html...", "3: <head...", etc because I used `-TotalCount 5` which enumerates lines in Powershell! The file DOES NOT contain "2: ".

fs.writeFileSync('index.html', html);
console.log('Finished. Final size: ' + html.length);
