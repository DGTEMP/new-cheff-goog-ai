/**
 * Frontend Core: Balança Comercial
 */
(function () {
  if (!window.ChefModules) return;

  ChefModules.register({
    id: 'balanca',
    name: 'Balança Comercial',
    icon: 'ph-scales'
  }, ({ registerNavbarAction, on }) => {
    
    // Injeta botão na barra de navegação superior se estiver no PDV
    registerNavbarAction({
      id: 'balanca_nav_btn',
      label: 'Balança Comercial',
      icon: 'ph-scales',
      onClick() {
        console.log('[Módulo Balança Comercial] Ação disparada!');
      }
    });

    // Ouve eventos do barramento
    on('pedido_criado', (pedido) => {
      // Reagir a novos pedidos de forma desacoplada
    });

  });
})();
