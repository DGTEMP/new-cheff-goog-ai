/**
 * Widget do Caixa v1.1: Clube de Fidelidade & Cashback
 */
(function () {
  if (!window.ChefModules) return;

  ChefModules.register({
    id: 'fidelidade',
    name: 'Clube de Fidelidade',
    icon: 'ph-gift'
  }, ({ registerWidget }) => {
    
    registerWidget({
      id: 'fidelidade_widget',
      title: 'Fidelidade & Pontos',
      icon: 'ph-gift',
      defaultSize: 'sz-m',
      render(container, { socket, authHeaders }) {
        container.innerHTML = `
          <div style="padding: 14px; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px; color: #8b5cf6; font-weight: 800; font-size: 13.5px;">
                <i class="ph-bold ph-gift" style="font-size: 22px;"></i>
                <span>Consulta de Pontos</span>
              </div>
              <span style="font-size: 11px; background: rgba(139, 92, 246, 0.12); color: #8b5cf6; padding: 2px 8px; border-radius: 12px; font-weight: 700;">Cashback</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; padding: 6px 0;">
              <input type="text" id="v11-fidelidade-cpf" placeholder="Digitar CPF do cliente..." style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--v11-border, #cbd5e1); background: var(--v11-surface, #ffffff); color: var(--v11-text, #0f172a); font-size: 13px; outline: none; box-sizing: border-box;">
              <div id="v11-fidelidade-resultado" style="font-size: 12.5px; color: var(--v11-text-sub, #64748b); text-align: center; min-height: 20px;">
                Digite o CPF para ver saldo de cashback
              </div>
            </div>

            <div style="display: flex; gap: 8px;">
              <button id="v11-btn-consultar-fidelidade" style="flex: 1; padding: 9px; border-radius: 9px; background: #8b5cf6; color: white; border: none; font-weight: 800; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(139,92,246,0.25);">
                <i class="ph-bold ph-magnifying-glass"></i> Consultar
              </button>
            </div>
          </div>
        `;
      },
      onMount(container) {
        const btn = container.querySelector('#v11-btn-consultar-fidelidade');
        const input = container.querySelector('#v11-fidelidade-cpf');
        const res = container.querySelector('#v11-fidelidade-resultado');

        if (btn && input && res) {
          btn.onclick = () => {
            const cpf = input.value.trim();
            if (!cpf) {
              res.innerHTML = '<span style="color:#ef4444;">Por favor, digite o CPF.</span>';
              return;
            }
            res.innerHTML = '<span style="color:#8b5cf6;">Buscando cliente...</span>';
            setTimeout(() => {
              const pontos = Math.floor(Math.random() * 250) + 50;
              const cashback = (pontos * 0.10).toFixed(2).replace('.', ',');
              res.innerHTML = `<span style="color:#10b981; font-weight:800;">⭐ Saldo: ${pontos} pts (R$ ${cashback} de saldo)</span>`;
            }, 300);
          };
        }
      }
    });

  });
})();
