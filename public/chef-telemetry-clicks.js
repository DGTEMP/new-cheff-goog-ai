/**
 * chef-telemetry-clicks.js — Captura de Cliques, Funções, Tempos de Tarefas e Coordenadas para Heatmap
 */
(function (window, document) {
  'use strict';

  var clickBuffer = [];
  var lastTaskStartTime = Date.now();

  function getElementFriendlyName(el) {
    if (!el) return 'Elemento Desconhecido';
    
    // 1. Textos diretos ou aria-label / title
    var title = el.getAttribute('title') || el.getAttribute('aria-label');
    if (title && title.trim()) return title.trim();

    var text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text && text.length <= 40) return text;

    // 2. ID ou dataset
    var id = el.id || el.dataset.action || el.dataset.role;
    if (id) return id.replace(/[-_]/g, ' ');

    return el.tagName.toLowerCase();
  }

  function capturarClique(e) {
    try {
      var target = e.target;
      var clickable = target.closest('button, a, .btn-action, .mesa-item, .table-card, .menu-item, input, select, .chip-view-btn, .dock-mini-btn, [onclick], [data-action]');
      if (!clickable) return;

      var rect = document.documentElement.getBoundingClientRect();
      var xPct = rect.width > 0 ? Math.round((e.clientX / rect.width) * 1000) / 10 : 50;
      var yPct = rect.height > 0 ? Math.round((e.clientY / rect.height) * 1000) / 10 : 50;

      var tempoExecucao = Date.now() - lastTaskStartTime;
      lastTaskStartTime = Date.now();

      var funcaoNome = getElementFriendlyName(clickable);
      var elementoId = clickable.id || clickable.className || clickable.tagName;

      var colaboradorNome = localStorage.getItem('chef_operador_nome') || 
                            (window.crmPerfil ? window.crmPerfil.nome : null) || 
                            localStorage.getItem('crm_usuario') || 'Anônimo';

      var colaboradorCargo = localStorage.getItem('chef_operador_cargo') || 
                             (window.crmPerfil ? window.crmPerfil.cargo : null) || 'Colaborador';

      var restauranteId = localStorage.getItem('chef_restaurante_id') || 
                          localStorage.getItem('tenant_id') || 
                          (window.RESTAURANTE_ID ? String(window.RESTAURANTE_ID) : '1');

      var restauranteNome = localStorage.getItem('chef_restaurante_nome') || 
                            localStorage.getItem('tenant_nome') || 'Restaurante Principal';

      var tela = window.location.pathname.split('/').pop() || 'index.html';

      var evento = {
        restaurante_id: restauranteId,
        restaurante_nome: restauranteNome,
        colaborador_nome: colaboradorNome,
        colaborador_cargo: colaboradorCargo,
        tela: tela,
        funcao_nome: funcaoNome,
        elemento_id: String(elementoId).substring(0, 100),
        pos_x_pct: xPct,
        pos_y_pct: yPct,
        tempo_execucao_ms: Math.min(tempoExecucao, 300000), // cap 5 min
        dispositivo: window.innerWidth < 768 ? 'Mobile' : (window.innerWidth < 1200 ? 'Tablet' : 'Desktop'),
        resolucao: window.innerWidth + 'x' + window.innerHeight,
        timestamp: Date.now()
      };

      clickBuffer.push(evento);
      if (clickBuffer.length >= 10) flushClicks();
    } catch (err) {}
  }

  function flushClicks() {
    if (clickBuffer.length === 0) return;
    var toSend = clickBuffer.slice();
    clickBuffer = [];

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify({ clicks: toSend })], { type: 'application/json' });
        navigator.sendBeacon('/api/telemetria/clicks', blob);
      } else {
        fetch('/api/telemetria/clicks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clicks: toSend }),
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {}
  }

  document.addEventListener('click', capturarClique, { passive: true });
  setInterval(flushClicks, 6000);
  window.addEventListener('beforeunload', flushClicks);

})(window, document);
