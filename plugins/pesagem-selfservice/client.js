/**
 * Client integration for pesagem-selfservice
 */
(function () {
  if (!window.ChefModules) return;

  ChefModules.register({
    id: 'pesagem-selfservice',
    name: 'Pesagem Automática',
    icon: 'ph-scales'
  }, ({ registerNavbarAction }) => {
    registerNavbarAction({
      id: 'navbar_totem_pesagem',
      label: 'Totem Balança',
      icon: 'ph-scales',
      onClick() {
        window.open('/plugins/pesagem-selfservice/totem', '_blank');
      }
    });
  });
})();
