const fs = require('fs');

let suporteHtml = fs.readFileSync('suporte.html', 'utf8');

// Atualiza o CSS da seção do Theme Studio para ocupar 100% da tela (Fullscreen Imersivo)
const oldThemeStudioSec = `<div class="content-section" id="sec-theme-studio" style="height: calc(100vh - 90px); padding: 0; overflow: hidden;">
          <iframe id="iframe-theme-studio" src="/theme-store.html?mode=studio_pro" style="width: 100%; height: 100%; border: none; border-radius: 12px; background: #0b0f19;"></iframe>
        </div>`;

const newThemeStudioSec = `<!-- Theme Studio Pro Imersivo Fullscreen -->
        <div class="content-section" id="sec-theme-studio" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; background: #0b0f19; padding: 0; margin: 0; overflow: hidden; display: none;">
          <iframe id="iframe-theme-studio" src="/theme-store.html?mode=studio_pro" style="width: 100vw; height: 100vh; border: none; outline: none; background: #0b0f19; margin: 0; padding: 0; display: block;"></iframe>
        </div>`;

if (suporteHtml.includes('id="sec-theme-studio"')) {
  suporteHtml = suporteHtml.replace(oldThemeStudioSec, newThemeStudioSec);
}

// Atualizar script de troca de abas em suporte.html para lidar com o fullscreen do Theme Studio
const targetTabScript = `document.querySelectorAll('.sidebar .menu-item').forEach(item => {`;

const newTabLogic = `// Listener para mensagens vindas do iframe do Theme Studio (ex: fechar studio)
    window.addEventListener('message', (event) => {
      if (event.data === 'fechar_theme_studio') {
        const secStudio = document.getElementById('sec-theme-studio');
        if (secStudio) secStudio.style.display = 'none';
        const dashItem = document.querySelector('.sidebar .menu-item[data-target="sec-dashboard"]');
        if (dashItem) dashItem.click();
      }
    });

    document.querySelectorAll('.sidebar .menu-item').forEach(item => {`;

if (!suporteHtml.includes('fechar_theme_studio')) {
  suporteHtml = suporteHtml.replace(targetTabScript, newTabLogic);
}

fs.writeFileSync('suporte.html', suporteHtml, 'utf8');
console.log('Updated suporte.html to make Theme Studio full screen!');
