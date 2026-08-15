const fs = require('fs');

// --- UPDATE garcom.html ---
let garcomHtml = fs.readFileSync('garcom.html', 'utf8');

if (!garcomHtml.includes('id="btn-home"')) {
  garcomHtml = garcomHtml.replace(
    /<button id="btn-fullscreen"/,
    `<button id="btn-home" style="display:none; color:#333; font-size:24px; margin-right:12px;" onclick="window.location.href='/index.html'" title="Início do App (Caixa)"><i class="ph ph-house"></i></button>\n        <button id="btn-colaborador" style="display:none; color:#9b59b6; font-size:24px; margin-right:12px;" onclick="window.location.href='/painel-funcionario.html'" title="Área de Membros"><i class="ph ph-user"></i></button>\n        <button id="btn-fullscreen"`
  );
  fs.writeFileSync('garcom.html', garcomHtml);
}

// --- UPDATE garcom.js ---
let garcomJs = fs.readFileSync('garcom.js', 'utf8');

garcomJs = garcomJs.replace(
  /document\.getElementById\('btn-logout'\)\.style\.display = 'none';/g,
  "document.getElementById('btn-logout').style.display = 'none';\n  if(document.getElementById('btn-home')) document.getElementById('btn-home').style.display = 'none';\n  if(document.getElementById('btn-colaborador')) document.getElementById('btn-colaborador').style.display = 'none';"
);

garcomJs = garcomJs.replace(
  /document\.getElementById\('btn-logout'\)\.style\.display = 'block';/g,
  "document.getElementById('btn-logout').style.display = 'block';\n  if(document.getElementById('btn-home')) document.getElementById('btn-home').style.display = 'block';\n  if(document.getElementById('btn-colaborador')) document.getElementById('btn-colaborador').style.display = 'block';"
);

fs.writeFileSync('garcom.js', garcomJs);
console.log('Botões inseridos no garcom.html e garcom.js!');
