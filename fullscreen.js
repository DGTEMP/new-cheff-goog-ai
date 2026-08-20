(function() {

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
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '6px';
      if (gearBtn) { styleForDark(gearBtn); wrap.appendChild(gearBtn); }
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
      if (gearBtn) { styleForLight(gearBtn); wrapper.appendChild(gearBtn); }
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

      if (gearBtn) {
        gearBtn.style.position = 'fixed';
        gearBtn.style.top = '10px';
        gearBtn.style.right = '102px';
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
