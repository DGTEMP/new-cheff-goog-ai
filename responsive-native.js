/* ═════════════════════════════════════════════════════════════════════
   CHEF COZINHA — CONTROLE RESPONSIVO "NATIVE APP"
   Mantém 100% a lógica original das barras laterais (recolher no mouse /
   expandir ao clicar no pino ou na alça). Em toque, os FABs apenas
   acionam o mesmo expandir nativo (toggleLeftPanel / toggleRightPanel).
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var mqWide = window.matchMedia('(min-width: 1600px)');

  /* FABs flutuantes (visíveis só em toque via CSS) */
  function makeFab(id, icon, label, aria) {
    var b = document.createElement('button');
    b.id = id;
    b.className = 'chef-drawer-fab';
    b.type = 'button';
    b.setAttribute('aria-label', 'Abrir painel de ações');
    b.innerHTML = '<i class="ph ' + icon + '"></i><span>' + label + '</span>';
    return b;
  }

  document.body.appendChild(makeFab('chef-fab-acoes', 'ph-sliders', 'Ações', 'Abrir painel de ações'));
  document.body.appendChild(makeFab('chef-fab-resumo', 'ph-receipt', 'Resumo', 'Abrir resumo e pagamento'));

  var fabAcoes = document.getElementById('chef-fab-acoes');
  var fabResumo = document.getElementById('chef-fab-resumo');

  /* Reutiliza a lógica nativa de expandir/recolher (in-place) */
  if (fabAcoes) {
    fabAcoes.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.toggleLeftPanel) window.toggleLeftPanel(e);
    });
  }
  if (fabResumo) {
    fabResumo.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.toggleRightPanel) window.toggleRightPanel(e);
    });
  }

  /* Framing ultrawide */
  function apply() {
    document.body.classList.toggle('chef-ui-wide', mqWide.matches);
  }

  apply();

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(apply, 120);
  });

  if (mqWide && mqWide.addEventListener) {
    try { mqWide.addEventListener('change', apply); } catch (e) {}
  }

  /* ── Arraste a tab bar (mobile) para baixo e oculta ── */
  (function () {
    var tabs = document.getElementById('mobile-workspace-tabs');
    if (!tabs) return;

    var grip = document.createElement('div');
    grip.className = 'mobile-tabs-grip';
    grip.setAttribute('aria-label', 'Arraste para baixo para ocultar as abas');
    tabs.insertBefore(grip, tabs.firstChild);

    var restore = document.createElement('button');
    restore.id = 'chef-tabs-restore';
    restore.type = 'button';
    restore.innerHTML = '<i class="ph ph-caret-up"></i> Mostrar abas';
    document.body.appendChild(restore);

    var dragging = false, startY = 0, dy = 0;

    grip.addEventListener('pointerdown', function (e) {
      dragging = true;
      startY = e.clientY;
      dy = 0;
      tabs.style.transition = 'none';
      if (grip.setPointerCapture) {
        try { grip.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });

    grip.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      tabs.style.transform = 'translateY(' + Math.min(dy, 140) + 'px)';
    });

    function end() {
      if (!dragging) return;
      dragging = false;
      tabs.style.transition = '';
      tabs.style.transform = '';
      if (dy > 40) document.body.classList.add('tabs-collapsed');
    }

    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);

    restore.addEventListener('click', function () {
      document.body.classList.remove('tabs-collapsed');
      tabs.style.transform = '';
    });
  })();
})();
