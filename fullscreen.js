(function() {

  // ─── DARK MODE CSS INJECTION ─────────────────────────────────────────────────
  // Inject dark-mode.css if not already present (for pages that don't load it directly)
  if (!document.querySelector('link[href*="dark-mode.css"]')) {
    var dmLink = document.createElement('link');
    dmLink.rel = 'stylesheet';
    dmLink.href = '/dark-mode.css';
    document.head.appendChild(dmLink);
  }

  // ─── DARK MODE STATE ─────────────────────────────────────────────────────────
  var DARK_KEY = 'chef_garcom_theme';
  // Unificado: prefere a chave do theme-manager (chef_theme) para os dois sistemas nunca divergirem
  var isDark = (function() {
    try {
      var t = localStorage.getItem('chef_theme');
      if (t === 'dark') return true;
      if (t === 'light') return false;
    } catch (e) { }
    return localStorage.getItem(DARK_KEY) === 'dark';
  })();

  // Apply immediately on load (before DOMContentLoaded to avoid flash)
  if (isDark) document.documentElement.classList.add('dark-mode-pre');

  // ─── ROTATION STATE ────────────────────────────────────────────────────────
  var ROTATE_KEY = 'chef_screen_rotated';
  var isRotated = localStorage.getItem(ROTATE_KEY) === '1';

  // SVG icons
  var SVG_ROTATE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6"/><path d="M2.5 12A10 10 0 0 1 18.8 4.3l2.7 3.7"/><path d="M2.5 22v-6h6"/><path d="M21.5 12A10 10 0 0 1 5.2 19.7l-2.7-3.7"/></svg>';
  var SVG_FS_IN  = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
  var SVG_FS_OUT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';

  // ─── FULLSCREEN BUTTON ──────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'btn-global-fullscreen';
  btn.innerHTML = SVG_FS_IN;
  btn.title = 'Tela Cheia';

  // ─── ROTATE BUTTON ──────────────────────────────────────────────────────────
  var rotBtn = document.createElement('button');
  rotBtn.id = 'btn-global-rotate';
  rotBtn.innerHTML = SVG_ROTATE;
  rotBtn.title = 'Rotacionar Tela';

  // ─── DARK MODE BUTTON ────────────────────────────────────────────────────────
  var SVG_MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var SVG_SUN  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  var darkBtn = document.createElement('button');
  darkBtn.id = 'btn-global-darkmode';
  darkBtn.innerHTML = isDark ? SVG_SUN : SVG_MOON;
  darkBtn.title = isDark ? 'Modo Claro' : 'Modo Noturno';

  function applyButtonStyle(b) {
    b.style.width = '36px';
    b.style.height = '36px';
    b.style.borderRadius = '8px';
    b.style.backgroundColor = 'transparent';
    b.style.color = 'inherit';
    b.style.border = '1px solid currentColor';
    b.style.cursor = 'pointer';
    b.style.display = 'flex';
    b.style.justifyContent = 'center';
    b.style.alignItems = 'center';
    b.style.transition = 'all 0.2s ease';
    b.style.opacity = '0.7';
    b.onmouseover = function() { b.style.opacity = '1'; };
    b.onmouseout  = function() { b.style.opacity = '0.7'; };
  }

  applyButtonStyle(btn);
  applyButtonStyle(rotBtn);
  applyButtonStyle(darkBtn);

  // ─── DARK MODE LOGIC ─────────────────────────────────────────────────────────
  function applyDarkMode(dark) {
    document.body.classList.toggle('dark-mode', dark);
    document.documentElement.classList.toggle('dark-mode', dark);
    darkBtn.innerHTML = dark ? SVG_SUN : SVG_MOON;
    darkBtn.title = dark ? 'Modo Claro' : 'Modo Noturno';
    darkBtn.style.opacity = dark ? '1' : '0.7';
    darkBtn.style.color = dark ? '#f59e0b' : 'inherit';
  }

  // Apply saved theme on DOM ready (promotes pre-class to body.dark-mode)
  function applyDarkOnLoad() {
    // Only apply if body.dark-mode isn't already managed by the page itself
    // (garcom.html manages its own via garcom.js — avoid double-toggle)
    var pageManages = !!document.getElementById('btn-theme-toggle');
    if (!pageManages && isDark) {
      applyDarkMode(true);
    } else if (pageManages) {
      // Sync icon with garcom.js state
      var bodyIsDark = document.body.classList.contains('dark-mode');
      isDark = bodyIsDark;
      darkBtn.innerHTML = bodyIsDark ? SVG_SUN : SVG_MOON;
      darkBtn.style.color = bodyIsDark ? '#f59e0b' : 'inherit';
      darkBtn.style.opacity = bodyIsDark ? '1' : '0.7';
    }
    document.documentElement.classList.remove('dark-mode-pre');
  }
  document.addEventListener('DOMContentLoaded', applyDarkOnLoad);
  if (document.readyState === 'complete' || document.readyState === 'interactive') applyDarkOnLoad();

  darkBtn.addEventListener('click', function(e) {
    e.preventDefault(); e.stopPropagation();
    isDark = !isDark;
    localStorage.setItem(DARK_KEY, isDark ? 'dark' : 'light');
    try { localStorage.setItem('chef_theme', isDark ? 'dark' : 'light'); } catch (err) { }
    // Mantém o sistema do theme-manager alinhado quando a página usa os dois
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    applyDarkMode(isDark);
    // Sync garcom.js button if present
    var garcomBtn = document.getElementById('btn-theme-toggle');
    if (garcomBtn) garcomBtn.innerHTML = isDark ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
  });

  // ─── CSS TRANSFORM ROTATION ─────────────────────────────────────────────────
  function applyCssRotation(on) {
    var html = document.documentElement;
    if (on) {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      html.style.transform = 'rotate(90deg)';
      html.style.transformOrigin = 'top left';
      html.style.width  = vh + 'px';
      html.style.height = vw + 'px';
      html.style.position = 'absolute';
      html.style.top  = '0';
      html.style.left = vh + 'px';
      html.style.overflow = 'hidden';
    } else {
      html.style.transform = '';
      html.style.transformOrigin = '';
      html.style.width  = '';
      html.style.height = '';
      html.style.position = '';
      html.style.top  = '';
      html.style.left = '';
      html.style.overflow = '';
    }
  }

  // ─── ROTATION LOGIC ─────────────────────────────────────────────────────────
  function applyRotation(rotated) {
    if (rotated) {
      // Try native Screen Orientation API first (works in fullscreen / PWA on Android)
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function() {
          applyCssRotation(true);
        });
      } else {
        applyCssRotation(true);
      }
      rotBtn.style.opacity = '1';
      rotBtn.style.color = 'var(--primary, #fc4b15)';
      rotBtn.title = 'Desfazer Rotação';
    } else {
      if (screen.orientation && screen.orientation.unlock) {
        try { screen.orientation.unlock(); } catch(e) {}
      }
      applyCssRotation(false);
      rotBtn.style.opacity = '0.7';
      rotBtn.style.color = 'inherit';
      rotBtn.title = 'Rotacionar Tela';
    }
  }

  // Apply stored rotation state on page load
  if (isRotated) {
    document.addEventListener('DOMContentLoaded', function() { applyRotation(true); });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      applyRotation(true);
    }
  }

  rotBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    isRotated = !isRotated;
    localStorage.setItem(ROTATE_KEY, isRotated ? '1' : '0');
    applyRotation(isRotated);
  });

  // ─── GEAR BUTTON (existing) ──────────────────────────────────────────────────
  function createGearButton() {
    const gear = document.createElement('button');
    gear.id = 'btn-fila-settings';
    gear.innerHTML = '<i class="ph ph-gear" style="font-size: 20px;"></i>';
    gear.title = 'Configurações da Fila';
    applyButtonStyle(gear);
    gear.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var popup = document.getElementById('modal-fila-settings');
      if (popup) {
        popup.style.display = popup.style.display === 'flex' ? 'none' : 'flex';
      }
    });
    return gear;
  }

  // ─── INJECT BUTTONS ──────────────────────────────────────────────────────────
  function injectButton() {
    if (document.getElementById('btn-global-fullscreen')) return;

    const headerRightActions = document.getElementById('header-right-actions');
    const topMenubar = document.querySelector('.top-menubar');
    const headerElement = document.querySelector('.header') || document.querySelector('header');
    const gearBtn = document.getElementById('modal-fila-settings') ? createGearButton() : null;

    function styleForDark(b) {
      b.style.border = '1px solid rgba(255,255,255,0.3)';
      b.style.padding = '4px';
      b.style.width = '38px';
      b.style.height = '38px';
    }
    function styleForLight(b) {
      b.style.color = '#333';
      b.style.border = 'none';
      b.style.backgroundColor = '#f1f5f9';
    }

    if (headerRightActions) {
      styleForDark(btn);
      styleForDark(rotBtn);
      styleForDark(darkBtn);
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '6px';
      if (gearBtn) { styleForDark(gearBtn); wrap.appendChild(gearBtn); }
      wrap.appendChild(darkBtn);
      wrap.appendChild(rotBtn);
      wrap.appendChild(btn);
      headerRightActions.prepend(wrap);

    } else if (topMenubar) {
      const wrapper = document.createElement('div');
      wrapper.style.marginLeft = 'auto';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '6px';
      wrapper.style.paddingRight = '10px';
      styleForLight(btn);
      styleForLight(rotBtn);
      styleForLight(darkBtn);
      if (gearBtn) { styleForLight(gearBtn); wrapper.appendChild(gearBtn); }
      wrapper.appendChild(darkBtn);
      wrapper.appendChild(rotBtn);
      wrapper.appendChild(btn);
      topMenubar.appendChild(wrapper);

    } else if (headerElement) {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '6px';
      wrapper.style.marginLeft = '8px';
      if (gearBtn) wrapper.appendChild(gearBtn);
      wrapper.appendChild(darkBtn);
      wrapper.appendChild(rotBtn);
      wrapper.appendChild(btn);
      headerElement.appendChild(wrapper);

    } else {
      // Floating fallback (no header found)
      btn.style.position = 'fixed';
      btn.style.top = '10px';
      btn.style.right = '10px';
      btn.style.zIndex = '999999';
      btn.style.backgroundColor = '#333';
      btn.style.color = 'white';
      document.body.appendChild(btn);

      rotBtn.style.position = 'fixed';
      rotBtn.style.top = '10px';
      rotBtn.style.right = '56px';
      rotBtn.style.zIndex = '999999';
      rotBtn.style.backgroundColor = '#333';
      rotBtn.style.color = 'white';
      document.body.appendChild(rotBtn);

      darkBtn.style.position = 'fixed';
      darkBtn.style.top = '10px';
      darkBtn.style.right = '102px';
      darkBtn.style.zIndex = '999999';
      darkBtn.style.backgroundColor = '#333';
      darkBtn.style.color = isDark ? '#f59e0b' : 'white';
      document.body.appendChild(darkBtn);

      if (gearBtn) {
        gearBtn.style.position = 'fixed';
        gearBtn.style.top = '10px';
        gearBtn.style.right = '148px';
        gearBtn.style.zIndex = '999999';
        gearBtn.style.backgroundColor = '#333';
        gearBtn.style.color = 'white';
        document.body.appendChild(gearBtn);
      }
    }

    // Highlight rotate button if currently rotated
    if (isRotated) {
      rotBtn.style.opacity = '1';
      rotBtn.style.color = 'var(--primary, #fc4b15)';
    }
    // Highlight dark mode button if currently dark
    if (isDark) {
      darkBtn.style.opacity = '1';
      darkBtn.style.color = '#f59e0b';
    }
  }

  document.addEventListener('DOMContentLoaded', injectButton);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    injectButton();
  }

  // ─── FULLSCREEN LOGIC ────────────────────────────────────────────────────────
  function toggleFullScreen(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function(err) {
        console.log('Erro ao tentar fullscreen: ' + err.message);
      });
      btn.innerHTML = SVG_FS_OUT;
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        btn.innerHTML = SVG_FS_IN;
      }
    }
  }

  btn.addEventListener('click', toggleFullScreen);

  // Auto-fullscreen on mobile upon first interaction
  if (window.innerWidth <= 768) {
    let hasAttempted = false;
    const autoFullscreen = () => {
      if (!hasAttempted && !document.fullscreenElement) {
        hasAttempted = true;
        document.documentElement.requestFullscreen().catch(function(e) {});
      }
    };
    document.addEventListener('click', autoFullscreen, {capture: true, once: true});
    document.addEventListener('touchstart', autoFullscreen, {capture: true, once: true});
  }
})();
