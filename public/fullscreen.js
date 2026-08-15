(function() {
  const btn = document.createElement('button');
  btn.id = 'btn-global-fullscreen';
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
  btn.title = "Tela Cheia";
  
  // Base styles (no longer fixed so it flows with the layout)
  btn.style.width = '36px';
  btn.style.height = '36px';
  btn.style.borderRadius = '8px';
  btn.style.backgroundColor = 'transparent';
  btn.style.color = 'inherit';
  btn.style.border = '1px solid currentColor';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.justifyContent = 'center';
  btn.style.alignItems = 'center';
  btn.style.transition = 'all 0.2s ease';
  btn.style.opacity = '0.7';
  
  btn.onmouseover = () => btn.style.opacity = '1';
  btn.onmouseout = () => btn.style.opacity = '0.7';

  function createGearButton() {
    const gear = document.createElement('button');
    gear.id = 'btn-fila-settings';
    gear.innerHTML = '<i class="ph ph-gear" style="font-size: 20px;"></i>';
    gear.title = 'Configurações da Fila';
    gear.style.width = '36px';
    gear.style.height = '36px';
    gear.style.borderRadius = '8px';
    gear.style.backgroundColor = 'transparent';
    gear.style.color = 'inherit';
    gear.style.border = '1px solid currentColor';
    gear.style.cursor = 'pointer';
    gear.style.display = 'flex';
    gear.style.justifyContent = 'center';
    gear.style.alignItems = 'center';
    gear.style.transition = 'all 0.2s ease';
    gear.style.opacity = '0.7';
    gear.onmouseover = () => gear.style.opacity = '1';
    gear.onmouseout = () => gear.style.opacity = '0.7';
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

  function injectButton() {
    if (document.getElementById('btn-global-fullscreen')) return;
    
    const headerRightActions = document.getElementById('header-right-actions');
    const topMenubar = document.querySelector('.top-menubar');
    const headerElement = document.querySelector('.header') || document.querySelector('header');
    const gearBtn = document.getElementById('modal-fila-settings') ? createGearButton() : null;
    
    if (headerRightActions) {
      btn.style.color = 'inherit';
      btn.style.border = '1px solid rgba(255,255,255,0.3)';
      btn.style.padding = '4px';
      btn.style.width = '38px';
      btn.style.height = '38px';
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '6px';
      if (gearBtn) {
        gearBtn.style.border = '1px solid rgba(255,255,255,0.3)';
        gearBtn.style.padding = '4px';
        gearBtn.style.width = '38px';
        gearBtn.style.height = '38px';
        wrap.appendChild(gearBtn);
      }
      wrap.appendChild(btn);
      headerRightActions.prepend(wrap);
    } else if (topMenubar) {
      const wrapper = document.createElement('div');
      wrapper.style.marginLeft = 'auto';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '6px';
      wrapper.style.paddingRight = '10px';
      btn.style.color = '#333';
      btn.style.border = 'none';
      btn.style.backgroundColor = '#f1f5f9';
      if (gearBtn) {
        gearBtn.style.color = '#333';
        gearBtn.style.border = 'none';
        gearBtn.style.backgroundColor = '#f1f5f9';
        wrapper.appendChild(gearBtn);
      }
      wrapper.appendChild(btn);
      topMenubar.appendChild(wrapper);
    } else if (headerElement) {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '6px';
      wrapper.style.marginLeft = '8px';
      btn.style.color = headerElement.style.color || 'inherit';
      if (gearBtn) wrapper.appendChild(gearBtn);
      wrapper.appendChild(btn);
      headerElement.appendChild(wrapper);
    } else {
      btn.style.position = 'fixed';
      btn.style.top = '10px';
      btn.style.zIndex = '999999';
      btn.style.backgroundColor = '#333';
      btn.style.color = 'white';
      btn.style.right = '10px';
      document.body.appendChild(btn);
      if (gearBtn) {
        gearBtn.style.position = 'fixed';
        gearBtn.style.top = '10px';
        gearBtn.style.zIndex = '999999';
        gearBtn.style.backgroundColor = '#333';
        gearBtn.style.color = 'white';
        gearBtn.style.right = '56px';
        document.body.appendChild(gearBtn);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', injectButton);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    injectButton();
  }

  function toggleFullScreen(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log('Erro ao tentar fullscreen: ' + err.message);
      });
      btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
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
        document.documentElement.requestFullscreen().catch(e => {});
      }
    };
    document.addEventListener('click', autoFullscreen, {capture: true, once: true});
    document.addEventListener('touchstart', autoFullscreen, {capture: true, once: true});
  }
})();
