/**
 * caixa-v11-modals.js — Sistema Profissional de Modais e Menus de Contexto
 * 100% Customizado (Zero prompt/confirm nativo do navegador)
 */
(function() {
  'use strict';

  // ── PREVENIR 100% O CONTEXT MENU NATIVO DO NAVEGADOR NO CAIXA V1.1 ──
  document.addEventListener('contextmenu', function(e) {
    if (document.body.classList.contains('v11-editando')) return;
    e.preventDefault();
    e.stopPropagation();

    // Identificar elemento alvo
    const mesaEl = e.target.closest('.v11-mesa, [data-mesa]');
    const widgetEl = e.target.closest('.v11-widget');
    const atalhoEl = e.target.closest('.v11-atalho-btn, a[href]');

    if (mesaEl) {
      const nomeMesa = mesaEl.getAttribute('data-mesa') || mesaEl.innerText.trim();
      abrirMenuContextoMesa(nomeMesa, e.clientX, e.clientY);
    } else if (widgetEl) {
      const widgetId = widgetEl.getAttribute('data-w') || 'geral';
      abrirMenuContextoWidget(widgetId, e.clientX, e.clientY);
    } else {
      abrirMenuContextoGeral(e.clientX, e.clientY);
    }
  }, true);

  // ── SUPORTE A TOQUE LONGO (LONG-PRESS) NO MOBILE / TABLET ──
  let touchTimer = null;
  document.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1 || document.body.classList.contains('v11-editando')) return;
    const target = e.target;
    touchTimer = setTimeout(function() {
      if (navigator.vibrate) navigator.vibrate(40);
      const t = e.touches[0];
      const mesaEl = target.closest('.v11-mesa, [data-mesa]');
      const widgetEl = target.closest('.v11-widget');
      if (mesaEl) {
        const nomeMesa = mesaEl.getAttribute('data-mesa') || mesaEl.innerText.trim();
        abrirMenuContextoMesa(nomeMesa, t.clientX, t.clientY);
      } else if (widgetEl) {
        const widgetId = widgetEl.getAttribute('data-w') || 'geral';
        abrirMenuContextoWidget(widgetId, t.clientX, t.clientY);
      }
    }, 500);
  }, { passive: true });

  document.addEventListener('touchend', function() { clearTimeout(touchTimer); });
  document.addEventListener('touchmove', function() { clearTimeout(touchTimer); });
  document.addEventListener('touchcancel', function() { clearTimeout(touchTimer); });

  // ── ESTILOS DOS MENUS E MODAIS CUSTOMIZADOS ──
  const style = document.createElement('style');
  style.textContent = `
    .v11-custom-modal-backdrop {
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; animation: v11Fade 0.2s ease;
    }
    @keyframes v11Fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes v11Pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .v11-custom-modal-card {
      background: #ffffff; border-radius: 20px; width: 100%; max-width: 460px;
      max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 25px 60px rgba(0,0,0,0.35); animation: v11Pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      color: #0f172a; font-family: 'Outfit', sans-serif;
    }
    .v11-custom-modal-header {
      padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
      display: flex; align-items: center; justify-content: space-between;
    }
    .v11-custom-modal-header h3 { margin: 0; font-size: 16.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .v11-custom-modal-close {
      background: #e2e8f0; border: none; width: 30px; height: 30px; border-radius: 50%;
      color: #64748b; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .v11-custom-modal-body { padding: 18px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }
    .v11-custom-modal-footer {
      padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: flex-end; gap: 8px;
    }

    .v11-form-group { display: flex; flex-direction: column; gap: 6px; }
    .v11-form-group label { font-size: 12.5px; font-weight: 700; color: #475569; }
    .v11-form-input {
      padding: 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 12px;
      font-size: 14px; font-weight: 600; color: #0f172a; background: #f8fafc; outline: none;
    }
    .v11-form-input:focus { border-color: #fc4b15; background: #fff; box-shadow: 0 0 0 3px rgba(252,75,21,0.12); }

    .v11-btn-primary {
      padding: 10px 18px; border-radius: 10px; background: #fc4b15; color: white;
      border: none; font-weight: 800; font-size: 13.5px; cursor: pointer; transition: all 0.15s;
    }
    .v11-btn-primary:hover { background: #e03a0b; }
    .v11-btn-secondary {
      padding: 10px 18px; border-radius: 10px; background: #e2e8f0; color: #475569;
      border: none; font-weight: 700; font-size: 13px; cursor: pointer;
    }

    /* POPUP DE CONTEXTO */
    .v11-floating-context {
      position: fixed; z-index: 1000000; background: #ffffff;
      border-radius: 16px; border: 1px solid #e2e8f0;
      box-shadow: 0 16px 40px rgba(0,0,0,0.25);
      padding: 6px; min-width: 220px; display: flex; flex-direction: column; gap: 2px;
      animation: v11Fade 0.15s ease;
    }
    .v11-floating-context-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border: none; background: transparent; border-radius: 10px;
      font-size: 13px; font-weight: 700; color: #0f172a; cursor: pointer; text-align: left;
      transition: background 0.12s;
    }
    .v11-floating-context-item:hover { background: #f1f5f9; color: #fc4b15; }
    .v11-floating-context-item i { font-size: 18px; }
  `;
  document.head.appendChild(style);

  function fecharContextos() {
    const c = document.getElementById('v11-active-context-popup');
    if (c) c.remove();
  }
  document.addEventListener('click', fecharContextos);

  function criarModalCustomizado(titulo, iconClass, iconColor, conteudoHtml, botoesFooterHtml) {
    fecharContextos();
    const modal = document.createElement('div');
    modal.id = 'v11-active-custom-modal';
    modal.className = 'v11-custom-modal-backdrop';
    modal.innerHTML = `
      <div class="v11-custom-modal-card">
        <div class="v11-custom-modal-header">
          <h3><i class="${iconClass}" style="color:${iconColor};"></i> ${titulo}</h3>
          <button class="v11-custom-modal-close" onclick="document.getElementById('v11-active-custom-modal').remove()">&times;</button>
        </div>
        <div class="v11-custom-modal-body">${conteudoHtml}</div>
        <div class="v11-custom-modal-footer">${botoesFooterHtml || '<button type="button" class="v11-btn-secondary" onclick="document.getElementById(\'v11-active-custom-modal\').remove()">Fechar</button>'}</div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  // ── 1. MODAL SUPRIMENTO (100% CUSTOMIZADO) ──
  window.abrirModalSuprimentoCustom = function() {
    fecharContextos();
    const html = `
      <div class="v11-form-group">
        <label>Valor do Suprimento / Entrada de Troco (R$):</label>
        <input type="text" id="v11-input-suprimento-valor" class="v11-form-input" placeholder="50,00" value="50,00" autofocus>
      </div>
      <div class="v11-form-group">
        <label>Motivo / Observação:</label>
        <input type="text" id="v11-input-suprimento-motivo" class="v11-form-input" placeholder="Aporte de troco inicial" value="Entrada de Troco">
      </div>
    `;
    const footer = `
      <button type="button" class="v11-btn-secondary" onclick="document.getElementById('v11-active-custom-modal').remove()">Cancelar</button>
      <button type="button" class="v11-btn-primary" onclick="window.confirmarSuprimentoCustom()">Confirmar Suprimento</button>
    `;
    criarModalCustomizado('Entrada de Suprimento (Troco)', 'ph-bold ph-hand-coins', '#10b981', html, footer);
  };

  window.confirmarSuprimentoCustom = function() {
    const valInput = document.getElementById('v11-input-suprimento-valor');
    const motInput = document.getElementById('v11-input-suprimento-motivo');
    const valor = parseFloat((valInput ? valInput.value : '0').replace(',', '.')) || 0;
    const motivo = (motInput ? motInput.value : '').trim() || 'Suprimento de Caixa';

    if (valor <= 0) return alert('Insira um valor válido para o suprimento.');

    if (window.socket) {
      window.socket.emit('movimentacao_caixa', {
        tipo: 'Suprimento',
        valor: valor,
        motivo: motivo,
        operador: localStorage.getItem('chef_operador') || 'Caixa'
      });
    }
    document.getElementById('v11-active-custom-modal').remove();
  };

  // ── 2. MODAL SANGRIA (100% CUSTOMIZADO) ──
  window.abrirModalSangriaCustom = function() {
    fecharContextos();
    const html = `
      <div class="v11-form-group">
        <label>Valor da Sangria / Retirada (R$):</label>
        <input type="text" id="v11-input-sangria-valor" class="v11-form-input" placeholder="100,00" value="100,00" autofocus>
      </div>
      <div class="v11-form-group">
        <label>Motivo da Retirada:</label>
        <input type="text" id="v11-input-sangria-motivo" class="v11-form-input" placeholder="Pagamento de fornecedor, depósito..." value="Retirada para Cofre">
      </div>
    `;
    const footer = `
      <button type="button" class="v11-btn-secondary" onclick="document.getElementById('v11-active-custom-modal').remove()">Cancelar</button>
      <button type="button" class="v11-btn-primary" style="background:#ef4444;" onclick="window.confirmarSangriaCustom()">Confirmar Sangria</button>
    `;
    criarModalCustomizado('Sangria de Caixa (Retirada)', 'ph-bold ph-money', '#ef4444', html, footer);
  };

  window.confirmarSangriaCustom = function() {
    const valInput = document.getElementById('v11-input-sangria-valor');
    const motInput = document.getElementById('v11-input-sangria-motivo');
    const valor = parseFloat((valInput ? valInput.value : '0').replace(',', '.')) || 0;
    const motivo = (motInput ? motInput.value : '').trim() || 'Sangria de Caixa';

    if (valor <= 0) return alert('Insira um valor válido para a sangria.');

    if (window.socket) {
      window.socket.emit('movimentacao_caixa', {
        tipo: 'Sangria',
        valor: valor,
        motivo: motivo,
        operador: localStorage.getItem('chef_operador') || 'Caixa'
      });
    }
    document.getElementById('v11-active-custom-modal').remove();
  };

  // ── 3. MENUS DE CONTEXTO ESPECÍFICOS POR MÓDULO ──
  function abrirMenuContextoMesa(nomeMesa, x, y) {
    fecharContextos();
    const menu = document.createElement('div');
    menu.id = 'v11-active-context-popup';
    menu.className = 'v11-floating-context';
    menu.innerHTML = `
      <div style="padding:6px 12px; font-size:11.5px; font-weight:800; color:#fc4b15; border-bottom:1px solid #f1f5f9; margin-bottom:2px;">${nomeMesa}</div>
      <button class="v11-floating-context-item" onclick="window.location.href='/index.html'"><i class="ph-bold ph-plus-circle" style="color:#fc4b15;"></i> Lançar Itens</button>
      <button class="v11-floating-context-item" onclick="window.location.href='/index.html'"><i class="ph-bold ph-check-circle" style="color:#10b981;"></i> Fechar Conta</button>
      <button class="v11-floating-context-item" onclick="window.abrirModalTransferirMesa && window.abrirModalTransferirMesa('${nomeMesa}')"><i class="ph-bold ph-arrows-out-cardinal" style="color:#3b82f6;"></i> Mover / Transferir</button>
      <button class="v11-floating-context-item" onclick="window.mostrarQrCodeMesa && window.mostrarQrCodeMesa('${nomeMesa}')"><i class="ph-bold ph-qr-code" style="color:#a855f7;"></i> QR Code da Mesa</button>
    `;
    posicionarMenu(menu, x, y);
  }

  function abrirMenuContextoWidget(widgetId, x, y) {
    fecharContextos();
    const menu = document.createElement('div');
    menu.id = 'v11-active-context-popup';
    menu.className = 'v11-floating-context';

    if (widgetId === 'resumo') {
      menu.innerHTML = `
        <div style="padding:6px 12px; font-size:11.5px; font-weight:800; color:#10b981; border-bottom:1px solid #f1f5f9;">Resumo do Caixa</div>
        <button class="v11-floating-context-item" onclick="window.abrirModalSuprimentoCustom()"><i class="ph-bold ph-hand-coins" style="color:#10b981;"></i> Suprimento (Troco)</button>
        <button class="v11-floating-context-item" onclick="window.abrirModalSangriaCustom()"><i class="ph-bold ph-money" style="color:#ef4444;"></i> Sangria (Retirada)</button>
        <button class="v11-floating-context-item" onclick="window.location.href='/financeiro.html'"><i class="ph-bold ph-receipt" style="color:#3b82f6;"></i> Relatório do Turno</button>
      `;
    } else if (widgetId === 'entregas') {
      menu.innerHTML = `
        <div style="padding:6px 12px; font-size:11.5px; font-weight:800; color:#f59e0b; border-bottom:1px solid #f1f5f9;">Delivery & Entregas</div>
        <button class="v11-floating-context-item" onclick="window.location.href='/hub-delivery.html'"><i class="ph-bold ph-truck" style="color:#f59e0b;"></i> Abrir Hub Delivery</button>
        <button class="v11-floating-context-item" onclick="window.location.href='/painel-entregas.html'"><i class="ph-bold ph-moped" style="color:#3b82f6;"></i> Painel de Motoboys</button>
      `;
    } else if (widgetId === 'tarefas') {
      menu.innerHTML = `
        <div style="padding:6px 12px; font-size:11.5px; font-weight:800; color:#3b82f6; border-bottom:1px solid #f1f5f9;">Tarefas & Checklist</div>
        <button class="v11-floating-context-item" onclick="window.abrirModalNovaTarefaCustom()"><i class="ph-bold ph-plus-circle" style="color:#3b82f6;"></i> Nova Tarefa do Turno</button>
        <button class="v11-floating-context-item" onclick="window.location.href='/configuracoes.html'"><i class="ph-bold ph-gear" style="color:#64748b;"></i> Gerenciar Checklist</button>
      `;
    } else if (widgetId === 'balanca') {
      menu.innerHTML = `
        <div style="padding:6px 12px; font-size:11.5px; font-weight:800; color:#ec4899; border-bottom:1px solid #f1f5f9;">Balança & Buffet</div>
        <button class="v11-floating-context-item" onclick="window.abrirModalTaraCustom()"><i class="ph-bold ph-scales" style="color:#ec4899;"></i> Ajustar Tara do Prato</button>
        <button class="v11-floating-context-item" onclick="window.location.href='/configuracoes.html'"><i class="ph-bold ph-gear" style="color:#64748b;"></i> Calibrar Balança</button>
      `;
    } else if (widgetId === 'fidelidade') {
      menu.innerHTML = `
        <div style="padding:6px 12px; font-size:11.5px; font-weight:800; color:#8b5cf6; border-bottom:1px solid #f1f5f9;">Fidelidade & Cashback</div>
        <button class="v11-floating-context-item" onclick="window.abrirModalConsultarCpfCustom()"><i class="ph-bold ph-user-focus" style="color:#8b5cf6;"></i> Consultar Saldo por CPF</button>
      `;
    } else {
      menu.innerHTML = `
        <button class="v11-floating-context-item" onclick="window.location.href='/configuracoes.html'"><i class="ph-bold ph-gear" style="color:#fc4b15;"></i> Configurações do Módulo</button>
      `;
    }
    posicionarMenu(menu, x, y);
  }

  function abrirMenuContextoGeral(x, y) {
    fecharContextos();
    const menu = document.createElement('div');
    menu.id = 'v11-active-context-popup';
    menu.className = 'v11-floating-context';
    menu.innerHTML = `
      <button class="v11-floating-context-item" onclick="document.getElementById('v11-btn-editar').click()"><i class="ph-bold ph-cursor-click" style="color:#fc4b15;"></i> Reorganizar Blocos</button>
      <button class="v11-floating-context-item" onclick="window.location.href='/index.html'"><i class="ph-bold ph-arrow-u-up-left" style="color:#3b82f6;"></i> Ir para Caixa Clássico</button>
      <button class="v11-floating-context-item" onclick="window.location.href='/configuracoes.html'"><i class="ph-bold ph-gear" style="color:#64748b;"></i> Configurações</button>
    `;
    posicionarMenu(menu, x, y);
  }

  function posicionarMenu(menu, x, y) {
    menu.style.left = Math.min(x || 100, window.innerWidth - 240) + 'px';
    menu.style.top = Math.min(y || 100, window.innerHeight - 240) + 'px';
    document.body.appendChild(menu);
  }
})();
