/**
 * theme-manager.js — Gerenciador Universal de Temas & Tecla Coringa ESC (Chef Cozinha)
 */
(function () {
  var STORAGE_KEY = 'chef_theme';
  var CUSTOM_THEME_KEY = 'chef_custom_theme_config';

  function getSavedTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) { }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && localStorage.getItem('chef_theme_auto') === '1') {
      return 'dark';
    }
    return 'light';
  }

  function updateThemeUI(theme) {
    var validTheme = (theme === 'dark') ? 'dark' : 'light';
    var icon = document.getElementById('theme-toggle-icon');
    var text = document.getElementById('theme-toggle-text');
    var iconSuper = document.getElementById('theme-toggle-icon-super');
    var textSuper = document.getElementById('theme-toggle-text-super');

    if (icon) icon.className = (validTheme === 'dark') ? 'ph ph-moon' : 'ph ph-sun';
    if (text) text.textContent = (validTheme === 'dark') ? 'Modo Escuro' : 'Modo Claro';

    if (iconSuper) iconSuper.className = (validTheme === 'dark') ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    if (textSuper) textSuper.textContent = (validTheme === 'dark') ? 'Modo Escuro' : 'Modo Claro';
  }

  function applyTheme(theme) {
    var validTheme = (theme === 'dark') ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', validTheme);
    if (document.body) {
      document.body.classList.remove('theme-dark', 'theme-light');
      document.body.classList.add('theme-' + validTheme);
      /* Sincroniza com o sistema global dark-mode.css (fullscreen.js) para os dois nunca divergirem */
      document.body.classList.toggle('dark-mode', validTheme === 'dark');
    }
    document.documentElement.classList.toggle('dark-mode', validTheme === 'dark');
    try { localStorage.setItem(STORAGE_KEY, validTheme); } catch (e) { }
    try { localStorage.setItem('chef_garcom_theme', validTheme); } catch (e) { }
    updateThemeUI(validTheme);
    window.dispatchEvent(new CustomEvent('chef_theme_changed', { detail: { theme: validTheme } }));
  }

  function isLightColor(hex) {
    try {
      var h = String(hex || '').replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
      return ((0.299 * r) + (0.587 * g) + (0.114 * b)) > 140;
    } catch (e) { return false; }
  }

  var _lastCfg = null;

  function applyCustomTheme(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    _lastCfg = cfg;
    try { localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(cfg)); } catch(e) {}

    var styleEl = document.getElementById('chef-custom-theme-vars');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'chef-custom-theme-vars';
      document.head.appendChild(styleEl);
    }

    /* Cores do tema custom aplicadas SOMENTE ao modo correspondente à luminância
       do fundo escolhido: tema claro não é mais contaminado por cores escuras. */
    var darkBase = !isLightColor(cfg.bgColor);
    var css = darkBase ? '[data-theme="dark"] {\n' : '[data-theme="light"] {\n';
    if (cfg.primary) css += '  --primary: ' + cfg.primary + ';\n';
    if (cfg.primaryHover) css += '  --primary-hover: ' + cfg.primaryHover + ';\n';
    if (cfg.bgHeader) css += '  --bg-header: ' + cfg.bgHeader + ';\n';
    if (cfg.textHeader) css += '  --text-header: ' + cfg.textHeader + ';\n';
    if (cfg.bgSidebar) css += '  --bg-sidebar: ' + cfg.bgSidebar + ';\n';
    if (cfg.textSidebar) css += '  --text-sidebar: ' + cfg.textSidebar + ';\n';
    if (cfg.bgColor) css += '  --bg-color: ' + cfg.bgColor + ';\n';
    if (cfg.bgCard) css += '  --bg-card: ' + cfg.bgCard + ';\n';
    if (cfg.textPrimary) css += '  --text-primary: ' + cfg.textPrimary + ';\n';
    if (cfg.textSecondary) css += '  --text-secondary: ' + cfg.textSecondary + ';\n';
    if (cfg.borderColor) css += '  --border-color: ' + cfg.borderColor + ';\n';
    if (cfg.btnPrimaryBg) css += '  --btn-primary-bg: ' + cfg.btnPrimaryBg + ';\n';
    if (cfg.btnPrimaryText) css += '  --btn-primary-text: ' + cfg.btnPrimaryText + ';\n';
    if (cfg.fontBody) css += '  --font-family: "' + cfg.fontBody + '", sans-serif;\n';
    if (cfg.fontHeading) css += '  --font-heading: "' + cfg.fontHeading + '", sans-serif;\n';
    if (cfg.borderRadius) css += '  --radius-lg: ' + cfg.borderRadius + '; --radius-md: ' + cfg.borderRadius + ';\n';
    css += '}\n';

    /* Tamanhos e posições valem para os DOIS temas */
    var sizes = ':root {\n';
    if (cfg.fontSizeScale) sizes += '  --fs-scale: ' + cfg.fontSizeScale + ';\n';
    if (cfg.btnScale) sizes += '  --btn-scale: ' + cfg.btnScale + ';\n';
    if (cfg.cardPadY) sizes += '  --card-pad-y: ' + cfg.cardPadY + ';\n';
    if (cfg.cardPadX) sizes += '  --card-pad-x: ' + cfg.cardPadX + ';\n';
    if (cfg.modalWidth) sizes += '  --modal-max-w: ' + cfg.modalWidth + ';\n';
    if (cfg.modalPosition) sizes += '  --modal-align: ' + cfg.modalPosition + ';\n';
    sizes += '}\n';

    /* Regras agressivas de tamanho só entram se houver valor não-padrão,
       para o layout original nunca ser distorcido sem intenção. */
    var tamanhosCustom = (cfg.fontSizeScale && cfg.fontSizeScale !== '1') ||
      (cfg.btnScale && cfg.btnScale !== '1') ||
      (cfg.cardPadY && cfg.cardPadY !== '10px') ||
      (cfg.cardPadX && cfg.cardPadX !== '12px') ||
      (cfg.modalWidth && cfg.modalWidth !== 'none');
    try {
      document.documentElement.setAttribute('data-chef-sizes', tamanhosCustom ? 'on' : 'off');
      if (document.body) document.body.classList.toggle('chef-sizes-on', !!tamanhosCustom);
    } catch (e) { }

    styleEl.innerHTML = css + sizes;

    if (cfg.fontBody && !document.getElementById('font-body-' + cfg.fontBody)) {
      var fontLink = document.createElement('link');
      fontLink.id = 'font-body-' + cfg.fontBody;
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(cfg.fontBody) + ':wght@400;500;600;700&display=swap';
      document.head.appendChild(fontLink);
    }
    if (cfg.fontHeading && !document.getElementById('font-heading-' + cfg.fontHeading)) {
      var fontLinkH = document.createElement('link');
      fontLinkH.id = 'font-heading-' + cfg.fontHeading;
      fontLinkH.rel = 'stylesheet';
      fontLinkH.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(cfg.fontHeading) + ':wght@600;700;800&display=swap';
      document.head.appendChild(fontLinkH);
    }

    styleEl.innerHTML = css + sizes;
    renderCoringa(cfg);
    window.dispatchEvent(new CustomEvent('chef_custom_theme_applied', { detail: cfg }));
  }

  /* ═══ ÍCONE CORINGA: função e posição definidas pelo super admin ═══ */
  function executarAcaoCoringa(cfg) {
    var a = cfg.action || 'url';
    var t = cfg.target || '';
    if (a === 'tema') { window.ChefTheme.toggle(); return; }
    if (a === 'recarregar') { location.reload(); return; }
    if (a === 'fila') {
      if (typeof window.abrirFilaEsperaModal === 'function') window.abrirFilaEsperaModal();
      else alert('Fila de espera não disponível nesta tela.');
      return;
    }
    if (a === 'js') {
      try { (new Function(t))(); } catch (e) { console.error('[ChefTheme] Coringa JS:', e); }
      return;
    }
    /* padrão: url / página interna */
    if (/^https?:\/\//i.test(t)) window.open(t, '_blank');
    else if (t) location.href = t;
  }

  function renderCoringa(cfg) {
    var c = cfg && cfg.coringa;
    var old = document.getElementById('chef-coringa-btn');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!c || c.enabled === false || !c.icon) return;

    var pos = c.position || 'float-br';
    if (pos.indexOf('topbar') === 0 && !document.querySelector('.top-menubar')) return;
    if (pos.indexOf('float') === 0 && !document.body) return;

    var btn = document.createElement('button');
    btn.id = 'chef-coringa-btn';
    btn.className = 'chef-coringa-' + pos;
    btn.title = c.title || 'Atalho personalizado';
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = '<i class="' + c.icon + '"></i>';
    if (c.color) btn.style.color = c.color;
    btn.style.background = c.bg || '#1e293b';

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      executarAcaoCoringa(c);
    });

    if (pos === 'topbar-left' || pos === 'topbar-right') {
      var bar = document.querySelector('.top-menubar');
      if (!bar) return;
      if (pos === 'topbar-left') bar.insertBefore(btn, bar.firstChild);
      else bar.appendChild(btn);
    } else {
      document.body.appendChild(btn);
    }
  }

  function fetchAndApplyGlobalTheme() {
    try {
      var cached = localStorage.getItem(CUSTOM_THEME_KEY);
      if (cached) applyCustomTheme(JSON.parse(cached));
    } catch(e) {}

    fetch('/api/public/theme')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok && data.theme) {
          applyCustomTheme(data.theme);
        }
      })
      .catch(function () {});
  }

  /* ═══ TECLA CORINGA ESC (FECHAR QUALQUER MODAL / POPUP / OVERLAY) ═══ */
  function fecharTodosModaisEPopups() {
    var activeModals = document.querySelectorAll('.modal.active, .modal-overlay.active, .modal-backdrop.active, [class*="modal"].active, [class*="overlay"].active');
    for (var i = 0; i < activeModals.length; i++) {
      activeModals[i].classList.remove('active', 'open', 'show');
      activeModals[i].style.display = 'none';
    }

    var inlineModals = document.querySelectorAll('[id*="modal"], [class*="modal"], [id*="dialog"], [class*="popup"], [id*="popup"]');
    for (var j = 0; j < inlineModals.length; j++) {
      var el = inlineModals[j];
      if (el.id !== 'admin-panel' && el.id !== 'login-container' && el.id !== 'app' && el.id !== 'theme-live-preview-box') {
        var style = window.getComputedStyle(el);
        if (style.display !== 'none' && (style.position === 'fixed' || style.position === 'absolute' || el.classList.contains('active'))) {
          el.style.display = 'none';
          el.classList.remove('active', 'open', 'show');
        }
      }
    }

    var dropdowns = document.querySelectorAll('.dropdown-menu.active, .dropdown-menu.show, .dropdown-menu[style*="display: block"]');
    for (var k = 0; k < dropdowns.length; k++) {
      dropdowns[k].classList.remove('active', 'show');
      dropdowns[k].style.display = 'none';
    }

    var sidebar = document.querySelector('.sidebar.open');
    var sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('open');

    var impostorAlert = document.getElementById('impostor-live-alert');
    if (impostorAlert) impostorAlert.remove();

    if (typeof window.fecharModalAfiliado === 'function') window.fecharModalAfiliado();
    if (typeof window.fecharModalAfiliadoDetalhes === 'function') window.fecharModalAfiliadoDetalhes();
    if (typeof window.fecharModalNovaTaskSuporte === 'function') window.fecharModalNovaTaskSuporte();
    if (typeof window.fecharModalEnviarAvisoSuporte === 'function') window.fecharModalEnviarAvisoSuporte();
    if (typeof window.fecharModalCriarMissaoSurpresa === 'function') window.fecharModalCriarMissaoSurpresa();
    if (typeof window.fecharModalSenhaAdmin === 'function') window.fecharModalSenhaAdmin();
    if (typeof window.fecharModalLoginFuncionarioMobile === 'function') window.fecharModalLoginFuncionarioMobile();
  }

  window.fecharTodosModaisEPopups = fecharTodosModaisEPopups;

  document.addEventListener('keydown', function(evt) {
    if (evt.key === 'Escape' || evt.keyCode === 27) {
      fecharTodosModaisEPopups();
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    var saved = getSavedTheme();
    updateThemeUI(saved);
    if (_lastCfg) {
      try {
        var tOn = (_lastCfg.fontSizeScale && _lastCfg.fontSizeScale !== '1') ||
          (_lastCfg.btnScale && _lastCfg.btnScale !== '1') ||
          (_lastCfg.cardPadY && _lastCfg.cardPadY !== '10px') ||
          (_lastCfg.cardPadX && _lastCfg.cardPadX !== '12px') ||
          (_lastCfg.modalWidth && _lastCfg.modalWidth !== 'none');
        document.body.classList.toggle('chef-sizes-on', !!tOn);
      } catch (e) { }
      renderCoringa(_lastCfg);
    }
  });

  var initialTheme = getSavedTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  window.ChefTheme = {
    get: getSavedTheme,
    set: applyTheme,
    toggle: function () {
      var current = document.documentElement.getAttribute('data-theme') || getSavedTheme();
      var next = (current === 'dark') ? 'light' : 'dark';
      applyTheme(next);
      return next;
    },
    applyCustom: applyCustomTheme,
    reloadGlobal: fetchAndApplyGlobalTheme
  };

  fetchAndApplyGlobalTheme();

  // Propagacao em tempo real: super admin salva -> servidor emite tema_global_atualizado
  var temaSocketTries = 0;
  function bindTemaSocket() {
    if (temaSocketTries++ > 20) return;
    if (!window.socket && typeof io === 'function') {
      try { window.socket = io(); } catch (e) { }
    }
    if (!window.socket) {
      setTimeout(bindTemaSocket, 1500);
      return;
    }
    try {
      window.socket.on('tema_global_atualizado', function (theme) {
        applyCustomTheme(theme);
      });
    } catch (e) { }
  }
  bindTemaSocket();
})();
