/* ═════════════════════════════════════════════════════════════════════
   CHEF COZINHA — CONTROLE RESPONSIVO "NATIVE APP"
   Decide a faixa de resolução e injeta os FABs/gavetas do modo tablet.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var mqTablet = window.matchMedia('(min-width: 768px) and (max-width: 1100px)');
  var mqWide = window.matchMedia('(min-width: 1600px)');

  function isForcedView() {
    return document.body.classList.contains('force-mobile') ||
           document.body.classList.contains('force-desktop');
  }

  /* Backdrop das gavetas */
  var backdrop = document.createElement('div');
  backdrop.id = 'chef-drawer-backdrop';
  document.body.appendChild(backdrop);

  /* FABs flutuantes */
  function makeFab(id, icon, label, aria) {
    var b = document.createElement('button');
    b.id = id;
    b.className = 'chef-drawer-fab';
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.innerHTML = '<i class="ph ' + icon + '"></i><span>' + label + '</span>';
    return b;
  }

  var fabAcoes = makeFab('chef-fab-acoes', 'ph-sliders', 'Ações', 'Abrir painel de ações');
  var fabResumo = makeFab('chef-fab-resumo', 'ph-receipt', 'Resumo', 'Abrir resumo e pagamento');
  document.body.appendChild(fabAcoes);
  document.body.appendChild(fabResumo);

  function panel(id) { return document.getElementById(id); }

  function closeDrawers() {
    var l = panel('left-panel'), r = panel('right-panel');
    if (l) l.classList.remove('expanded');
    if (r) r.classList.remove('expanded');
    backdrop.classList.remove('show');
  }

  function openDrawer(which) {
    var l = panel('left-panel'), r = panel('right-panel');
    if (which === 'left' && l) {
      var open = l.classList.toggle('expanded');
      if (r) r.classList.remove('expanded');
      backdrop.classList.toggle('show', open);
    } else if (which === 'right' && r) {
      var open2 = r.classList.toggle('expanded');
      if (l) l.classList.remove('expanded');
      backdrop.classList.toggle('show', open2);
    }
  }

  backdrop.addEventListener('click', closeDrawers);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawers();
  });
  fabAcoes.addEventListener('click', function (e) { e.stopPropagation(); openDrawer('left'); });
  fabResumo.addEventListener('click', function (e) { e.stopPropagation(); openDrawer('right'); });

  function apply() {
    var tablet = mqTablet.matches && !isForcedView();
    document.body.classList.toggle('chef-ui-tablet', tablet);
    document.body.classList.toggle('chef-ui-wide', mqWide.matches);
    if (!tablet) closeDrawers();
  }

  apply();

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(apply, 120);
  });

  function watch(mq) {
    if (!mq || !mq.addEventListener) return;
    try { mq.addEventListener('change', apply); } catch (e) {}
  }
  watch(mqTablet);
  watch(mqWide);
})();
