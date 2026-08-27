/**
 * Widget do Caixa v1.1: Balança Comercial & Buffet
 */
(function () {
  if (!window.ChefModules) return;

  ChefModules.register({
    id: 'balanca',
    name: 'Balança Comercial',
    icon: 'ph-scales'
  }, ({ registerWidget }) => {
    
    registerWidget({
      id: 'balanca_widget',
      title: 'Balança Comercial',
      icon: 'ph-scales',
      defaultSize: 'sz-m',
      render(container, { socket, authHeaders }) {
        container.innerHTML = `
          <div style="padding: 14px; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px; color: #d97706; font-weight: 800; font-size: 13.5px;">
                <i class="ph-bold ph-scales" style="font-size: 22px;"></i>
                <span>Pesagem / Buffet</span>
              </div>
              <span style="font-size: 11px; background: rgba(217, 119, 6, 0.12); color: #d97706; padding: 2px 8px; border-radius: 12px; font-weight: 700;">Toledo Prix</span>
            </div>

            <div style="text-align: center; padding: 10px 0;">
              <span style="font-size: 11.5px; color: var(--v11-text-sub, #64748b); font-weight: 600; text-transform: uppercase;">Peso Líquido</span>
              <div id="v11-widget-peso-display" style="font-size: 32px; font-weight: 900; color: var(--v11-text, #0f172a); font-family: monospace; letter-spacing: -1px; margin: 4px 0;">
                0.000 <small style="font-size: 16px; font-weight: 700; color: #64748b;">kg</small>
              </div>
              <span style="font-size: 11px; color: #10b981; font-weight: 700;">
                <i class="ph-fill ph-circle" style="font-size: 8px;"></i> Balança Pronta
              </span>
            </div>

            <div style="display: flex; gap: 8px;">
              <button id="v11-btn-ler-balanca" style="flex: 1; padding: 9px; border-radius: 9px; background: #d97706; color: white; border: none; font-weight: 800; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(217,119,6,0.25);">
                <i class="ph-bold ph-arrows-clockwise"></i> Ler Peso
              </button>
              <button id="v11-btn-tara-balanca" style="padding: 9px 12px; border-radius: 9px; background: var(--v11-surface, #ffffff); border: 1px solid var(--v11-border, #cbd5e1); color: var(--v11-text, #0f172a); font-weight: 700; font-size: 12px; cursor: pointer;">
                Tara (450g)
              </button>
            </div>
          </div>
        `;
      },
      onMount(container) {
        const btnLer = container.querySelector('#v11-btn-ler-balanca');
        const btnTara = container.querySelector('#v11-btn-tara-balanca');
        const display = container.querySelector('#v11-widget-peso-display');

        let taraAtual = 0;

        if (btnTara) {
          btnTara.onclick = () => {
            taraAtual = taraAtual === 0 ? 0.450 : 0;
            btnTara.style.background = taraAtual > 0 ? '#fef3c7' : '';
            btnTara.style.color = taraAtual > 0 ? '#b45309' : '';
            btnTara.innerText = taraAtual > 0 ? 'Tara Ativa (450g)' : 'Tara (450g)';
            if (btnLer) btnLer.click();
          };
        }

        if (btnLer && display) {
          btnLer.onclick = () => {
            display.innerHTML = 'Lendo...';
            setTimeout(() => {
              const pesoBruto = (0.500 + Math.random() * 0.450);
              const liquido = Math.max(0, pesoBruto - taraAtual).toFixed(3);
              display.innerHTML = `${liquido} <small style="font-size: 16px; font-weight: 700; color: #64748b;">kg</small>`;
            }, 250);
          };
        }
      }
    });

  });
})();
