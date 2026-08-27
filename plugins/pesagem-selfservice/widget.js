/**
 * Widget do Caixa v1.1: Balança Automática & Totem de Pesagem
 */
(function () {
  if (!window.ChefModules) return;

  ChefModules.register({
    id: 'pesagem-selfservice',
    name: 'Pesagem Automática & Buffet',
    icon: 'ph-scales'
  }, ({ registerWidget, registerNavbarAction }) => {

    // 1. Botão na Barra de Ferramentas para Abrir o Totem
    registerNavbarAction({
      id: 'btn_totem_balanca',
      label: 'Totem Balança',
      icon: 'ph-scales',
      onClick() {
        window.open('/plugins/pesagem-selfservice/totem', '_blank');
      }
    });

    // 2. Widget Completo no Grid do Caixa v1.1
    registerWidget({
      id: 'widget_pesagem_selfservice',
      title: 'Balança & Buffet Automático',
      icon: 'ph-scales',
      defaultSize: 'sz-m',
      render(container) {
        container.innerHTML = `
          <div style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box; background: var(--v11-surface, #ffffff); border-radius: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px; color: #fc4b15; font-weight: 800; font-size: 13.5px;">
                <i class="ph-bold ph-scales" style="font-size: 22px;"></i>
                <span>Balança Inteligente</span>
              </div>
              <a href="/plugins/pesagem-selfservice/totem" target="_blank" style="font-size: 11px; background: rgba(252, 75, 21, 0.12); color: #fc4b15; padding: 3px 8px; border-radius: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                <i class="ph-bold ph-arrow-square-out"></i> Abrir Totem
              </a>
            </div>

            <div style="text-align: center; padding: 8px 0;">
              <span style="font-size: 11px; color: var(--v11-text-sub, #64748b); font-weight: 700; text-transform: uppercase;">Peso Líquido Atual</span>
              <div id="v11-peso-auto-display" style="font-size: 32px; font-weight: 900; color: var(--v11-text, #0f172a); font-family: monospace; letter-spacing: -1px; margin: 4px 0;">
                0.000 <small style="font-size: 16px; font-weight: 700; color: #64748b;">kg</small>
              </div>
              <div id="v11-valor-auto-display" style="font-size: 16px; font-weight: 800; color: #10b981;">
                R$ 0,00
              </div>
            </div>

            <div style="display: flex; gap: 8px;">
              <button id="v11-btn-pesar-rapido" style="flex: 1; padding: 10px; border-radius: 10px; background: #fc4b15; color: white; border: none; font-weight: 800; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(252,75,21,0.25);">
                <i class="ph-bold ph-lightning"></i> Pesar & Lançar
              </button>
              <button id="v11-btn-buffet-fixo" style="padding: 10px 14px; border-radius: 10px; background: #10b981; color: white; border: none; font-weight: 800; font-size: 12px; cursor: pointer;">
                Livre
              </button>
            </div>
          </div>
        `;
      },
      onMount(container) {
        const btnPesar = container.querySelector('#v11-btn-pesar-rapido');
        const btnLivre = container.querySelector('#v11-btn-buffet-fixo');
        const displayPeso = container.querySelector('#v11-peso-auto-display');
        const displayValor = container.querySelector('#v11-valor-auto-display');

        let pesoSimulado = 0.520;
        let precoKg = 69.90;
        let tara = 0.450;

        fetch('/api/modulo/pesagem-selfservice/config')
          .then(r => r.json())
          .then(d => {
            if (d && d.sucesso && d.config) {
              precoKg = d.config.precoKg;
              tara = d.config.taraPratoKg;
            }
          });

        if (btnPesar) {
          btnPesar.onclick = () => {
            pesoSimulado = (0.350 + Math.random() * 0.400);
            const liq = Math.max(0, pesoSimulado - tara);
            const val = liq * precoKg;

            displayPeso.innerHTML = `${liq.toFixed(3)} <small style="font-size: 16px; font-weight: 700; color: #64748b;">kg</small>`;
            displayValor.innerText = `R$ ${val.toFixed(2).replace('.', ',')}`;

            fetch('/api/modulo/pesagem-selfservice/pesar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pesoBruto: pesoSimulado, modo: 'peso' })
            }).then(r => r.json()).then(res => {
              if (res && res.sucesso) {
                if (typeof Swal !== 'undefined') {
                  Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Ticket ${res.registro.id} Gerado: R$ ${val.toFixed(2)}`, showConfirmButton: false, timer: 2500 });
                }
              }
            });
          };
        }

        if (btnLivre) {
          btnLivre.onclick = () => {
            fetch('/api/modulo/pesagem-selfservice/pesar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ modo: 'livre' })
            }).then(r => r.json()).then(res => {
              if (res && res.sucesso) {
                if (typeof Swal !== 'undefined') {
                  Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Buffet Livre Registrado!`, showConfirmButton: false, timer: 2000 });
                }
              }
            });
          };
        }
      }
    });

  });
})();
