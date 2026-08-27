const fs = require('fs');

let html = fs.readFileSync('configuracoes.html', 'utf8');

// 1. REMOVER O SCRIPT DE ZOOM QUE QUEBRA A ESCALA DA PÁGINA
const brokenZoomScript = `  <script>
    (function () {
      const res = localStorage.getItem('chef_app_resolution') || 'auto';
      const zoom = localStorage.getItem('chef_app_zoom_percent') || '100';
      let target = '';
      if (res === 'compact') target = '88%';
      else if (res === 'standard') target = '100%';
      else if (res === 'large') target = '118%';
      else if (res === 'touch') target = '112%';
      else if (res === 'custom') target = zoom + '%';
      if (target) document.documentElement.style.zoom = target;
    })();
  </script>`;

const fixedZoomScript = `  <script>
    (function () {
      // Garantir 100% de escala natural e proporções nítidas sem zoom quebrado
      document.documentElement.style.zoom = '1';
    })();
  </script>`;

if (html.includes(brokenZoomScript)) {
  html = html.replace(brokenZoomScript, fixedZoomScript);
  console.log('Removed broken zoom script!');
} else {
  html = html.replace(/<script>\s*\(function\s*\(\)\s*\{\s*const res = localStorage\.getItem\('chef_app_resolution'\)[\s\S]*?<\/script>/i, fixedZoomScript);
  console.log('Regex replaced zoom script!');
}

// 2. CORRIGIR A ZONA DE PERIGO NO HTML (ELIMINAR FUNDO CLARO E TEXTO CLARO)
const brokenZonaPerigo = `<div
          style="background: #fef2f2; padding: 20px; border-radius: 12px; border: 2px solid #fecaca; margin-bottom: 20px;">
          <h3 style="margin-top:0; color: #dc2626;"><i class="ph ph-warning"></i> Zona de Perigo</h3>
          <p style="color: #991b1b; font-size: 14px; margin-bottom: 15px;">
            Esta ação irá apagar <strong>TODOS</strong> os dados do sistema: pedidos, mesas, clientes, promoções, movimentações, turnos, produtos e configurações de IA. Esta ação é <strong>IRREVERSÍVEL</strong>.
          </p>`;

const fixedZonaPerigo = `<div
          style="background: rgba(220, 38, 38, 0.1); padding: 22px; border-radius: 14px; border: 1.5px solid rgba(220, 38, 38, 0.35); margin-bottom: 20px;">
          <h3 style="margin-top:0; color: #f87171; font-size: 18px; font-weight: 800; display:flex; align-items:center; gap:8px;"><i class="ph-bold ph-warning"></i> Zona de Perigo</h3>
          <p style="color: #fca5a5; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
            Esta ação irá apagar <strong style="color:#ffffff;">TODOS</strong> os dados do sistema: pedidos, mesas, clientes, promoções, movimentações, turnos, produtos e configurações de IA. Esta ação é <strong style="color:#ffffff;">IRREVERSÍVEL</strong>.
          </p>`;

if (html.includes(brokenZonaPerigo)) {
  html = html.replace(brokenZonaPerigo, fixedZonaPerigo);
  console.log('Replaced brokenZonaPerigo cleanly!');
} else {
  html = html.replace(/<div\s+style="background:\s*#fef2f2;[\s\S]*?<h3[\s\S]*?Zona de Perigo<\/h3>[\s\S]*?<\/p>/i, fixedZonaPerigo);
  console.log('Regex replaced brokenZonaPerigo!');
}

// 3. OVERRIDE ROBUSTO DE DESIGN SYSTEM & MODAIS PARA 100% HARMONIA ESCURA
const modalAndLayoutMasterCss = `
    /* ══════════════════════════════════════════════════════════════════
       DESIGN SYSTEM MASTER: PROPORÇÕES NÍTIDAS, ESCALA 100% & MODAIS DARK
       ══════════════════════════════════════════════════════════════════ */
    :root {
      --cfg-bg: #09090b;
      --cfg-sidebar-bg: #121218;
      --cfg-header-bg: #121218;
      --cfg-card-bg: #18181b;
      --cfg-subtle-bg: #202026;
      --cfg-input-bg: #0c0c10;
      --cfg-border: #2a2a32;
      --cfg-text: #f4f4f5;
      --cfg-text-muted: #a1a1aa;
      --cfg-heading: #ffffff;
      --cfg-primary: #fc4b15;
      --cfg-success: #10b981;
      --cfg-danger: #ef4444;
    }

    body {
      font-size: 14px;
      line-height: 1.5;
      zoom: 1 !important;
    }

    .main-workspace {
      flex: 1 1 auto !important;
      height: calc(100vh - 58px) !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding: 24px 32px 80px !important;
      box-sizing: border-box !important;
      max-width: 1300px !important;
      margin: 0 auto !important;
      width: 100% !important;
    }

    .admin-tab-content {
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .admin-tab-content.active {
      display: flex !important;
      flex-direction: column !important;
      gap: 20px !important;
      width: 100% !important;
    }

    /* Modais Dark OLED 100% Legíveis */
    .modal-overlay,
    #modal-fechar-folha,
    #modal-pagamento-rapido,
    #modal-editar-funcionario,
    #modal-forma-pagamento,
    #modal-editar-produto {
      background: rgba(0, 0, 0, 0.82) !important;
      backdrop-filter: blur(8px) !important;
    }

    .modal-overlay > div,
    .modal {
      background: var(--cfg-card-bg) !important;
      color: var(--cfg-text) !important;
      border: 1.5px solid var(--cfg-border) !important;
      border-radius: 18px !important;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6) !important;
    }

    .modal-overlay header,
    .modal-overlay > div > div:first-child,
    .modal-overlay div[style*="background: linear-gradient"],
    .modal-overlay div[style*="background: #f8f9fa"],
    .modal-overlay div[style*="background:#f8f9fa"],
    .modal-overlay div[style*="border-top"],
    .modal-overlay div[style*="border-bottom"] {
      background: var(--cfg-subtle-bg) !important;
      border-color: var(--cfg-border) !important;
      color: var(--cfg-text) !important;
    }

    .modal-overlay div[style*="background: #f8fafc"],
    .modal-overlay div[style*="background: #fffdfa"],
    .modal-overlay div[style*="background: #fffbfa"],
    .modal-overlay div[style*="background: #e8f5e9"],
    .modal-overlay div[style*="background: #ecfdf5"],
    .modal-overlay div[style*="background: #fff1f2"],
    .modal-overlay div[style*="background: #fff7ed"],
    .modal-overlay div[style*="background: #f0fdf4"] {
      background: var(--cfg-subtle-bg) !important;
      border-color: var(--cfg-border) !important;
      color: var(--cfg-text) !important;
    }

    .modal-overlay label,
    .modal-overlay span,
    .modal-overlay p,
    .modal-overlay h2,
    .modal-overlay h3,
    .modal-overlay h4,
    .modal-overlay strong {
      color: var(--cfg-text) !important;
    }

    .modal-overlay input,
    .modal-overlay select,
    .modal-overlay textarea {
      background: var(--cfg-input-bg) !important;
      color: var(--cfg-text) !important;
      border: 1px solid var(--cfg-border) !important;
      border-radius: 8px !important;
    }

    /* Cartões e Formulários com proporções fluidas */
    .card,
    .promo-card,
    .admin-card,
    .tab-form-header > div,
    [style*="background: var(--cfg-card-bg)"] {
      background: var(--cfg-card-bg) !important;
      border: 1px solid var(--cfg-border) !important;
      border-radius: 14px !important;
      color: var(--cfg-text) !important;
    }
`;

html = html.replace('</style>', modalAndLayoutMasterCss + '\n</style>');

fs.writeFileSync('configuracoes.html', html, 'utf8');
console.log('Successfully updated configuracoes.html with Design System Master!');
