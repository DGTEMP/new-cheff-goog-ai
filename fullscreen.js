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

  // ─── ROTAÇÃO REMOVIDA ──────────────────────────────────────────────────────
  // O botão de rotação foi removido de TODAS as telas. A orientação agora é
  // controlada exclusivamente no totem.html, via comando remoto do dono
  // (socket 'totem_rotacionar' tratado dentro do próprio totem.js).

  // Na tela principal do CAIXA (index.html) a barra deve ter SOMENTE o botão
  // de tela cheia — sem modo noturno.
  var IS_CAIXA_PAGE = location.pathname === '/' || /\/index\.html$/i.test(location.pathname);

  // SVG icons
  var SVG_FS_IN  = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
  var SVG_FS_OUT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';

  // ─── FULLSCREEN BUTTON ──────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'btn-global-fullscreen';
  btn.innerHTML = SVG_FS_IN;
  btn.title = 'Tela Cheia';

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

  // ─── ROTATION LOGIC ─────────────────────────────────────────────────────────
  // Somente APIs nativas (Fullscreen + Screen Orientation). O antigo fallback
  // de transform CSS no <html> quebrava o layout de TODAS as páginas e era
  // reaplicado via localStorage — foi removido de propósito.
  function setRotatedUi(rotated) {
    isRotated = rotated;
    if (rotated) {
      rotBtn.style.opacity = '1';
      rotBtn.style.color = 'var(--primary, #fc4b15)';
      rotBtn.title = 'Desfazer Rotação';
    } else {
      rotBtn.style.opacity = '0.7';
      rotBtn.style.color = 'inherit';
      rotBtn.title = 'Rotacionar Tela';
    }
  }

  function notify(msg) {
    if (!document.body) return;
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:80px;' +
      'z-index:2147483647;background:#1f2937;color:#fff;padding:10px 16px;border-radius:8px;' +
      'font-size:13px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);' +
      'max-width:90vw;text-align:center;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }

  function applyRotation(rotated) {
    setRotatedUi(rotated);
    if (!rotated) {
      if (screen.orientation && screen.orientation.unlock) {
        try { screen.orientation.unlock(); } catch (err) { }
      }
      return;
    }

    // A trava de orientação exige tela cheia na maioria dos navegadores/PWAs.
    var openedFsHere = false;
    var enterFs = Promise.resolve();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      enterFs = document.documentElement.requestFullscreen().then(function () {
        openedFsHere = true;
      }).catch(function () { });
    }

    enterFs.then(function () {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function () {
          // Falhou (desktop com monitor fixo, iOS Safari, permissão negada):
          // desfaz sem tocar no layout — apenas avisa o usuário.
          if (openedFsHere && document.exitFullscreen) {
            try { document.exitFullscreen(); } catch (err) { }
          }
          setRotatedUi(false);
          notify('Não foi possível travar a orientação neste dispositivo. Use a rotação/paisagem do próprio monitor ou aparelho.');
        });
      } else {
        if (openedFsHere && document.exitFullscreen) {
          try { document.exitFullscreen(); } catch (err) { }
        }
        setRotatedUi(false);
        notify('Este navegador não suporta travar a orientação. Use a rotação do sistema.');
      }
    });
  }

  rotBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    applyRotation(!isRotated);
  });

  // Sair da tela cheia derruba a trava de orientação — sincroniza o botão
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && isRotated) setRotatedUi(false);
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
      if (!IS_CAIXA_PAGE) { styleForDark(rotBtn); styleForDark(darkBtn); }
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '6px';
      if (gearBtn) { styleForDark(gearBtn); wrap.appendChild(gearBtn); }
      if (!IS_CAIXA_PAGE) { wrap.appendChild(darkBtn); wrap.appendChild(rotBtn); }
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
      if (!IS_CAIXA_PAGE) { styleForLight(rotBtn); styleForLight(darkBtn); }
      if (gearBtn) { styleForLight(gearBtn); wrapper.appendChild(gearBtn); }
      if (!IS_CAIXA_PAGE) { wrapper.appendChild(darkBtn); wrapper.appendChild(rotBtn); }
      wrapper.appendChild(btn);
      topMenubar.appendChild(wrapper);

    } else if (headerElement) {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '6px';
      wrapper.style.marginLeft = '8px';
      if (gearBtn) wrapper.appendChild(gearBtn);
      if (!IS_CAIXA_PAGE) { wrapper.appendChild(darkBtn); wrapper.appendChild(rotBtn); }
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

      if (!IS_CAIXA_PAGE) {
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
