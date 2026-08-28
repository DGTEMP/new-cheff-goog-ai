/**
 * chef-layout-injetor.js
 * Injeta em tempo real os estilos customizados aplicados pelo Suporte (Globalmente ou por Tenant)
 */
(function() {
  function aplicarCssInjetado() {
    const rid = localStorage.getItem('restaurante_id') || 1;
    const url = '/api/layout/injected-css?restaurante_id=' + rid + '&t=' + Date.now();

    let styleTag = document.getElementById('chef-injected-custom-css');
    if (!styleTag) {
      styleTag = document.createElement('link');
      styleTag.id = 'chef-injected-custom-css';
      styleTag.rel = 'stylesheet';
      document.head.appendChild(styleTag);
    }
    styleTag.href = url;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarCssInjetado);
  } else {
    aplicarCssInjetado();
  }

  // Hot Reload via Socket.io
  if (typeof io !== 'undefined') {
    try {
      const socket = (typeof window.socket !== 'undefined' && window.socket) ? window.socket : io();
      socket.on('layout_override_updated', function() {
        console.log('[Chef Injetor] Atualização de layout recebida ao vivo!');
        aplicarCssInjetado();
      });
    } catch(e) {}
  }
})();
