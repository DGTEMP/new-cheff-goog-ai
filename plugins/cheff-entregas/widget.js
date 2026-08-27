/**
 * 🛵 CHEFF ENTREGAS - WIDGET DE INTEGRAÇÃO NO CAIXA & PDV
 */

(function () {
  function injetarBotaoCheffEntregas() {
    // Procura a barra de ações do caixa ou menu superior
    const headerActions = document.querySelector('.header-actions') || document.querySelector('.top-navbar') || document.querySelector('.pos-quick-actions');
    
    if (headerActions && !document.getElementById('btn-abrir-cheff-entregas')) {
      const btn = document.createElement('button');
      btn.id = 'btn-abrir-cheff-entregas';
      btn.className = 'btn-header-action';
      btn.style.cssText = 'background: #fff7ed; color: #ea580c; border: 1.5px solid #fed7aa; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 6px;';
      btn.innerHTML = '<i class="ph-bold ph-moped" style="font-size: 16px;"></i> <span>CheffEntregas</span>';
      btn.onclick = () => window.open('/painel-entregas.html', '_blank');

      headerActions.prepend(btn);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(injetarBotaoCheffEntregas, 1500);
  });
})();
