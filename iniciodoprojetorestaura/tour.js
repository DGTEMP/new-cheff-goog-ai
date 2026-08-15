(function() {
  if (localStorage.getItem('tour_concluido')) return;

  const style = document.createElement('style');
  style.innerHTML = `
    .tour-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 1000000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
    .tour-modal { background: #fff; border-radius: 16px; width: 90%; max-width: 450px; padding: 30px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
    .tour-modal h2 { margin-top: 0; color: #1e293b; font-size: 24px; }
    .tour-modal p { color: #64748b; font-size: 15px; margin: 15px 0 25px; line-height: 1.5; }
    .tour-btn-container { display: flex; gap: 15px; justify-content: center; }
    .tour-btn { padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer; transition: 0.2s; }
    .tour-btn-no { background: #f1f5f9; color: #64748b; }
    .tour-btn-no:hover { background: #e2e8f0; }
    .tour-btn-yes { background: #fc4b15; color: #fff; }
    .tour-btn-yes:hover { background: #e03a0b; }
    
    .tour-tooltip { position: absolute; background: #fc4b15; color: white; padding: 15px; border-radius: 12px; z-index: 1000001; max-width: 300px; box-shadow: 0 10px 25px rgba(252,75,21,0.4); font-size: 14px; line-height: 1.4; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
    .tour-tooltip::after { content: ''; position: absolute; border: 8px solid transparent; }
    .tour-tooltip.bottom::after { top: -16px; left: 50%; transform: translateX(-50%); border-bottom-color: #fc4b15; }
    .tour-tooltip.top::after { bottom: -16px; left: 50%; transform: translateX(-50%); border-top-color: #fc4b15; }
    .tour-tooltip.right::after { left: -16px; top: 50%; transform: translateY(-50%); border-right-color: #fc4b15; }
    .tour-tooltip.left::after { right: -16px; top: 50%; transform: translateY(-50%); border-left-color: #fc4b15; }
    .tour-highlight { position: relative; z-index: 1000001 !important; outline: 4px solid #fc4b15; outline-offset: 4px; border-radius: 4px; background: white; }
    .tour-actions { margin-top: 15px; display: flex; justify-content: space-between; align-items: center; pointer-events: auto; }
    .tour-actions button { background: white; color: #fc4b15; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; }
    .tour-actions button.skip { background: transparent; color: rgba(255,255,255,0.8); }
    .tour-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000000; }
  `;
  document.head.appendChild(style);

  const steps = [
    { selector: '#toolbar-balcao', text: 'Aqui você cria pedidos rápidos para o balcão.', pos: 'bottom' },
    { selector: '#mesas-section-container', text: 'Esta é a visão geral do seu salão. Clique em uma mesa livre para abrir a conta, ou em uma ocupada para adicionar itens.', pos: 'top' },
    { selector: '.top-toolbar [title="Fila de Preparo"]', text: 'Aqui fica a fila de pedidos em tempo real. Acompanhe o que está sendo preparado pela cozinha.', pos: 'left' },
    { selector: '#status-user-box', text: 'Aqui você pode trocar de usuário ou acessar opções de perfil.', pos: 'bottom' },
    { selector: '[data-dropdown="drop-arquivo"]', text: 'No menu Arquivo, você pode abrir e fechar o seu caixa do dia.', pos: 'bottom' }
  ];
  
  let currentStep = 0;
  let activeElement = null;
  
  function initTour() {
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.innerHTML = `
      <div class="tour-modal">
        <h2>Bem-vindo ao Chef Cozinha! 👨‍🍳</h2>
        <p>Notamos que esta é a sua primeira vez aqui. Gostaria de fazer um rápido tour guiado para conhecer as principais funcionalidades e aprender a usar o sistema?</p>
        <div class="tour-btn-container">
          <button class="tour-btn tour-btn-no" id="tour-btn-no">Não, obrigado</button>
          <button class="tour-btn tour-btn-yes" id="tour-btn-yes">Sim, vamos lá!</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('tour-btn-no').onclick = () => {
      localStorage.setItem('tour_concluido', 'true');
      overlay.remove();
    };

    document.getElementById('tour-btn-yes').onclick = () => {
      overlay.remove();
      startTourSteps();
    };
  }

  function startTourSteps() {
    const backdrop = document.createElement('div');
    backdrop.className = 'tour-backdrop';
    backdrop.id = 'tour-backdrop';
    document.body.appendChild(backdrop);
    showStep(0);
  }
  
  function endTour() {
    localStorage.setItem('tour_concluido', 'true');
    const backdrop = document.getElementById('tour-backdrop');
    if (backdrop) backdrop.remove();
    if (activeElement) activeElement.classList.remove('tour-highlight');
    const existing = document.querySelector('.tour-tooltip');
    if (existing) existing.remove();
  }

  function showStep(index) {
    if (index >= steps.length) {
      endTour();
      return;
    }
    
    if (activeElement) activeElement.classList.remove('tour-highlight');
    const existing = document.querySelector('.tour-tooltip');
    if (existing) existing.remove();

    const step = steps[index];
    const el = document.querySelector(step.selector);
    
    if (!el) {
      showStep(index + 1); // skip if not found
      return;
    }
    
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
      el.classList.add('tour-highlight');
      activeElement = el;
      
      const rect = el.getBoundingClientRect();
      const tooltip = document.createElement('div');
      tooltip.className = 'tour-tooltip ' + step.pos;
      
      let html = `<div>${step.text}</div>
        <div class="tour-actions">
          <button class="skip" onclick="window.tourEnd()">Pular tour</button>
          <button onclick="window.tourNext(${index + 1})">${index === steps.length - 1 ? 'Concluir' : 'Próximo'}</button>
        </div>`;
      tooltip.innerHTML = html;
      document.body.appendChild(tooltip);
      
      // Calculate position
      let top, left;
      if (step.pos === 'bottom') {
        top = (rect.bottom + 15);
        left = (rect.left + (rect.width/2) - (tooltip.offsetWidth/2));
      } else if (step.pos === 'top') {
        top = (rect.top - tooltip.offsetHeight - 15);
        left = (rect.left + (rect.width/2) - (tooltip.offsetWidth/2));
      } else if (step.pos === 'left') {
        top = (rect.top + (rect.height/2) - (tooltip.offsetHeight/2));
        left = (rect.left - tooltip.offsetWidth - 15);
      } else if (step.pos === 'right') {
        top = (rect.top + (rect.height/2) - (tooltip.offsetHeight/2));
        left = (rect.right + 15);
      }

      // Keep tooltip within screen boundaries
      if (left < 10) left = 10;
      if (left + tooltip.offsetWidth > window.innerWidth - 10) {
         left = window.innerWidth - tooltip.offsetWidth - 10;
      }
      if (top < 10) top = 10;
      if (top + tooltip.offsetHeight > window.innerHeight - 10) {
         top = window.innerHeight - tooltip.offsetHeight - 10;
      }

      tooltip.style.top = top + 'px';
      tooltip.style.left = left + 'px';
      
      tooltip.style.opacity = '1';
    }, 500);
  }

  window.tourNext = showStep;
  window.tourEnd = endTour;

  // Wait a bit before showing the modal
  setTimeout(() => {
    // Only run tour if on the main Caixa screen
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
      initTour();
    }
  }, 1000);
})();
