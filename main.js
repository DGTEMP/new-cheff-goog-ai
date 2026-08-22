
function escHtml(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escJs(t){try{return JSON.stringify(String(t==null?'':t)).replace(/</g,'\\x3C').replace(/>/g,'\\x3E').replace(/"/g,'&quot;').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}catch(e){return '""';}}

// --- DETECÇÃO DETALHADA E ÚNICA DE DISPOSITIVOS ---
function authHeaders() {
  const t = localStorage.getItem('chef_token');
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}
window.obterInfoDetalhadaDispositivo = function () {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const screenW = window.screen.width;
  const screenH = window.screen.height;
  const touchPoints = navigator.maxTouchPoints || 0;

  let os = 'Windows';
  let model = 'Computador PC';
  let icon = 'ph-desktop';

  if (/android/i.test(ua)) {
    os = 'Android';
    if (touchPoints > 0 && Math.min(screenW, screenH) >= 600) {
      model = 'Tablet Android';
      icon = 'ph-device-tablet';
    } else {
      model = 'Smartphone Android';
      icon = 'ph-device-mobile';
    }
    if (/samsung/i.test(ua)) model = 'Samsung Galaxy';
    else if (/xiaomi|redmi|mi /i.test(ua)) model = 'Xiaomi Redmi';
    else if (/motorola|moto/i.test(ua)) model = 'Motorola Moto';
  } else if (/iphone/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1)) {
    os = 'iOS';
    model = (touchPoints > 1 && screenW >= 768) ? 'iPad (Apple Tablet)' : 'iPhone (Apple)';
    icon = (touchPoints > 1 && screenW >= 768) ? 'ph-device-tablet' : 'ph-device-mobile';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
    model = 'MacBook / Mac Apple';
    icon = 'ph-desktop';
  } else if (/windows/i.test(ua)) {
    os = 'Windows';
    model = (touchPoints > 0 && Math.max(screenW, screenH) <= 1366) ? 'Notebook Touch' : 'Computador PC / Terminal';
    icon = 'ph-desktop';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
    model = 'Terminal Linux';
    icon = 'ph-desktop';
  }

  let browser = 'Chrome';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';

  const apelidoCustom = localStorage.getItem('apelido_dispositivo') || '';
  if (apelidoCustom) {
    model = `${apelidoCustom} (${model})`;
  }

  return { os, browser, model, icon, resolution: `${screenW}x${screenH}`, userAgent: ua };
};

window.enviarRegistroSessaoDetalhado = function () {
  if (typeof socket !== 'undefined' && socket.emit) {
    const dev = window.obterInfoDetalhadaDispositivo();
    const userLogado = localStorage.getItem('logged_user') || localStorage.getItem('usuarioLogado') || (document.getElementById('status-user-name') ? document.getElementById('status-user-name').innerText.trim() : 'Operador');
    const cargoLogado = localStorage.getItem('cargoLogado') || 'Caixa / PDV';

    socket.emit('registrar_sessao_detalhada', {
      nome: userLogado,
      cargo: cargoLogado,
      model: dev.model,
      os: dev.os,
      browser: dev.browser,
      icon: dev.icon,
      resolution: dev.resolution,
      userAgent: dev.userAgent
    });
  }
};

// Rastreamento global de cliques em botões e navegação
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button, a, input[type="button"], input[type="submit"], .btn, .btn-action, [onclick]');
  if (!btn) return;
  const label = (btn.innerText || btn.title || btn.ariaLabel || btn.value || btn.id || btn.className || 'Botao').trim().replace(/\s+/g, ' ').substring(0, 50);
  const pagina = window.location.pathname.split('/').pop() || 'index.html';
  if (typeof socket !== 'undefined' && socket.emit) {
    socket.emit('registrar_clique_botao', { botao: label, pagina });
  }
}, true);

window.apelidarDispositivo = function () {
  const atual = localStorage.getItem('apelido_dispositivo') || '';
  const novoApelido = prompt('Digite um nome/identificador fácil para este aparelho (ex: Comanda Garçom 01, Tablet Cozinha, Notebook Caixa):', atual);
  if (novoApelido !== null) {
    const limpo = novoApelido.trim();
    if (limpo) {
      localStorage.setItem('apelido_dispositivo', limpo);
      alert(`✅ Este aparelho agora se chama "${limpo}"!`);
    } else {
      localStorage.removeItem('apelido_dispositivo');
      alert('Apelido removido. Usando identificação automática.');
    }
    window.enviarRegistroSessaoDetalhado();
  }
};

window.onDragStartTable = (e, mesa) => {
  e.dataTransfer.setData('type', 'table');
  e.dataTransfer.setData('mesa', mesa);
  e.dataTransfer.effectAllowed = 'move';
};

window.onDragStartItem = (e, itemId, comandaName = '') => {
  e.dataTransfer.setData('type', 'item');
  e.dataTransfer.setData('itemId', String(itemId));
  e.dataTransfer.setData('comanda', String(comandaName || ''));
  e.dataTransfer.effectAllowed = 'move';
  if (e.target && e.target.classList) {
    e.target.classList.add('dragging-item-row');
  }
};

window.onDragOverComandaRow = (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  if (target && !target.classList.contains('drag-over-comanda')) {
    target.classList.add('drag-over-comanda');
  }
};

window.onDragLeaveComandaRow = (e) => {
  const target = e.currentTarget;
  if (target) {
    target.classList.remove('drag-over-comanda');
  }
};

window.onDropItemOnComanda = (e, comandaName) => {
  e.preventDefault();
  e.stopPropagation();
  const target = e.currentTarget;
  if (target) target.classList.remove('drag-over-comanda');

  const type = e.dataTransfer.getData('type');
  if (type === 'item') {
    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId) return;
    socket.emit('atribuir_comanda_item', { itemId: itemId, comandaName: comandaName || null, operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido' });
  }
};

window.onDropItemOnNovaComanda = (e) => {
  e.preventDefault();
  if (e.type === 'drop') {
    e.stopPropagation();
  }
  const target = e.currentTarget;
  if (target) target.classList.remove('drag-over-comanda');

  let itemId = null;
  if (e.dataTransfer) {
    const type = e.dataTransfer.getData('type');
    if (type === 'item') {
      itemId = e.dataTransfer.getData('itemId');
    }
  }

  const promptMsg = itemId
    ? 'Digite o nome do cliente / comanda para mover este produto (ex: Yo, Pedro, Maria):'
    : 'Digite o nome da nova comanda para esta mesa:';

  const nome = prompt(promptMsg);
  if (nome && nome.trim()) {
    if (itemId) {
      socket.emit('atribuir_comanda_item', { itemId: itemId, comandaName: nome.trim(), operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido' });
    } else {
      socket.emit('nova_comanda_crm', { nome: nome.trim(), telefone: '' });
    }
  }
};

window.alterarComandaItemDirect = (itemId, currentComanda) => {
  const msg = currentComanda
    ? `Este item está na comanda "${currentComanda}".\n\nDigite o nome de outra comanda para mover este produto, ou deixe EM BRANCO para remover da comanda e colocar nos Itens Compartilhados da Mesa:`
    : `Este item está nos Itens Compartilhados da Mesa.\n\nDigite o nome da comanda para a qual deseja mover este produto (ex: Yo, Pedro, Maria):`;
  const res = prompt(msg, currentComanda || '');
  if (res !== null) {
    socket.emit('atribuir_comanda_item', { itemId: itemId, comandaName: res.trim() || null, operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido' });
  }
};

// ═════════════════════════════════════════════════════════════════════
// ➗ DIVISÃO DE ITENS COMPARTILHADOS EM FRAÇÕES E ATRIBUIÇÃO A COMANDAS
// ═════════════════════════════════════════════════════════════════════
let currentItemFracao = null;
let currentPresetFracoes = 2;

window.abrirModalDividirItemFracao = (itemId, productName, productEmoji, totalVal, qty) => {
  const modal = document.getElementById('modal-dividir-item-fracao');
  if (!modal) return;

  currentItemFracao = {
    id: itemId,
    nome: productName,
    emoji: productEmoji || '🍽️',
    total: parseFloat(totalVal || 0),
    qty: parseFloat(qty || 1)
  };

  const emojiEl = document.getElementById('modal-fracao-emoji');
  if (emojiEl) emojiEl.innerText = currentItemFracao.emoji;
  const nomeEl = document.getElementById('modal-fracao-item-nome');
  if (nomeEl) nomeEl.innerText = currentItemFracao.nome;
  const qtdEl = document.getElementById('modal-fracao-qtd-original');
  if (qtdEl) qtdEl.innerText = `Qtd: ${currentItemFracao.qty} un`;
  const totalEl = document.getElementById('modal-fracao-item-total');
  if (totalEl) totalEl.innerText = `R$ ${currentItemFracao.total.toFixed(2).replace('.', ',')}`;

  window.selecionarPresetFracoes(2);
  modal.style.display = 'flex';
};

window.fecharModalDividirItemFracao = () => {
  const modal = document.getElementById('modal-dividir-item-fracao');
  if (modal) modal.style.display = 'none';
  currentItemFracao = null;
};

window.selecionarPresetFracoes = (qtd) => {
  const isCustom = qtd === 'custom';
  currentPresetFracoes = isCustom ? parseInt(document.getElementById('input-custom-num-fracoes').value || 5, 10) : qtd;

  document.querySelectorAll('#grid-preset-fracoes .btn-preset-fracao').forEach(btn => {
    btn.style.borderColor = 'var(--border-color, #cbd5e1)';
    btn.style.background = 'var(--bg-card, #ffffff)';
    btn.style.color = 'var(--text-primary, #0f172a)';
    btn.classList.remove('active');
  });

  const activeBtnId = isCustom ? 'btn-fracao-preset-custom' : `btn-fracao-preset-${qtd}`;
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) {
    activeBtn.style.borderColor = '#fc4b15';
    activeBtn.style.background = 'rgba(252,75,21,0.1)';
    activeBtn.style.color = '#fc4b15';
    activeBtn.classList.add('active');
  }

  const customBox = document.getElementById('container-custom-fracoes-qtd');
  if (customBox) customBox.style.display = isCustom ? 'block' : 'none';

  window.gerarCamposFracoes(currentPresetFracoes);
};

window.gerarCamposFracoes = (numPartes) => {
  const container = document.getElementById('container-lista-fracoes-items');
  if (!container || !currentItemFracao) return;

  const n = Math.max(2, Math.min(20, numPartes || 2));
  currentPresetFracoes = n;

  const valorPorParte = currentItemFracao.total / n;
  const qtdPorParte = currentItemFracao.qty / n;

  // Extrair comandas ativas na mesa atual
  const comandasAtivas = [];
  if (window.mesaAtual && Array.isArray(window.mesaAtual.items)) {
    window.mesaAtual.items.forEach(o => {
      const c = (o.mesa_comanda || '').trim();
      if (c && !comandasAtivas.includes(c)) comandasAtivas.push(c);
    });
  }

  let html = '';
  for (let i = 0; i < n; i++) {
    const fracaoStr = n === 2 ? '½' : (n === 3 ? '⅓' : (n === 4 ? '¼' : `${i + 1}/${n}`));
    const percent = ((1 / n) * 100).toFixed(0);

    const suggestedComanda = comandasAtivas[i] || '';

    html += `
      <div class="fracao-item-row" style="background: var(--bg-card, #ffffff); border: 1.5px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 13.5px; color: var(--text-primary, #0f172a); display: flex; align-items: center; gap: 6px;">
            <span style="background: #2563eb; color: white; border-radius: 6px; padding: 2px 7px; font-size: 12px; font-weight: 800;">${fracaoStr}</span>
            Fração ${i + 1} (${percent}%)
          </span>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 12px; color: var(--text-secondary, #64748b);">Valor:</span>
            <strong style="color: #3ab55b; font-size: 14px;">R$ ${valorPorParte.toFixed(2).replace('.', ',')}</strong>
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="flex: 1;">
            <select class="select-fracao-comanda" data-index="${i}" data-fracao="${fracaoStr}" data-valor="${valorPorParte}" data-qtd="${qtdPorParte}" onchange="window.onFracaoComandaChange(this, ${i})" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color, #cbd5e1); font-size: 13px; font-weight: 600; background: var(--bg-secondary, #f8fafc); color: var(--text-primary, #0f172a);">
              <option value="" ${!suggestedComanda ? 'selected' : ''}>🪑 Manter Compartilhado na Mesa</option>
              ${comandasAtivas.map(c => `<option value="${c}" ${c === suggestedComanda ? 'selected' : ''}>👤 Comanda: ${c}</option>`).join('')}
              <option value="__NOVA__">➕ Criar Nova Comanda...</option>
            </select>
          </div>
          <input type="text" class="input-nova-comanda-fracao" id="input-nova-comanda-fracao-${i}" placeholder="Nome do cliente/comanda" style="display: none; flex: 1; padding: 8px 10px; border-radius: 8px; border: 1.5px solid #fc4b15; font-size: 13px; font-weight: 600; color: #fc4b15; background: #fff7ed;">
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
};

window.onFracaoComandaChange = (sel, idx) => {
  const inputNova = document.getElementById(`input-nova-comanda-fracao-${idx}`);
  if (!inputNova) return;
  if (sel.value === '__NOVA__') {
    inputNova.style.display = 'block';
    setTimeout(() => inputNova.focus(), 50);
  } else {
    inputNova.style.display = 'none';
  }
};

window.confirmarDivisaoItemFracao = () => {
  if (!currentItemFracao) return;

  const rows = document.querySelectorAll('#container-lista-fracoes-items .select-fracao-comanda');
  if (rows.length < 2) {
    alert('É necessário dividir em pelo menos 2 frações.');
    return;
  }

  const fracoes = [];
  for (let i = 0; i < rows.length; i++) {
    const sel = rows[i];
    const fracaoStr = sel.getAttribute('data-fracao') || `${i + 1}/${rows.length}`;
    const valor = parseFloat(sel.getAttribute('data-valor') || 0);
    const qtd = parseFloat(sel.getAttribute('data-qtd') || 1);

    let comanda = sel.value;
    if (comanda === '__NOVA__') {
      const inp = document.getElementById(`input-nova-comanda-fracao-${i}`);
      comanda = (inp && inp.value) ? inp.value.trim() : `Comanda ${i + 1}`;
    }

    fracoes.push({
      fracaoStr,
      valor,
      qtd,
      comandaName: comanda || null
    });
  }

  socket.emit('dividir_item_fracoes', {
    itemId: currentItemFracao.id,
    fracoes: fracoes,
    operador: window.crmPerfil ? window.crmPerfil.nome : 'Caixa'
  });

  window.fecharModalDividirItemFracao();
  if (typeof showToast === 'function') {
    showToast('✨ Item dividido em frações e atribuído com sucesso!', '#3ab55b');
  }
};

window.switchMobileTab = (tabId) => {
  const ws = document.querySelector('.workspace');
  if (!ws) return;

  const cleanTab = (tabId || 'mesas').replace('tab-', '');
  ws.classList.remove('active-tab-mesas', 'active-tab-pedido', 'active-tab-acoes', 'active-mesas', 'active-pedido', 'active-acoes');
  ws.classList.add(`active-tab-${cleanTab}`);

  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    const btnTab = (btn.getAttribute('data-tab') || '').replace('tab-', '');
    if (btnTab === cleanTab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
};

setTimeout(() => {
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.switchMobileTab(btn.getAttribute('data-tab'));
    });
  });

  const floatLancar = document.getElementById('float-btn-lancar');
  const floatParcial = document.getElementById('float-btn-parcial');
  const floatFechar = document.getElementById('float-btn-fechar');
  if (floatLancar) floatLancar.addEventListener('click', () => {
    const btn = document.getElementById('btn-adicionar-produtos');
    if (btn) btn.click();
  });
  if (floatParcial) floatParcial.addEventListener('click', () => {
    const btn = document.getElementById('btn-movimento-parcial');
    if (btn) btn.click();
  });
  if (floatFechar) floatFechar.addEventListener('click', () => {
    const btn = document.getElementById('btn-movimento-concluir');
    if (btn) btn.click();
  });

  window.switchMobileTab('mesas');
}, 100);

// --- MENU HAMBURGER MOBILE ---
window.closeMobileMenu = function () {
  const overlay = document.getElementById('mobile-menu-overlay');
  if (overlay) overlay.classList.remove('show');
};

function initMobileMenu() {
  const hamburger = document.getElementById('mobile-hamburger-btn');
  const overlay = document.getElementById('mobile-menu-overlay');
  const closeBtn = document.getElementById('mobile-menu-close');

  if (hamburger && !hamburger._inited) {
    hamburger._inited = true;
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (overlay) overlay.classList.add('show');
    });
  }

  if (closeBtn && !closeBtn._inited) {
    closeBtn._inited = true;
    closeBtn.addEventListener('click', window.closeMobileMenu);
  }

  if (overlay && !overlay._inited) {
    overlay._inited = true;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) window.closeMobileMenu();
    });
  }

  const mobFinanceiro = document.getElementById('menu-mob-financeiro');
  const mobConfig = document.getElementById('menu-mob-config');
  if (mobFinanceiro) mobFinanceiro.style.display = '';
  if (mobConfig) mobConfig.style.display = '';

  const menuUserName = document.getElementById('mobile-menu-user-name');
  const statusUserName = document.getElementById('status-user-name');
  if (menuUserName && statusUserName) {
    const obs = new MutationObserver(() => { 
      const txt = statusUserName.textContent.trim();
      menuUserName.textContent = (txt && txt !== '-' && txt !== 'Desconhecido') ? txt : 'Não logado'; 
    });
    obs.observe(statusUserName, { childList: true, characterData: true, subtree: true });
    const txt = statusUserName.textContent.trim();
    menuUserName.textContent = (txt && txt !== '-' && txt !== 'Desconhecido') ? txt : 'Não logado';
  }

  const menuAbrir = document.getElementById('menu-mob-abrir-caixa');
  const menuFechar = document.getElementById('menu-mob-fechar-caixa');
  if (menuAbrir && !menuAbrir._inited) {
    menuAbrir._inited = true;
    menuAbrir.addEventListener('click', () => {
      const original = document.getElementById('menu-abrir-caixa');
      if (original) original.click();
      window.closeMobileMenu();
    });
  }
  if (menuFechar && !menuFechar._inited) {
    menuFechar._inited = true;
    menuFechar.addEventListener('click', () => {
      const original = document.getElementById('menu-fechar-caixa');
      if (original) original.click();
      window.closeMobileMenu();
    });
  }
}

window.abrirModalLoginFuncionarioMobile = function() {
  const modal = document.getElementById('modal-login-funcionario-mobile');
  if (!modal) return;
  const statusUser = document.getElementById('status-user-name');
  const currentName = statusUser ? statusUser.textContent.trim() : '';
  
  if (currentName && currentName !== '-' && currentName !== 'Desconhecido' && currentName !== 'Não logado') {
    if (confirm(`Usuário atual: "${currentName}".\n\nDeseja encerrar sessão para entrar com outro colaborador?`)) {
      if (statusUser) statusUser.textContent = 'Não logado';
      const menuName = document.getElementById('mobile-menu-user-name');
      if (menuName) menuName.textContent = 'Não logado';
      localStorage.removeItem('logged_user');
      localStorage.removeItem('chef_session');
    } else {
      return;
    }
  }

  modal.style.display = 'flex';
  const fb = document.getElementById('mob-login-feedback');
  if (fb) fb.style.display = 'none';
  setTimeout(() => {
    const input = document.getElementById('input-mob-user');
    if (input) input.focus();
  }, 100);
};

window.fecharModalLoginFuncionarioMobile = function() {
  const modal = document.getElementById('modal-login-funcionario-mobile');
  if (modal) modal.style.display = 'none';
};

window.submeterLoginFuncionarioMobile = function() {
  const u = document.getElementById('input-mob-user') ? document.getElementById('input-mob-user').value.trim() : '';
  const s = document.getElementById('input-mob-pass') ? document.getElementById('input-mob-pass').value.trim() : '';
  const fb = document.getElementById('mob-login-feedback');
  const btn = document.getElementById('btn-mob-login-submit');

  if (!u || !s) {
    if (fb) {
      fb.style.display = 'block';
      fb.style.background = '#fef2f2';
      fb.style.color = '#dc2626';
      fb.innerHTML = 'Preencha o usuário e a senha.';
    }
    return;
  }

  if (fb) {
    fb.style.display = 'block';
    fb.style.background = '#eff6ff';
    fb.style.color = '#2563eb';
    fb.innerHTML = 'Autenticando...';
  }
  if (btn) btn.disabled = true;

  if (window.socket) {
    let mobTimeout = setTimeout(() => {
      if (window.socket) {
        window.socket.off('login_success', onSuccess);
        window.socket.off('login_error', onError);
      }
      if (btn) btn.disabled = false;
      if (fb) {
        fb.style.background = '#fef2f2';
        fb.style.color = '#dc2626';
        fb.innerHTML = '❌ O servidor não respondeu. Verifique a conexão.';
      }
    }, 6000);

    const onSuccess = (data) => {
      if (mobTimeout) clearTimeout(mobTimeout);
      window.socket.off('login_success', onSuccess);
      window.socket.off('login_error', onError);
      if (data.restaurante_id) localStorage.setItem('restaurante_id', data.restaurante_id);
      if (btn) btn.disabled = false;
      if (fb) {
        fb.style.background = '#f0fdf4';
        fb.style.color = '#16a34a';
        fb.innerHTML = `✅ Bem-vindo(a), ${data.nome}!`;
      }
      setTimeout(() => {
        window.fecharModalLoginFuncionarioMobile();
        const statusUser = document.getElementById('status-user-name');
        if (statusUser) statusUser.textContent = `${data.nome}${data.cargo ? ' (' + data.cargo + ')' : ''}`;
        const menuUser = document.getElementById('mobile-menu-user-name');
        if (menuUser) menuUser.textContent = `${data.nome}${data.cargo ? ' (' + data.cargo + ')' : ''}`;
        window.closeMobileMenu();
      }, 500);
    };

    const onError = (msg) => {
      if (mobTimeout) clearTimeout(mobTimeout);
      window.socket.off('login_success', onSuccess);
      window.socket.off('login_error', onError);
      if (btn) btn.disabled = false;
      if (fb) {
        fb.style.background = '#fef2f2';
        fb.style.color = '#dc2626';
        fb.innerHTML = `❌ ${msg || 'Usuário ou senha incorretos.'}`;
      }
    };

    window.socket.once('login_success', onSuccess);
    window.socket.once('login_error', onError);
    window.socket.emit('login_funcionario', { usuario: u, senha: s });
  } else {
    if (btn) btn.disabled = false;
    if (fb) {
      fb.style.background = '#fef2f2';
      fb.style.color = '#dc2626';
      fb.innerHTML = 'Erro de conexão com o servidor.';
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileMenu);
} else {
  initMobileMenu();
}
setTimeout(initMobileMenu, 300);

// --- POPUP DE AÇÕES RÁPIDAS ---
function showActionPopup(actions, x, y) {
  const popup = document.getElementById('mobile-action-popup');
  const content = document.getElementById('action-popup-content');
  if (!popup || !content) return;

  content.innerHTML = actions.map(a =>
    a.sep
      ? '<div class="action-popup-sep"></div>'
      : `<button class="action-popup-btn ${a.cls || ''}" data-action="${a.id}"><i class="ph ${a.icon}"></i>${a.label}</button>`
  ).join('');

  popup.classList.add('show');

  const pw = content.offsetWidth;
  const ph = content.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let px = Math.min(x, vw - pw - 12);
  let py = Math.min(y, vh - ph - 12);
  px = Math.max(12, px);
  py = Math.max(12, py);
  content.style.position = 'fixed';
  content.style.left = px + 'px';
  content.style.top = py + 'px';

  content.querySelectorAll('.action-popup-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.action;
      const action = actions.find(a => a.id === id);
      if (action && action.fn) action.fn();
      popup.classList.remove('show');
    });
  });

  popup.addEventListener('click', (e) => {
    if (e.target === popup) popup.classList.remove('show');
  }, { once: true });
}

// --- LONG PRESS + SWIPE + ARRASTE NO CARD DA MESA / ITEM ---
// Toque rápido = selecionar | Segurar curto (soltar ~0,5s) = menu de contexto
// Segurar 1s sem soltar = modo arraste (mesa→mesa ou item→mesa)
(function initGestures() {
  let menuTimer = null;
  let dragTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let didMove = false;
  let menuReady = false;

  /* ── Estado do arraste por toque ── */
  const drag = { ativo: false, tipo: null, nome: null, itemId: null, origem: null, ghost: null, alvo: null };
  window._chefArrastarArmado = false;
  let armadoExpira = null;

  function getMesaItem(el) {
    return el.closest('.mesa-item');
  }

  function ehMesaReal(card) {
    return !!(card && card.getAttribute('data-status') && card.id && card.id.indexOf('mesa-card-') === 0);
  }

  function getMesaName(card) {
    if (!card) return null;
    return card.getAttribute('data-mesa') || card.getAttribute('data-nome');
  }

  function getMesaItemName(card) {
    const nome = getMesaName(card);
    if (!nome) return null;
    if (window.mesasData) {
      const found = window.mesasData.find(m => m.nome === nome || m.mesaName === nome);
      if (found) return found;
    }
    return { nome: nome };
  }

  function grupoStatus(st) {
    if (st === 'reservada') return 'reservada';
    if (st === 'ocupada' || st === 'fechamento' || st === 'solicitada') return 'ocupada';
    return 'livre';
  }

  function clickDepoisDoCard(card, btnId) {
    card.click();
    setTimeout(() => { const b = document.getElementById(btnId); if (b) b.click(); }, 250);
  }

  /* ══════════ ARRASTE POR TOQUE (1s de pressão) ══════════ */

  function criarGhost(origem, x, y) {
    let g;
    if (origem.tagName === 'TR') {
      g = document.createElement('div');
      const txt = (origem.cells && origem.cells[1] ? origem.cells[1].innerText : origem.innerText).trim().split('\n')[0];
      g.style.cssText = 'background:#1e293b;color:#f8fafc;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.45);max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      g.textContent = txt;
    } else {
      g = origem.cloneNode(true);
      g.removeAttribute('id');
      const r = origem.getBoundingClientRect();
      g.style.cssText += `position:fixed;z-index:99999;width:${r.width}px;margin:0;pointer-events:none;opacity:.92;transform:scale(1.04);box-shadow:0 12px 32px rgba(0,0,0,.5);transition:none;`;
    }
    g.style.left = (x - 30) + 'px';
    g.style.top = (y - 30) + 'px';
    document.body.appendChild(g);
    return g;
  }

  function iniciarArraste(origem, tipo, nome, itemId, x, y) {
    if (drag.ativo) return;
    drag.ativo = true;
    drag.tipo = tipo;               // 'table' | 'item'
    drag.nome = nome || null;
    drag.itemId = itemId || null;
    drag.origem = origem;
    origem.classList.add('dragging-chef');
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    drag.ghost = criarGhost(origem, x, y);
    document.body.style.userSelect = 'none';
  }

  function marcarAlvo(el, x, y) {
    const under = document.elementFromPoint(x, y);
    const alvo = under ? under.closest('.mesa-item[data-status]') : null;
    const valido = alvo && !(drag.tipo === 'table' && alvo === drag.origem) && alvo.id !== 'nova-comanda-card';
    if (drag.alvo && drag.alvo !== valido) drag.alvo.classList.remove('drag-over');
    drag.alvo = valido ? alvo : null;
    if (drag.alvo) drag.alvo.classList.add('drag-over');
  }

  async function finalizarArraste(x, y) {
    if (!drag.ativo) return;
    const { tipo, nome, itemId, origem } = drag;
    const alvoEl = drag.alvo;
    if (alvoEl) alvoEl.classList.remove('drag-over');
    if (drag.ghost) drag.ghost.remove();
    if (origem) origem.classList.remove('dragging-chef');
    document.body.style.userSelect = 'none';
    Object.assign(drag, { ativo: false, tipo: null, nome: null, itemId: null, origem: null, ghost: null, alvo: null });

    if (!alvoEl) return;
    const alvoNome = getMesaName(alvoEl);
    if (!alvoNome) return;
    const operador = window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido';

    try {
      if (tipo === 'table') {
        if (alvoNome === nome) return;
        const isOccupied = window.ordersData && window.ordersData.some(o =>
          (o.mesa_grupo === alvoNome || o.localName === alvoNome) && o.status !== 'Finalizado' && o.status !== 'Cancelado' && o.status !== 'Pago'
        );
        if (isOccupied) {
          if (await chefConfirm('Mover para Comanda', `A ${alvoNome} já está ocupada. Deseja mover os pedidos da ${nome} para uma comanda na ${alvoNome} e liberar a ${nome}?`)) {
            socket.emit('transferir_mesa', { mesaAtual: nome, novaMesa: alvoNome, operador });
          }
        } else {
          if (await chefConfirm('Transferir mesa', 'Mover ' + nome + ' para ' + alvoNome + '?')) {
            socket.emit('transferir_mesa', { mesaAtual: nome, novaMesa: alvoNome, operador });
          }
        }
      } else if (tipo === 'item') {
        if (await chefConfirm('Transferir item', 'Mover este item para ' + alvoNome + '?')) {
          socket.emit('transferir_item', { itemId: itemId, novaMesa: alvoNome, operador: operador });
        }
      }
    } catch (e) { }
  }

  /* Menu de contexto → opção Mover arma o próximo toque como arraste */
  window.armaModoArraste = function () {
    window._chefArrastarArmado = true;
    clearTimeout(armadoExpira);
    armadoExpira = setTimeout(() => { window._chefArrastarArmado = false; }, 8000);
    if (window.showToastIA) showToastIA('Agora toque e segure o que deseja mover — ou apenas toque na mesa de destino', '#fc4b15');
  };

  /* ══════════ MENU DE CONTEXTO POR STATUS ══════════ */

  function montarMenuMesa(card) {
    const st = grupoStatus((card.getAttribute('data-status') || '').toLowerCase());
    const actions = [];

    if (st === 'reservada') {
      actions.push({ id: 'editar-reserva', icon: 'ph-pencil-simple', label: 'Editar Reserva', cls: 'primary', fn: () => clickDepoisDoCard(card, 'btn-reservar-mesa') });
      actions.push({
        id: 'cancelar-reserva', icon: 'ph-x-circle', label: 'Cancelar Reserva', cls: 'danger', fn: async () => {
          const nomeM = getMesaName(card);
          if (await chefConfirm('Cancelar reserva', 'Liberar a ' + nomeM + '?')) {
            socket.emit('cancelar_reserva', { mesaName: nomeM });
          }
        }
      });
      actions.push({ id: 'lancar', icon: 'ph-plus-circle', label: 'Ocupar Agora', cls: '', fn: () => clickDepoisDoCard(card, 'btn-adicionar-produtos') });
    } else if (st === 'ocupada') {
      actions.push({ id: 'lancar', icon: 'ph-plus-circle', label: 'Lançar Itens', cls: 'primary', fn: () => clickDepoisDoCard(card, 'btn-adicionar-produtos') });
      actions.push({ id: 'parcial', icon: 'ph-currency-dollar', label: 'Pagamento Parcial', cls: 'success', fn: () => clickDepoisDoCard(card, 'btn-movimento-parcial') });
      actions.push({ id: 'fechar', icon: 'ph-check-circle', label: 'Fechar Conta', cls: '', fn: () => clickDepoisDoCard(card, 'btn-movimento-concluir') });
      actions.push({ id: 'sep-a', sep: true });
      actions.push({ id: 'qr', icon: 'ph-qr-code', label: 'QR Code Mesa', cls: '', fn: () => clickDepoisDoCard(card, 'btn-qr-mesa') });
      actions.push({ id: 'cancelar', icon: 'ph-x-circle', label: 'Cancelar Mesa', cls: 'danger', fn: () => clickDepoisDoCard(card, 'btn-cancelar-mesa-direct') });
    } else {
      actions.push({ id: 'lancar', icon: 'ph-plus-circle', label: 'Ocupar Mesa', cls: 'primary', fn: () => clickDepoisDoCard(card, 'btn-adicionar-produtos') });
      actions.push({ id: 'reservar', icon: 'ph-bookmark-simple', label: 'Reservar Mesa', cls: 'purple', fn: () => clickDepoisDoCard(card, 'btn-reservar-mesa') });
      actions.push({ id: 'qr', icon: 'ph-qr-code', label: 'QR Code', cls: '', fn: () => clickDepoisDoCard(card, 'btn-qr-mesa') });
    }

    actions.push({ id: 'sep-b', sep: true });
    actions.push({ id: 'mover', icon: 'ph-arrows-out-cardinal', label: 'Mover / Transferir…', cls: '', fn: () => { window.armaModoArraste(); } });
    return actions;
  }

  function mostrarMenuMesaOuItem(card, itemRow, x, y) {
    let actions;
    const rect = (card || itemRow).getBoundingClientRect();
    if (card) {
      actions = montarMenuMesa(card);
    } else {
      const idAttr = itemRow.getAttribute('data-item-id');
      if (!idAttr) return;
      const id = parseInt(idAttr);
      actions = [
        { id: 'comanda', icon: 'ph-user-switch', label: 'Mover Comanda', cls: 'primary', fn: () => { window.alterarComandaItemDirect && window.alterarComandaItemDirect(id, ''); } },
        { id: 'excluir', icon: 'ph-trash', label: 'Excluir Item', cls: 'danger', fn: () => { window.removerItemPedido && window.removerItemPedido(id); } },
        { id: 'sep-c', sep: true },
        { id: 'mover-item', icon: 'ph-arrows-out-cardinal', label: 'Mover para outra mesa…', cls: '', fn: () => { window.armaModoArraste(); } }
      ];
    }
    showActionPopup(actions, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function limparTimers() {
    clearTimeout(menuTimer); clearTimeout(dragTimer);
    menuTimer = null; dragTimer = null;
  }

  /* ══════════ LISTENERS GLOBAIS ══════════ */

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    if (e.target.closest('button, a, input, select, .btn-action, .btn-pronto, .btn-chamar, .btn-reverter, .mobile-float-btn')) return;
    let card = getMesaItem(e.target);
    const itemRow = e.target.closest('.product-item-row');
    if (card && !ehMesaReal(card)) card = null;
    if (!card && !itemRow) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    didMove = false;
    menuReady = false;

    /* Modo armado pelo menu ("Mover / Transferir"): arrasta no toque direto */
    if (window._chefArrastarArmado) {
      window._chefArrastarArmado = false;
      clearTimeout(armadoExpira);
      const x = touchStartX, y = touchStartY;
      if (card) iniciarArraste(card, 'table', getMesaName(card), null, x, y);
      else if (itemRow) iniciarArraste(itemRow, 'item', null, parseInt(itemRow.getAttribute('data-item-id')), x, y);
      return;
    }

    menuTimer = setTimeout(() => {
      if (didMove) return;
      if (navigator.vibrate) navigator.vibrate(15);
      menuReady = true; // soltando agora abre o menu; continuando segura entra em arraste
    }, 450);

    dragTimer = setTimeout(() => {
      menuTimer = null;
      menuReady = false;
      const x = e.touches[0].clientX, y = e.touches[0].clientY;
      if (card) iniciarArraste(card, 'table', getMesaName(card), null, x, y);
      else if (itemRow) iniciarArraste(itemRow, 'item', null, parseInt(itemRow.getAttribute('data-item-id')), x, y);
    }, 1000);
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    if (drag.ativo) {
      if (e.cancelable) e.preventDefault();
      if (drag.ghost) { drag.ghost.style.left = (x - 30) + 'px'; drag.ghost.style.top = (y - 30) + 'px'; }
      marcarAlvo(null, x, y);
      return;
    }
    if (!menuTimer && !dragTimer) return;
    const dx = Math.abs(x - touchStartX);
    const dy = Math.abs(y - touchStartY);
    if (dx > 10 || dy > 10) {
      didMove = true;
      menuReady = false;
      limparTimers();
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (drag.ativo) {
      const t = e.changedTouches[0];
      finalizarArraste(t.clientX, t.clientY);
      didMove = false;
      return;
    }

    const segurouParaMenu = menuReady;
    limparTimers();

    if (segurouParaMenu) {
      const card0 = getMesaItem(e.target);
      const card = ehMesaReal(card0) ? card0 : null;
      const itemRow = e.target.closest('.product-item-row');
      if (card || itemRow) {
        const rect = (card || itemRow).getBoundingClientRect();
        mostrarMenuMesaOuItem(card, itemRow, rect.left + rect.width / 2, rect.top + rect.height / 2);
        didMove = false;
        return;
      }
    }

    if (didMove) return;
    const elapsed = Date.now() - touchStartTime;
    if (elapsed > 400) return;

    const mesaCard0 = getMesaItem(e.target);
    const mesaCard = ehMesaReal(mesaCard0) ? mesaCard0 : null;
    if (mesaCard) {
      const touchEndX = e.changedTouches[0].clientX;
      const dx = touchEndX - touchStartX;

      if (Math.abs(dx) > 60) {
        if (navigator.vibrate) navigator.vibrate(20);
        if (dx > 0) {
          mesaCard.click();
          setTimeout(() => { const b = document.getElementById('btn-adicionar-produtos'); if (b) b.click(); }, 200);
        } else {
          mesaCard.click();
          setTimeout(() => { const b = document.getElementById('btn-movimento-concluir'); if (b) b.click(); }, 200);
        }
      }
      return;
    }

    const itemRow = e.target.closest('.product-item-row');
    if (itemRow && !didMove && elapsed < 400) {
      const touchEndX = e.changedTouches[0].clientX;
      const dx = touchEndX - touchStartX;
      if (Math.abs(dx) > 60) {
        if (navigator.vibrate) navigator.vibrate(20);
        const orderId = itemRow.getAttribute('data-item-id');
        if (orderId) {
          if (dx > 0) {
            window.alterarComandaItemDirect && window.alterarComandaItemDirect(parseInt(orderId), '');
          } else {
            window.removerItemPedido && window.removerItemPedido(parseInt(orderId));
          }
        }
      }
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    limparTimers();
    menuReady = false;
    if (drag.ativo) finalizarArraste(-100, -100);
  }, { passive: true });
})();

const HOST = window.location.hostname || 'localhost';
const socket = io({ query: { token: localStorage.getItem('chef_token'), restaurante_id: localStorage.getItem('restaurante_id') || '1' } });
window.socket = socket;

socket.on('tenant_atualizado', (data) => {
  if (data && data.restaurante_id) {
    localStorage.setItem('restaurante_id', data.restaurante_id);
  }
  if (data && data.token) {
    localStorage.setItem('chef_token', data.token);
  }
  // Reconecta o socket com as novas credenciais do tenant
  socket.disconnect();
  socket.io.opts.query = { token: data.token, restaurante_id: String(data.restaurante_id) };
  socket.connect();
});

let serverIp = HOST;
let restCustomDomain = '';
let qrConfig = { qr_protocol: '', qr_port: '' };
fetch('/api/config', { headers: authHeaders() }).then(r => r.json()).then(c => { qrConfig = c || {}; }).catch(() => {});

function buildAppUrl(page, mesaNome) {
  const proto = (qrConfig.qr_protocol === 'https' || qrConfig.qr_protocol === 'http')
    ? qrConfig.qr_protocol
    : (window.location.protocol === 'https:' ? 'https' : 'http');
  /* Preferir custom_domain sobre IP do servidor */
  const host = (restCustomDomain && restCustomDomain.trim()) || serverIp || window.location.hostname;
  const isDomain = host.indexOf('.') !== -1 && !host.match(/^\d+\.\d+\.\d+\.\d+$/);
  const port = isDomain ? '' : (String(qrConfig.qr_port || '').trim() || window.location.port);
  const q = mesaNome ? `?mesa=${encodeURIComponent(mesaNome)}` : '';
  const tenantId = encodeURIComponent(localStorage.getItem('restaurante_id') || '1');
  const url = `${proto}://${host}${port ? ':' + port : ''}/${page}${q}`;
  return url + (url.indexOf('?') !== -1 ? '&' : '?') + 'restaurante_id=' + tenantId;
}

function updateQrCode() {
  const qrImg = document.getElementById('qr-code-img');
  if (qrImg) {
    const appUrl = buildAppUrl('cadastro.html');
    if (typeof window.qrImg === 'function') {
      window.qrImg(qrImg, appUrl, 150);
    } else {
      qrImg.src = (window.location.origin || '') + '/api/qr?size=150&data=' + encodeURIComponent(appUrl);
    }
  }
}

socket.on('server_ip', (ip) => {
  if (ip && ip !== 'localhost') {
    serverIp = ip;
    /* Se o servidor enviou um domínio (não-IP), armazenar como restCustomDomain */
    const _isIp = /^\d+\.\d+\.\d+\.\d+$/.test(ip);
    if (!_isIp && ip.indexOf('.') !== -1) restCustomDomain = ip;
    updateQrCode();
    const qrFilaModal = document.getElementById('modal-qr-fila-espera');
    if (qrFilaModal && qrFilaModal.style.display !== 'none') window.abrirQrFilaEsperaModal();
  }
});

// Nome do restaurante (via licença)
socket.on('restaurant_name', (nome) => {
  const el = document.getElementById('restaurant-name');
  if (el && nome && nome !== 'Chef Cozinha' && nome !== 'Dev Mode') {
    el.textContent = '🍳 ' + nome;
    document.title = nome + ' — Chef Cozinha';
  }
});

// Status da licença e updates
socket.on('license_status', (state) => {
  if (state && state.pendingUpdate) {
    const banner = document.getElementById('update-banner');
    const textEl = document.getElementById('update-banner-text');
    const linkEl = document.getElementById('btn-update-download');

    if (banner && textEl && linkEl) {
      const up = state.pendingUpdate;
      textEl.textContent = `🚀 Versão ${up.version} disponível! ${up.message ? `— ${up.message}` : ''}`;
      linkEl.href = up.url || '#';
      banner.style.display = 'flex';
    }
  }
});

socket.on('erro_pagamento', (msg) => {
  alert('⛔ ' + (msg || 'Erro ao processar o pagamento.'));
});

document.addEventListener('DOMContentLoaded', updateQrCode);

let ordersData = [];

window.onDropMesa = async (e, targetMesa) => {
  e.preventDefault();

  const type = e.dataTransfer.getData('type');
  if (!type) return;

  if (type === 'table') {
    const draggedMesa = e.dataTransfer.getData('mesa');
    if (!draggedMesa || draggedMesa === targetMesa) return;

    // Check if targetMesa is occupied or not by looking at window.ordersData
    const isOccupied = window.ordersData && window.ordersData.some(o =>
      (o.mesa_grupo === targetMesa || o.localName === targetMesa) && o.status !== 'Finalizado' && o.status !== 'Cancelado' && o.status !== 'Pago'
    );

    const operador = window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido';

    if (isOccupied) {
      if (await chefConfirm(
        'Mover para Comanda',
        `A ${targetMesa} já está ocupada. Deseja mover os pedidos da ${draggedMesa} para uma comanda na ${targetMesa} e liberar a ${draggedMesa}?`
      )) {
        socket.emit('transferir_mesa', { mesaAtual: draggedMesa, novaMesa: targetMesa, operador });
      }
    } else {
      if (await chefConfirm('Transferir mesa', 'Mover ' + draggedMesa + ' para ' + targetMesa + '?')) {
        socket.emit('transferir_mesa', { mesaAtual: draggedMesa, novaMesa: targetMesa, operador });
      }
    }
  } else if (type === 'item') {
    const itemId = e.dataTransfer.getData('itemId');
    if (await chefConfirm('Transferir item', 'Mover este item para ' + targetMesa + '?')) {
      socket.emit('transferir_item', { itemId: itemId, novaMesa: targetMesa, operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido' });
    }
  }
};

window.getPrecoAtivo = (productName, originalPrice) => {
  const promocoesList = window.PROMOCOES || [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

  for (const p of promocoesList) {
    if (!p.ativo) continue;
    let cfg = {};
    try { cfg = JSON.parse(p.config || '{}'); } catch (e) { }

    if (cfg.tipo_promocao === 'preco_fixo' && cfg.produto_alvo_nome === productName) {
      if (cfg.dias_semana && cfg.dias_semana.length > 0 && !cfg.dias_semana.includes(dayOfWeek)) continue;
      if (cfg.horario_inicio && currentTime < cfg.horario_inicio) continue;
      if (cfg.horario_fim && currentTime > cfg.horario_fim) continue;
      return parseFloat(cfg.novo_preco);
    }
  }
  return originalPrice;
};

window.getDescontoAtivo = (subtotal) => {
  const promocoesList = window.PROMOCOES || [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  let bestDesconto = 0;
  let bestTipo = null;

  for (const p of promocoesList) {
    if (!p.ativo) continue;
    let cfg = {};
    try { cfg = JSON.parse(p.config || '{}'); } catch (e) { }

    if (cfg.dias_semana && cfg.dias_semana.length > 0 && !cfg.dias_semana.includes(dayOfWeek)) continue;
    if (cfg.horario_inicio && currentTime < cfg.horario_inicio) continue;
    if (cfg.horario_fim && currentTime > cfg.horario_fim) continue;

    if (cfg.tipo_promocao === 'desconto_fixo' && (cfg.desconto || 0) > bestDesconto) {
      bestDesconto = cfg.desconto;
      bestTipo = 'fixo';
    } else if (cfg.tipo_promocao === 'desconto_pct' && (cfg.desconto_pct || 0) > 0) {
      const valorDesconto = subtotal * (cfg.desconto_pct / 100);
      if (valorDesconto > bestDesconto) {
        bestDesconto = valorDesconto;
        bestTipo = 'pct';
      }
    }
  }
  return { valor: bestDesconto, tipo: bestTipo };
};

const contasSolicitadas = new Set();
socket.on('sync_mesas_fechando', (list) => {
  contasSolicitadas.clear();
  list.forEach(m => contasSolicitadas.add(m));
  if (typeof renderOrders === 'function') renderOrders();
});
socket.on('toque_pedir_conta', (mesaName) => {
  contasSolicitadas.add(mesaName);
  if (typeof renderOrders === 'function') renderOrders();
});

function renderOrders() {
  const grid = document.getElementById('orders-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let totalRevenue = 0;
  let totalCost = 0;

  const groupedOrders = {};

  ordersData.forEach(order => {
    const val = order.total ? parseFloat(String(order.total).replace(',', '.')) : 0;
    totalRevenue += val;
    totalCost += val * 0.3;

    const mesaName = order.mesa_grupo || order.localName || `Pedido Avulso #${order.id}`;
    if (!groupedOrders[mesaName]) {
      groupedOrders[mesaName] = {
        mesaName,
        items: [],
        total: 0,
        pagamentosParciais: [],
        status: order.status,
        createdAt: order.createdAt,
        time: order.time,
        id: order.id,
        userName: order.userName || 'Avulso'
      };
    }
    if (order.productName && (order.productName.includes('Pagamento') || order.productName.includes('Pgto Parcial'))) {
      let metodo = 'Dinheiro';
      if (order.productName.includes('(')) {
        metodo = order.productName.split('(')[1].replace(')', '');
      }
      const isComanda = order.productName.includes('Comanda');
      groupedOrders[mesaName].pagamentosParciais.push({ valor: Math.abs(val), metodo, id: order.id, comanda: isComanda });
    } else {
      groupedOrders[mesaName].items.push(order);
      groupedOrders[mesaName].totalBruto = (groupedOrders[mesaName].totalBruto || 0) + val;
      if (order.status !== 'Pago') {
        groupedOrders[mesaName].total += val;
      }
    }
  });

  Object.keys(groupedOrders).forEach(key => {
    const group = groupedOrders[key];
    const nonPaymentItems = group.items.filter(i => i.status !== 'Pago');
    if (nonPaymentItems.length > 0) {
      const allReady = nonPaymentItems.every(i => i.status === 'Pronto' || i.status === 'Concluido');
      group.status = allReady ? 'Pronto' : nonPaymentItems[0].status;
    }
  });

  const contasPedidas = [];
  const mesasDisponiveis = [];
  const mesasOcupadas = [];
  const mesasEmFechamento = [];
  const mesasReservadas = [];

  // Deduplicar mesas da lista mestra
  const uniqueAllMesas = [];
  const seenAllMesas = new Set();
  if (window.allMesas && Array.isArray(window.allMesas)) {
    window.allMesas.forEach(m => {
      const nm = String(m.nome || m.mesaName || '').trim();
      if (nm && !seenAllMesas.has(nm.toLowerCase())) {
        seenAllMesas.add(nm.toLowerCase());
        uniqueAllMesas.push(m);
      }
    });
  }

  // Rastrear todas as mesas/grupos já alocadas para evitar qualquer duplicata
  const mesasAlocadas = new Set();

  function alocarMesa(item, categoria) {
    if (!item) return;
    const nome = String(item.mesaName || item.nome || '').trim();
    if (!nome) return;

    // Verificar se a mesa ou qualquer uma das mesas do grupo já foi alocada
    const partes = nome.split(/\s*\+\s*/).map(p => p.trim().toLowerCase());
    const jaAlocada = partes.some(p => mesasAlocadas.has(p));
    if (jaAlocada) return;

    // Registrar todas as partes como alocadas
    partes.forEach(p => mesasAlocadas.add(p));
    mesasAlocadas.add(nome.toLowerCase());

    if (categoria === 'pedida') contasPedidas.push(item);
    else if (categoria === 'fechamento') mesasEmFechamento.push(item);
    else if (categoria === 'ocupada') mesasOcupadas.push(item);
    else if (categoria === 'reservada') mesasReservadas.push(item);
    else if (categoria === 'disponivel') mesasDisponiveis.push(item);
  }

  // 1. Processar primeiro pedidos agrupados (mesas ocupadas / com consumo real)
  Object.keys(groupedOrders).forEach(groupKey => {
    const group = groupedOrders[groupKey];
    const nome = String(group.mesaName || groupKey).trim();
    if (!nome || nome.includes('Delivery')) return;

    if (contasSolicitadas.has(nome) || groupKey.split(/\s*\+\s*/).some(p => contasSolicitadas.has(p.trim()))) {
      alocarMesa({ ...group, isGroup: true }, 'pedida');
    } else if (group.status === 'Concluído' || group.status === 'Pronto') {
      alocarMesa({ ...group, isGroup: true }, 'fechamento');
    } else {
      alocarMesa({ ...group, isGroup: true }, 'ocupada');
    }
  });

  // 2. Processar mesas cadastradas no sistema que ainda não foram alocadas
  uniqueAllMesas.forEach(mesa => {
    const nome = String(mesa.nome || '').trim();
    if (!nome || nome.includes('Delivery')) return;
    if (mesasAlocadas.has(nome.toLowerCase())) return;

    if (mesa.status === 'Reservada') {
      alocarMesa({ ...mesa, isGroup: false }, 'reservada');
    } else if (mesa.status === 'Ocupada') {
      alocarMesa({
        mesaName: mesa.nome,
        nome: mesa.nome,
        isGroup: true,
        status: 'Aberto',
        items: [],
        total: 0,
        totalBruto: 0,
        userName: 'Caixa',
        observacao: mesa.observacao,
        originalMesa: mesa
      }, 'ocupada');
    } else {
      alocarMesa({ ...mesa, isGroup: false }, 'disponivel');
    }
  });

  const elOcupadas = document.getElementById('info-mesas-ocupadas');
  const elLivres = document.getElementById('info-mesas-livres');
  const elFechando = document.getElementById('info-mesas-fechando');
  const elReservadas = document.getElementById('info-mesas-reservadas');

  let ped = contasPedidas;
  let disp = mesasDisponiveis;
  let ocup = mesasOcupadas;
  let fech = mesasEmFechamento;
  let reser = mesasReservadas;

  if (window.viewFilter === 'Comandas') {
    ped = ped.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
    disp = disp.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
    ocup = ocup.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
    fech = fech.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
    reser = reser.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
  } else {
    ped = ped.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
    disp = disp.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
    ocup = ocup.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
    fech = fech.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
    reser = reser.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));
  }

  // --- COMANDAS CRIADAS DENTRO DAS MESAS (vista "Comandas") ---
  let comandaEntries = [];
  if (window.viewFilter === 'Comandas') {
    const comandaGroups = {};
    ordersData.forEach(order => {
      const mesaName = (order.mesa_grupo || order.localName || '').trim();
      const comanda = order.mesa_comanda ? String(order.mesa_comanda).trim() : '';
      if (!mesaName || !comanda) return;
      if (order.status === 'Pago' || order.status === 'Finalizado' || order.status === 'Cancelado') return;
      const pn = String(order.productName || '');
      if (pn.includes('Pagamento') || pn.includes('Pgto Parcial')) return;
      const val = parseFloat(String(order.total).replace(',', '.')) || 0;
      const key = mesaName + '|' + comanda;
      if (!comandaGroups[key]) comandaGroups[key] = { mesaName, comanda, total: 0, items: 0 };
      comandaGroups[key].total += val;
      comandaGroups[key].items++;
    });
    comandaEntries = Object.values(comandaGroups)
      .sort((a, b) => a.mesaName.localeCompare(b.mesaName) || a.comanda.localeCompare(b.comanda));
  }

  const renderComandasInsideMesas = (entries) => {
    let html = `
      <div class="mesa-category">
        <div class="mesa-category-title">
          <span><i class="ph ph-receipt" style="margin-right:4px;"></i> Comandas nas Mesas</span>
          <span class="mesa-category-count">${entries.length}</span>
        </div>
        <div class="mesas-grid-layout">
    `;
    entries.forEach(entry => {
      const uid = Math.random().toString(36).substr(2, 9);
      entry.uid = uid;
      html += `
          <div class="mesa-item comanda-inside-card" id="comanda-card-${uid}" data-mesa="${escHtml(entry.mesaName)}" data-comanda="${escHtml(entry.comanda)}" title="Abrir mesa ${escHtml(entry.mesaName)} e ver a comanda ${escHtml(entry.comanda)}">
            <div class="mesa-header-info">
              <span class="mesa-id">${escHtml(entry.comanda)}</span>
              <i class="ph ph-receipt mesa-icon" style="color: #fc4b15;"></i>
            </div>
            <div class="mesa-client" style="color: var(--text-secondary);"><i class="ph ph-armchair" style="margin-right:3px;"></i> ${escHtml(entry.mesaName)}</div>
            <div class="mesa-client">${entry.items} item(s)</div>
            <div class="mesa-value">R$ ${entry.total.toFixed(2).replace('.', ',')}</div>
          </div>
      `;
    });
    html += `
          <div class="mesa-item nova-comanda-card" id="nova-comanda-card" title="Criar uma nova comanda">
            <div class="nova-comanda-inner">
              <i class="ph ph-plus-circle" style="font-size:22px; color:#fc4b15;"></i>
              <span class="nova-comanda-label">+ Nova Comanda</span>
            </div>
            <div class="nova-comanda-sub">Criar comanda e iniciar venda</div>
          </div>
        </div>
      </div>
    `;
    return html;
  };

  if (elOcupadas) elOcupadas.innerText = ocup.length + fech.length + ped.length;
  if (elLivres) elLivres.innerText = disp.length;
  if (elFechando) elFechando.innerText = fech.length;
  if (elReservadas) elReservadas.innerText = reser.length;

  const renderSection = (title, count, items, statusClass) => {
    if (items.length === 0) return '';
    let html = `
      <div class="mesa-category">
        <div class="mesa-category-title">
          <span>${title}</span>
          <span class="mesa-category-count">${count}</span>
        </div>
        <div class="mesas-grid-layout">
    `;
    items.forEach((item, idx) => {
      const isGroup = item.isGroup;
      const nome = isGroup ? item.mesaName : item.nome;
      let totalBase = isGroup ? (item.totalBruto || item.total) : 0;
      const taxaCheckbox = document.getElementById('taxa-servico');
      if (isGroup && taxaCheckbox && taxaCheckbox.checked) {
        totalBase *= 1.1; // Add 10%
      }
      const valTotal = isGroup ? totalBase.toFixed(2).replace('.', ',') : '0,00';
      let atendente = isGroup ? item.userName : '-';
      let cliente = '-';
      const mesaCli = (!isGroup && window.mesaClientes && window.mesaClientes[nome]) ? window.mesaClientes[nome] : null;
      if (mesaCli && mesaCli.cliente_nome) {
        cliente = mesaCli.cliente_nome;
      } else if (item.observacao) {
        try {
          const obsObj = JSON.parse(item.observacao);
          if (obsObj.cliente) cliente = obsObj.cliente;
          if (obsObj.data) {
            const dt = new Date(obsObj.data);
            if (!isNaN(dt)) cliente += ` (${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')})`;
          }
        } catch (e) { }
      }

      const uid = Math.random().toString(36).substr(2, 9);
      item.uid = uid;
      let iconClass = 'ph-users';
      let iconColor = '#888';
      if (statusClass === 'solicitada') { iconClass = 'ph-receipt'; iconColor = '#3b82f6'; }
      else if (statusClass === 'fechamento') { iconClass = 'ph-currency-circle-dollar'; iconColor = '#a855f7'; }
      else if (statusClass === 'ocupada') { iconClass = 'ph-users'; iconColor = '#ef4444'; }
      else if (statusClass === 'reservada') { iconClass = 'ph-bookmark-simple'; iconColor = '#f59e0b'; }
      else if (statusClass === 'disponivel' || statusClass === 'livre') { iconClass = 'ph-chair'; iconColor = '#22c55e'; }

      html += `
          <div class="mesa-item status-${statusClass}" id="mesa-card-${uid}" style="position: relative;" data-mesa="${nome}" data-status="${statusClass}" draggable="true" ondragstart="window.onDragStartTable(event, '${nome}')" ondragover="event.preventDefault(); this.classList.add('drag-over');" ondragleave="this.classList.remove('drag-over');" ondrop="window.onDropMesa(event, '${nome}'); this.classList.remove('drag-over');">
            ${statusClass === 'solicitada' ? '<div style="position: absolute; top: -8px; right: -8px; background: var(--bg-card); border-radius: 50%; padding: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); display: flex;"><i class="ph ph-receipt" style="color: #3498db;"></i></div>' : ''}
            <div class="mesa-header-info">
              <span class="mesa-id">${nome}</span>
              <i class="ph ${iconClass} mesa-icon" style="color: ${iconColor};"></i>
            </div>
            <div class="mesa-client">Atendente: ${atendente}</div>
            ${item.isGroup && item.items && item.mesaName && item.mesaName.includes(' + ') ? `<div class="mesa-client" style="color:#1565c0; font-weight:600;"><i class="ph ph-stack" style="margin-right:3px;"></i>${[...new Set(item.items.map(o => o.localName).filter(Boolean))].length} comandas</div>` : ''}
            ${cliente !== '-' ? `<div class="mesa-client" style="color:#fc4b15;">Cliente: ${cliente}</div>` : ''}
            <div class="mesa-value">R$ ${valTotal}</div>
          </div>
       `;
    });
    html += `</div></div>`;
    return html;
  };

  let html = '';
  if (window.viewFilter === 'Comandas') {
    html += renderComandasInsideMesas(comandaEntries);
  }
  html += renderSection('Conta Solicitada', ped.length, ped, 'solicitada');
  html += renderSection('Para Fechar', fech.length, fech, 'fechamento');
  html += renderSection('Ocupadas', ocup.length, ocup, 'ocupada');
  html += renderSection('Reservadas', reser.length, reser, 'reservada');
  html += renderSection('Disponíveis', disp.length, disp, 'disponivel');

  if (typeof morphdom !== 'undefined') morphdom(grid, '<div>' + html + '</div>', { childrenOnly: true }); else grid.innerHTML = html;
  const allRenderedItems = [...ped, ...fech, ...ocup, ...reser, ...disp];
  // Re-selection will run after events are bound at the end of renderOrders

  const btnParcial = document.getElementById('btn-movimento-parcial');
  if (btnParcial) {
    btnParcial.onclick = () => {
      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ou comanda ocupada primeiro.');
      if (typeof window.switchMobileTab === 'function') window.switchMobileTab('pedido');
      window.abrirCheckoutModal();
      setTimeout(() => {
        const inputVal = document.getElementById('checkout-modal-valor');
        if (inputVal) inputVal.focus();
      }, 150);
    };
  }

  const btnConcluir = document.getElementById('btn-movimento-concluir');
  if (btnConcluir) {
    btnConcluir.onclick = () => {
      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');
      window.abrirCheckoutModal();
    };
  }

  const btnToolbarMesas = document.getElementById('toolbar-mesas');
  const btnToolbarComandas = document.getElementById('toolbar-comandas');
  // Preserva a vista atual (Comandas/Mesas) entre re-renders (ex: atualizações via socket)
  window.viewFilter = (btnToolbarComandas && btnToolbarComandas.classList.contains('active')) ? 'Comandas' : 'Mesas';

  if (btnToolbarMesas) {
    btnToolbarMesas.onclick = () => {
      window.viewFilter = 'Mesas';
      document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
      btnToolbarMesas.classList.add('active');
      if (typeof renderOrders === 'function') renderOrders();
    };
  }
  if (btnToolbarComandas) {
    btnToolbarComandas.onclick = () => {
      window.viewFilter = 'Comandas';
      document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
      btnToolbarComandas.classList.add('active');
      if (typeof renderOrders === 'function') renderOrders();
    };
  }

  const btnBalcao = document.getElementById('toolbar-balcao');
  if (btnBalcao) {
    btnBalcao.onclick = () => {
      const btnAdicionar = document.getElementById('btn-adicionar-produtos');
      if (btnAdicionar) btnAdicionar.click();
      const pdvTipo = document.getElementById('pdv-tipo-pedido');
      if (pdvTipo) {
        pdvTipo.value = 'Balcão';
        pdvTipo.dispatchEvent(new Event('change'));
      }
    };
  }

  const btnDelivery = document.getElementById('toolbar-delivery');
  if (btnDelivery) {
    btnDelivery.onclick = () => {
      const btnAdicionar = document.getElementById('btn-adicionar-produtos');
      if (btnAdicionar) btnAdicionar.click();
      const pdvTipo = document.getElementById('pdv-tipo-pedido');
      if (pdvTipo) {
        pdvTipo.value = 'Delivery';
        pdvTipo.dispatchEvent(new Event('change'));
      }
    };
  }

  const pdvCliSearchBtn = document.getElementById('pdv-cliente-search-btn');
  const btnAlterarMesa = document.getElementById('btn-alterar-mesa');
  if (btnAlterarMesa) {
    btnAlterarMesa.onclick = () => {
      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');
      const novaMesa = prompt('Digite o novo número ou nome da mesa:', window.mesaAtual.nome || window.mesaAtual.mesaName);
      if (novaMesa && novaMesa.trim() !== '') {
        socket.emit('transferir_mesa', {
          mesaAtual: window.mesaAtual.nome || window.mesaAtual.mesaName,
          novaMesa: novaMesa.trim(),
          operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido'
        });
      }
    };
  }

  const btnJuntarMesa = document.getElementById('btn-juntar-mesa');
  if (btnJuntarMesa) {
    btnJuntarMesa.onclick = () => {
      window.abrirModalJuntarMesas();
    };
  }

  const btnChamarGarcom = document.getElementById('btn-chamar-garcom');
  if (btnChamarGarcom) {
    btnChamarGarcom.onclick = () => {
      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');
      const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
      socket.emit('chamar_garcom', {
        localName: mesaName,
        userName: window.loggedInUser || 'Caixa',
        productName: 'Atendimento solicitado',
        quantity: 1
      });
      alert('Garçom chamado para ' + mesaName + '!');
    };
  }

  // --- BOTÃO AGRUPAR ITENS ---
  const btnAgrupar = document.getElementById('btn-agrupar-itens');
  if (btnAgrupar) {
    btnAgrupar.onclick = () => {
      window.agruparItens = !window.agruparItens;
      if (window.agruparItens) {
        btnAgrupar.style.backgroundColor = '#3ab55b';
        btnAgrupar.style.color = 'white';
        btnAgrupar.innerHTML = '<i class="ph ph-list-dashes"></i> Desagrupar';
      } else {
        btnAgrupar.style.backgroundColor = '';
        btnAgrupar.style.color = '';
        btnAgrupar.innerHTML = '<i class="ph ph-list-dashes"></i> Agrupar';
      }

      // Re-render current mesa if selected
      if (window.mesaAtual) {
        const card = Array.from(document.querySelectorAll('.mesa-item')).find(c => c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.mesaName || c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.nome);
        if (card) card.click();
      } else {
        alert(window.agruparItens ? 'A visualização dos itens agora será agrupada por produto.' : 'A visualização dos itens agora será separada (um por linha).');
      }
    };
  }

  // --- BOTÃO VER COMISSÃO ---
  const btnComissao = document.getElementById('btn-ver-comissao');
  if (btnComissao) {
    btnComissao.onclick = () => {
      if (window.mesaAtual && window.mesaAtual.isGroup !== false) {
        const comissao = window.mesaAtual.total * 0.1;
        alert(`Comissão desta mesa (10%): R$ ${comissao.toFixed(2).replace('.', ',')}\n\nO valor já está contabilizado no painel de Resumo na barra lateral direita!`);
      } else {
        // Se nenhuma mesa selecionada, abre o relatório de comissões (Garçons)
        document.getElementById('menu-relatorios')?.click();
        alert('Aqui você pode visualizar o faturamento total por garçom (base para a comissão do turno).');
      }
    };
  }

  allRenderedItems.forEach(item => {
    const card = document.getElementById(`mesa-card-${item.uid}`);
    if (!card) return;

    card.addEventListener('dblclick', () => {
      card.click();
      const btnAdicionar = document.getElementById('btn-adicionar-produtos');
      if (btnAdicionar) btnAdicionar.click();
    });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const nomeMesa = item.isGroup ? item.mesaName : item.nome;
      const isOcupada = item.status === 'Ocupada' || (item.totalPedidos && item.totalPedidos > 0);
      if (!item.isGroup && !isOcupada) {
        showActionPopup([
          { id: 'reservar', icon: 'ph-bookmark-simple', label: 'Reservar Mesa', cls: 'purple', fn: () => { card.click(); setTimeout(() => { const b = document.getElementById('btn-reservar-mesa'); if (b) b.click(); }, 100); } },
          { id: 'qr', icon: 'ph-qr-code', label: 'QR Code', cls: 'primary', fn: () => { card.click(); setTimeout(() => { const b = document.getElementById('btn-qr-mesa'); if (b) b.click(); }, 100); } }
        ], e.clientX, e.clientY);
        return;
      }
      showActionPopup([
        { id: 'lancar', icon: 'ph-plus-circle', label: 'Lançar Itens', cls: 'primary', fn: () => { card.click(); setTimeout(() => { const b = document.getElementById('btn-adicionar-produtos'); if (b) b.click(); }, 150); } },
        { id: 'parcial', icon: 'ph-currency-dollar', label: 'Pagamento Parcial', cls: 'success', fn: () => { card.click(); setTimeout(() => { const b = document.getElementById('btn-movimento-pagamento-parcial'); if (b) b.click(); }, 150); } },
        { id: 'fechar', icon: 'ph-check-circle', label: 'Fechar Conta', cls: '', fn: () => { card.click(); setTimeout(() => { const b = document.getElementById('btn-movimento-concluir'); if (b) b.click(); }, 150); } },
        { id: 'sep1', sep: true },
        {
          id: 'cancelar', icon: 'ph-x-circle', label: 'Cancelar Mesa', cls: 'danger', fn: () => {
            window.solicitarAutorizacaoAdmin(
              'Cancelar Mesa',
              `Deseja cancelar todos os pedidos da mesa ${nomeMesa}? Esta ação irá marcar todos os pedidos como Cancelado e liberar a mesa.`,
              (senha, motivo) => {
                socket.emit('cancelar_mesa', { mesaName: nomeMesa, motivo, senha });
              }
            );
          }
        }
      ], e.clientX, e.clientY);
    });

    card.addEventListener('click', () => {
      document.querySelectorAll('.mesa-item').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      const nomeMesa = item.isGroup ? item.mesaName : item.nome;

      const updateSummaryValue = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = `R$ ${val.toFixed(2).replace('.', ',')}`;
      };


      const infoMesa = document.getElementById('info-mesa-nome');
      const infoCliente = document.getElementById('info-cliente-nome');
      const infoClienteRow = document.getElementById('row-info-cliente-nome');
      const infoAtendente = document.getElementById('info-atendente-nome');
      const infoPermanencia = document.getElementById('info-permanencia');
      if (infoMesa) infoMesa.innerText = nomeMesa;
      if (infoAtendente) infoAtendente.innerText = item.isGroup ? item.userName : '-';

      let clientName = '-';
      const obsData = item.observacao || '';
      if (obsData) {
        try {
          const obsObj = JSON.parse(obsData);
          if (obsObj.cliente) clientName = obsObj.cliente;
        } catch (e) { }
      }

      if (infoCliente && infoClienteRow) {
        if (clientName !== '-') {
          infoCliente.innerText = clientName;
          infoClienteRow.style.display = 'flex';
        } else {
          infoClienteRow.style.display = 'none';
        }
      }

      const mobMesa = document.getElementById('mobile-info-mesa-nome');
      const mobCliente = document.getElementById('mobile-info-cliente');
      const mobPerm = document.getElementById('mobile-info-permanencia');
      if (mobMesa) mobMesa.innerText = nomeMesa;
      if (mobCliente) mobCliente.innerText = item.isGroup ? item.userName : '-';

      const acoesMesa = document.getElementById('acoes-info-mesa');
      const acoesSummary = document.getElementById('mobile-acoes-summary');
      if (acoesMesa) acoesMesa.innerText = nomeMesa;
      if (acoesSummary) acoesSummary.style.display = 'flex';

      if (infoPermanencia) {
        if (!item.isGroup || !item.items || item.items.length === 0) {
          infoPermanencia.innerText = '0min';
          if (mobPerm) mobPerm.innerText = '0min';
        } else {
          // item.items[0].time might be "HH:MM"
          window.updatePermanencia = () => {
            const firstTimeStr = item.items[0].time; // "14:35"
            if (firstTimeStr && firstTimeStr.includes(':')) {
              const [h, m] = firstTimeStr.split(':').map(Number);
              const now = new Date();
              let orderDate = new Date();
              orderDate.setHours(h, m, 0, 0);
              if (orderDate > now) {
                // crossed midnight?
                orderDate.setDate(orderDate.getDate() - 1);
              }
              const diffMs = now - orderDate;
              const diffMin = Math.floor(diffMs / 60000);
              infoPermanencia.innerText = diffMin + 'min';
              if (mobPerm) mobPerm.innerText = diffMin + 'min';
            } else {
              infoPermanencia.innerText = '0min';
              if (mobPerm) mobPerm.innerText = '0min';
            }
          };
          window.updatePermanencia();
        }
      }


      const tbody = document.getElementById('panel-items-tbody');

      const leftActionsContainer = document.getElementById('left-actions-container');
      const mesaBanner = document.getElementById('mesa-selecionada-banner');
      const mesaBannerNome = document.getElementById('mesa-selecionada-nome');
      const actMovimentos = document.getElementById('action-group-movimentos');
      const actRelatorios = document.getElementById('action-group-relatorios');

      window.mesaAtual = item;
      window.descontoAdicional = 0;
      if (typeof window.renderItensRecolhidosMesas === 'function') {
        try { window.renderItensRecolhidosMesas(); } catch (e) { }
      }
      if (leftActionsContainer) {
        leftActionsContainer.style.opacity = '1';
        leftActionsContainer.style.pointerEvents = 'auto';
      }
      if (mesaBanner && mesaBannerNome) {
        mesaBanner.style.display = 'flex';
        mesaBannerNome.innerText = item.nome || item.mesaName;
      }

      if (!item.isGroup) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">Mesa ${item.status === 'Reservada' ? 'Reservada' : 'Livre'}</td></tr>`;
        updateSummaryValue('resumo-produtos', 0);
        updateSummaryValue('resumo-comissao', 0);
        updateSummaryValue('resumo-subtotal', 0);
        updateSummaryValue('resumo-taxas', 0);
        document.getElementById('total-pagar-text').innerText = 'R$ 0,00';
        document.getElementById('total-pago-text').innerText = 'R$ 0,00';
        document.getElementById('falta-pagar-text').innerText = 'R$ 0,00';

        const btnFinalizar = document.getElementById('btn-finalizar-venda');
        if (btnFinalizar) {
          btnFinalizar.style.opacity = '0.5';
          btnFinalizar.style.pointerEvents = 'none';
        }

        if (actMovimentos) {
          actMovimentos.style.opacity = '0.5';
          actMovimentos.style.pointerEvents = 'none';
        }
        if (actRelatorios) {
          actRelatorios.style.opacity = '0.5';
          actRelatorios.style.pointerEvents = 'none';
        }
        return;
      }

      if (actMovimentos) {
        actMovimentos.style.opacity = '1';
        actMovimentos.style.pointerEvents = 'auto';
      }
      if (actRelatorios) {
        actRelatorios.style.opacity = '1';
        actRelatorios.style.pointerEvents = 'auto';
      }

      window.gorjetaAdicional = 0;
      window.descontoAdicional = 0;
      window.servicoAdicional = 0;

      let itemsToRender = item.items;
      if (window.agruparItens) {
        const grouped = {};
        item.items.forEach(order => {
          const key = order.productName;
          if (!grouped[key]) grouped[key] = { ...order, quantity: 0, totalVal: 0 };
          const totalVal = parseFloat(String(order.total).replace(',', '.'));
          grouped[key].quantity += (order.quantity || 1);
          grouped[key].totalVal += totalVal;
        });
        itemsToRender = Object.values(grouped).map(g => ({ ...g, total: g.totalVal }));
      }

      // Check if this is a merged mesa (has items from multiple localNames)
      const isMergedMesa = item.isGroup && item.items && item.items.length > 0 && item.mesaName && item.mesaName.includes(' + ');
      const originalMesas = isMergedMesa ? [...new Set(item.items.map(o => o.localName).filter(Boolean))] : [];

      let itemsHTML = '';
      itemsToRender.forEach((order, idx) => {
        const totalVal = parseFloat(String(order.total).replace(',', '.'));
        const isPaid = order.status === 'Pago';
        const comandaTag = order.mesa_comanda
          ? `<span class="comanda-badge" title="Clique para alterar ou remover da comanda (${order.mesa_comanda})" onclick="event.stopPropagation(); window.alterarComandaItemDirect(${order.id}, '${order.mesa_comanda}')">(${order.mesa_comanda}) <i class="ph ph-x" style="font-size:10px; margin-left:2px;"></i></span>`
          : `<span class="shared-badge" title="Clique para atribuir este item a uma comanda" onclick="event.stopPropagation(); window.alterarComandaItemDirect(${order.id}, '')">[Mesa]</span>`;

        // For merged mesas, show original mesa as a colored badge
        const mesaOrigemBadge = isMergedMesa && order.localName
          ? `<span style="display:inline-block; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; background:${order.localName === originalMesas[0] ? '#e3f2fd' : '#fff3e0'}; color:${order.localName === originalMesas[0] ? '#1565c0' : '#e65100'}; margin-left:6px;">${order.localName}</span>`
          : '';

        itemsHTML += `
           <tr style="${isPaid ? 'opacity: 0.5;' : ''}" draggable="true" ondragstart="window.onDragStartItem(event, ${order.id}, '${order.mesa_comanda || ''}')" class="product-item-row" data-item-id="${order.id}" data-item-name="${(order.productName || 'Produto').replace(/"/g, '&quot;')}" data-item-status="${order.status || ''}">
             <td>${String(idx + 1).padStart(3, '0')}</td>
             <td style="${isPaid ? 'text-decoration: line-through;' : ''}">
               ${order.productEmoji || ''} ${order.productName || 'Produto'}
               ${mesaOrigemBadge}
               ${comandaTag}
               ${isPaid ? '<strong style="color: #3ab55b; margin-left: 8px;">(PAGO)</strong>' : ''}
             </td>
             <td>R$ ${(totalVal / (order.quantity || 1)).toFixed(2).replace('.', ',')}</td>
             <td>${order.quantity || 1}</td>
             <td style="font-weight: 600; color: #3ab55b;">R$ ${totalVal.toFixed(2).replace('.', ',')}</td>
             <td>${order.userName || 'Caixa'}</td>
             <td>
                ${isPaid ? '' : `
                   <i class="ph-bold ph-divide" style="color: #ea580c; cursor: pointer; margin-right: 8px; font-size: 16px;" title="Dividir este item em frações (½, ⅓, ¼, etc.) e atribuir a comandas" onclick="window.abrirModalDividirItemFracao(${order.id}, '${(order.productName || 'Produto').replace(/'/g, "\\'")}', '${order.productEmoji || '🍽️'}', ${totalVal}, ${(order.quantity || 1)})"></i>
                   <i class="ph ph-user-switch" style="color: #2b5c9e; cursor: pointer; margin-right: 8px; font-size: 16px;" title="Atribuir / Mover Comanda" onclick="window.alterarComandaItemDirect(${order.id}, '${order.mesa_comanda || ''}')"></i>
                   <i class="ph ph-trash" style="color: #eb5757; cursor: pointer; font-size: 16px;" title="Remover item do pedido" onclick="window.removerItemPedido('${order.id}')"></i>
                `}
             </td>
           </tr>
         `;
      });
      if (tbody) tbody.innerHTML = itemsHTML;

      // --- CÁLCULO E DIVISÃO POR COMANDA ---
      const divRacha = document.getElementById('div-racha-comandas');
      const listRacha = document.getElementById('racha-comandas-list');
      const chkRachaShared = document.getElementById('chk-racha-compartilhados');

      if (divRacha && listRacha) {
        const unpaidItems = item.items.filter(o => o.status !== 'Pago');

        const comandaSums = {};
        let sharedTotal = 0;
        let hasComandas = false;

        // Para mesas juntadas, agrupar por localName (mesa original) como comanda
        const isMergedMesaRacha = item.isGroup && item.mesaName && item.mesaName.includes(' + ');

        unpaidItems.forEach(order => {
          const val = parseFloat(String(order.total).replace(',', '.'));
          let comanda;
          if (isMergedMesaRacha && order.localName) {
            comanda = order.localName;
          } else {
            comanda = order.mesa_comanda ? order.mesa_comanda.trim() : '';
          }
          if (comanda) {
            comandaSums[comanda] = (comandaSums[comanda] || 0) + val;
            hasComandas = true;
          } else {
            sharedTotal += val;
          }
        });

        divRacha.style.display = 'block';

        const activeComandaNames = Object.keys(comandaSums);
        const numComandas = activeComandaNames.length;

        const isSharedSplit = chkRachaShared && chkRachaShared.checked;
        const sharePerComanda = (isSharedSplit && numComandas > 0) ? (sharedTotal / numComandas) : 0;

        let rachaHTML = '';

        // 1. Renderiza cada comanda ativa com suporte a Drop
        const mesaIcon = isMergedMesaRacha ? 'ph-armchair' : 'ph-user';
        const mesaLabel = isMergedMesaRacha ? 'Mesa' : 'Comanda';
        activeComandaNames.forEach(cName => {
          let total = comandaSums[cName] + sharePerComanda;

          const serviceCheckbox = document.getElementById('taxa-servico');
          if (serviceCheckbox && serviceCheckbox.checked) {
            total *= 1.1;
          }

          rachaHTML += `
                 <div class="comanda-racha-row" 
                      onclick="window.cobrarComanda('${cName}', ${total})" 
                      ondragover="window.onDragOverComandaRow(event)" 
                      ondragleave="window.onDragLeaveComandaRow(event)" 
                      ondrop="window.onDropItemOnComanda(event, '${cName}')"
                      title="Clique para cobrar ${mesaLabel.toLowerCase()} '${cName}' ou Arraste um produto aqui para colocá-lo nesta ${mesaLabel.toLowerCase()}">
                     <span style="font-weight:600; color:#fc4b15;"><i class="ph ${mesaIcon}"></i> ${cName}</span>
                     <span style="font-weight:700; color:#3ab55b;">R$ ${total.toFixed(2).replace('.', ',')}</span>
                 </div>
              `;
        });

        // 2. Renderiza os Itens Compartilhados da Mesa (Alvo de Drop para remover de comanda)
        let sharedVal = sharedTotal;
        const serviceCheckbox = document.getElementById('taxa-servico');
        if (serviceCheckbox && serviceCheckbox.checked) {
          sharedVal *= 1.1;
        }

        rachaHTML += `
              <div class="comanda-racha-row shared-target-row" 
                   onclick="window.cobrarComanda('', ${sharedVal})" 
                   ondragover="window.onDragOverComandaRow(event)" 
                   ondragleave="window.onDragLeaveComandaRow(event)" 
                   ondrop="window.onDropItemOnComanda(event, '')"
                   title="Clique para cobrar os Itens Compartilhados ou Arraste um produto aqui para REMOVER da comanda e deixar na Mesa">
                 <span><i class="ph ph-squares-four"></i> Itens Compartilhados</span>
                 <span style="font-weight:700;">R$ ${sharedVal.toFixed(2).replace('.', ',')}</span>
              </div>
           `;

        // 3. Renderiza zona para criar/mover para Nova Comanda via Arraste
        rachaHTML += `
              <div class="comanda-racha-row add-comanda-target-row" 
                   ondragover="window.onDragOverComandaRow(event)" 
                   ondragleave="window.onDragLeaveComandaRow(event)" 
                   ondrop="window.onDropItemOnNovaComanda(event)"
                   onclick="window.onDropItemOnNovaComanda(event)"
                   title="Arraste qualquer produto aqui para mover/atribuir a uma NOVA comanda">
                 <span style="color:#2b5c9e; font-size:12px; font-weight:600;"><i class="ph ph-plus-circle"></i> + Criar / Mover para Nova Comanda</span>
                 <span style="font-size:10px; color:#888; font-style:italic;">(Arrastar produto aqui)</span>
              </div>
           `;

        listRacha.innerHTML = rachaHTML;
      }

      updateSummaryValue('resumo-produtos', item.totalBruto || item.total);
      updateSummaryValue('resumo-comissao', item.total * 0.1);
      updateSummaryValue('resumo-subtotal', item.totalBruto || item.total);

      const taxaCheckbox = document.getElementById('taxa-servico');
      window.calcularTotal = () => {
        let totalComTaxa = (item.totalBruto || item.total) + window.servicoAdicional - window.descontoAdicional;
        let valorServicos = window.servicoAdicional;

        if (taxaCheckbox && taxaCheckbox.checked) {
          const baseParaTaxa = Math.max(0, (item.totalBruto || item.total) - window.descontoAdicional);
          valorServicos += baseParaTaxa * 0.10;
          totalComTaxa += baseParaTaxa * 0.10;
        }

        updateSummaryValue('resumo-taxas', valorServicos);

        const descEl = document.getElementById('resumo-descontos');
        if (descEl) descEl.innerText = `R$ ${window.descontoAdicional.toFixed(2).replace('.', ',')}`;

        const formattedTotal = `R$ ${totalComTaxa.toFixed(2).replace('.', ',')}`;
        document.getElementById('total-pagar-text').innerText = formattedTotal;
        const mobTotal = document.getElementById('mobile-info-total');
        if (mobTotal) mobTotal.innerText = formattedTotal;
        return totalComTaxa;
      };

      window.calcularTotal();
      const modalTaxaCheckbox = document.getElementById('checkout-modal-taxa');
      if (modalTaxaCheckbox && taxaCheckbox) {
        modalTaxaCheckbox.checked = taxaCheckbox.checked;
        modalTaxaCheckbox.onchange = () => {
          taxaCheckbox.checked = modalTaxaCheckbox.checked;
          window.calcRestante();
        };
        taxaCheckbox.onchange = () => { window.calcRestante(); };
      }

      window.pagamentosParciais = item.pagamentosParciais || [];
      window.calcRestante = () => {
        const finalTotal = window.calcularTotal();
        const taxaMult = (taxaCheckbox && taxaCheckbox.checked) ? 1.10 : 1.0;

        // 1. Calcular soma dos itens da mesa que ainda NÃO foram pagos (status != 'Pago')
        let pendenteItensBruto = 0;
        if (window.mesaAtual && window.mesaAtual.items) {
          window.mesaAtual.items.forEach(it => {
            if (it.status !== 'Pago') {
              pendenteItensBruto += parseFloat(String(it.total).replace(',', '.')) || 0;
            }
          });
        }
        const pendenteItensComTaxa = pendenteItensBruto * taxaMult + window.servicoAdicional - window.descontoAdicional;

        // 2. Pagamentos parciais avulsos (Pgto Parcial)
        const generalPartialPago = (window.pagamentosParciais || [])
          .filter(p => !p.comanda)
          .reduce((acc, curr) => acc + curr.valor, 0);

        // 3. Saldo pendente real a pagar
        const falta = Math.max(0, pendenteItensComTaxa - generalPartialPago);
        const totalEfetivoPago = Math.max(0, finalTotal - falta);

        const oldFalta = window.mesaFaltaPagar || 0;
        if (Math.abs((window.checkoutModalCents || 0) - Math.round(oldFalta * 100)) <= 1) {
          window.checkoutModalCents = Math.round(falta * 100);
          window._checkoutAutoFilled = true;
          const formatted = `R$ ${falta.toFixed(2).replace('.', ',')}`;
          const inputValor = document.getElementById('checkout-modal-valor');
          const visor = document.getElementById('checkout-modal-touch-visor');
          if (inputValor) inputValor.value = formatted;
          if (visor) visor.innerText = formatted;
        }

        // Salvar nas variáveis globais para validações
        window.mesaFaltaPagar = falta;
        window.mesaTotalComTaxa = finalTotal;

        // Calcular troco simulado para pagamento em Dinheiro apenas se houver saldo restante
        const inputValor = document.getElementById('checkout-modal-valor');
        const selectMetodo = document.getElementById('checkout-modal-metodo');
        let valorDigitado = 0;
        if (inputValor) {
          let clean = inputValor.value.trim().replace('R$', '').replace(/\s/g, '');
          if (clean.includes(',') || clean.includes('.')) {
            if (clean.indexOf('.') < clean.indexOf(',')) {
              clean = clean.replace(/\./g, '').replace(',', '.');
            } else {
              clean = clean.replace(/,/g, '');
            }
          } else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
          }
          const parsed = parseFloat(clean);
          if (!isNaN(parsed) && parsed > 0) valorDigitado = parsed;
        }
        if (window.checkoutModalTouchModeActive) {
          valorDigitado = (window.checkoutModalCents || 0) / 100;
        }
        const metodo = selectMetodo ? selectMetodo.value : 'Dinheiro';
        let trocoSimulado = 0;
        if (falta > 0.01 && metodo === 'Dinheiro' && valorDigitado > falta) {
          trocoSimulado = valorDigitado - falta;
        }

        // Se a conta já estiver 100% paga, zerar o visor de pagamento
        if (falta <= 0.01 && valorDigitado > 0 && !window.checkoutModalTouchModeActive) {
          window.checkoutModalCents = 0;
        }

        // Atualizar textos antigos (se existirem)
        const elTot = document.getElementById('total-pagar-text');
        if (elTot) elTot.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
        const elPago = document.getElementById('total-pago-text');
        if (elPago) elPago.innerText = `R$ ${totalEfetivoPago.toFixed(2).replace('.', ',')}`;
        const elFalta = document.getElementById('falta-pagar-text');
        if (elFalta) elFalta.innerText = `R$ ${falta > 0 ? falta.toFixed(2).replace('.', ',') : '0,00'}`;

        const acoesTotal = document.getElementById('acoes-info-total');
        if (acoesTotal) acoesTotal.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
        const acoesFalta = document.getElementById('acoes-info-falta');
        if (acoesFalta) acoesFalta.innerText = `Falta: R$ ${falta > 0 ? falta.toFixed(2).replace('.', ',') : '0,00'}`;

        // Atualizar textos do Modal Novo
        const subtotal = window.mesaAtual.totalBruto || window.mesaAtual.total || 0;
        const desc = window.descontoAdicional || 0;
        const valorServicos = (taxaCheckbox && taxaCheckbox.checked) ? Math.max(0, subtotal - desc) * 0.10 : 0;

        const modSubtotal = document.getElementById('checkout-modal-subtotal');
        if (modSubtotal) modSubtotal.innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        const modDesc = document.getElementById('checkout-modal-descontos');
        if (modDesc) modDesc.innerText = `R$ ${desc.toFixed(2).replace('.', ',')}`;
        const modTaxasVal = document.getElementById('checkout-modal-taxas-val');
        if (modTaxasVal) modTaxasVal.innerText = `R$ ${valorServicos.toFixed(2).replace('.', ',')}`;

        const modTotal = document.getElementById('checkout-modal-total-pagar');
        if (modTotal) modTotal.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
        const modPago = document.getElementById('checkout-modal-pago');
        if (modPago) modPago.innerText = `R$ ${totalEfetivoPago.toFixed(2).replace('.', ',')}`;

        const modRest = document.getElementById('checkout-modal-restante');
        const modRestLabel = document.getElementById('checkout-modal-restante-label');
        const statusBox = document.getElementById('checkout-modal-status-box');
        if (modRestLabel && modRest) {
          if (falta > 0.01 && trocoSimulado > 0) {
            modRestLabel.innerText = 'Troco Previsto:';
            modRest.style.color = '#27ae60';
            modRest.innerText = `R$ ${trocoSimulado.toFixed(2).replace('.', ',')}`;
            if (statusBox) {
              statusBox.style.background = '#f0fff4';
              statusBox.style.borderColor = '#c6f6d5';
            }
          } else if (falta <= 0.01) {
            const trocoEfetivo = totalEfetivoPago > (finalTotal + 0.01) ? (totalEfetivoPago - finalTotal) : 0;
            if (trocoEfetivo > 0.01) {
              modRestLabel.innerText = 'Troco Devolvido:';
              modRest.style.color = '#27ae60';
              modRest.innerText = `R$ ${trocoEfetivo.toFixed(2).replace('.', ',')}`;
            } else {
              modRestLabel.innerText = 'Faltando:';
              modRest.style.color = '#27ae60';
              modRest.innerText = 'R$ 0,00';
            }
            if (statusBox) {
              statusBox.style.background = '#f0fff4';
              statusBox.style.borderColor = '#c6f6d5';
            }
          } else {
            modRestLabel.innerText = 'Faltando:';
            modRest.style.color = '#e53e3e';
            modRest.innerText = `R$ ${falta.toFixed(2).replace('.', ',')}`;
            if (statusBox) {
              statusBox.style.background = '#fff5f5';
              statusBox.style.borderColor = '#fed7d7';
            }
          }
        }


        // Renderizar itens no tbody do modal de checkout
        let itemsToRender = window.mesaAtual.items || [];
        if (window.agruparItens) {
          const grouped = {};
          itemsToRender.forEach(order => {
            const key = order.productName;
            if (!grouped[key]) grouped[key] = { ...order, quantity: 0, totalVal: 0 };
            const totalVal = parseFloat(String(order.total).replace(',', '.'));
            grouped[key].quantity += (order.quantity || 1);
            grouped[key].totalVal += totalVal;
          });
          itemsToRender = Object.values(grouped).map(g => ({ ...g, total: g.totalVal }));
        }

        let modalItemsHTML = '';
        itemsToRender.forEach((order) => {
          const totalVal = parseFloat(String(order.total).replace(',', '.'));
          const isPaid = order.status === 'Pago';
          modalItemsHTML += `
                 <tr style="${isPaid ? 'opacity: 0.5; background: var(--bg-secondary);' : ''}">
                   <td style="padding: 8px 4px; ${isPaid ? 'text-decoration: line-through;' : ''}">${order.productEmoji || ''} ${order.productName || 'Produto'} ${isPaid ? '<strong style="color: #3ab55b; margin-left: 8px;">(PAGO)</strong>' : ''}</td>
                   <td style="padding: 8px 4px; text-align: center;">${order.quantity || 1}</td>
                   <td style="padding: 8px 4px; text-align: right; font-weight: 600; color: #3ab55b;">R$ ${totalVal.toFixed(2).replace('.', ',')}</td>
                 </tr>
               `;
        });
        const tbodyModal = document.getElementById('checkout-modal-items-tbody');
        if (tbodyModal) tbodyModal.innerHTML = modalItemsHTML;

        // Atualizar lista de pagamentos no Modal (e no antigo se precisar)
        const htmlLista = window.pagamentosParciais.map((p, idx) => {
          const targetId = p.id !== undefined ? p.id : idx;
          return `
                  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
                    <span style="font-size: 16px;">${p.metodo}</span>
                    <span style="font-size: 18px; font-weight: bold;">R$ ${p.valor.toFixed(2).replace('.', ',')} 
                      <i class="ph ph-trash" title="Estornar / Remover este pagamento" style="color:#e74c3c; cursor:pointer; margin-left: 12px;" onclick="window.removerPagamento(${targetId})"></i>
                    </span>
                  </div>
                `;
        }).join('');

        const listaElModal = document.getElementById('checkout-modal-lista-pagamentos');
        if (listaElModal) listaElModal.innerHTML = htmlLista;
        const listaElAntiga = document.getElementById('lista-pagamentos-parciais');
        if (listaElAntiga) listaElAntiga.innerHTML = htmlLista;

        // Habilitar ou desabilitar botões de envio baseados no saldo devedor
        const btnFinalizar = document.getElementById('btn-finalizar-venda');
        const submitBtnModal = document.getElementById('checkout-modal-submit-btn');
        const isQuted = falta <= 0.01 && (window.pagamentosParciais.length > 0 || finalTotal === 0);

        if (btnFinalizar) {
          btnFinalizar.style.opacity = '1';
          btnFinalizar.style.pointerEvents = 'auto';
          btnFinalizar.onclick = () => {
            window.abrirCheckoutModal();
          };
          btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 20px;"></i> Finalizar Venda';
        }

        if (submitBtnModal) {
          if (isQuted) {
            submitBtnModal.style.opacity = '1';
            submitBtnModal.style.pointerEvents = 'auto';
          } else {
            submitBtnModal.style.opacity = '0.5';
            submitBtnModal.style.pointerEvents = 'none';
          }
        }

        return finalTotal;
      };

      window.calcRestante();
      const tbodyModal_check = document.getElementById('checkout-modal-items-tbody');
      if (tbodyModal_check && window.mesaAtual && window.calcRestante) {
        window.calcRestante();
      }
    });
  });

  allRenderedItems.forEach(item => {
    if (window.mesaAtual && (item.mesaName || item.nome) === (window.mesaAtual.mesaName || window.mesaAtual.nome)) {
      const card = Array.from(document.querySelectorAll('.mesa-item')).find(c => c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.mesaName || c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.nome);
      if (card) card.click();
    }
  });

  // Clique nos cards de comanda dentro das mesas (delegação no grid -> funciona mesmo após re-render)
  if (grid) {
    grid.onclick = (e) => {
      const comandaCard = e.target.closest('.comanda-inside-card');
      if (comandaCard && !comandaCard.classList.contains('nova-comanda-card')) {
        const mesaName = comandaCard.getAttribute('data-mesa');
        const comanda = comandaCard.getAttribute('data-comanda');
        if (typeof window.abrirComandaNaMesa === 'function') window.abrirComandaNaMesa(mesaName, comanda);
        return;
      }
      if (e.target.closest('.nova-comanda-card')) {
        if (typeof window.abrirModalNovaComanda === 'function') window.abrirModalNovaComanda();
      }
    };
  }

  if (typeof window.updateTimers === 'function') window.updateTimers();
}

window.removerItemPedido = (id) => {
  window.solicitarAutorizacaoAdmin('Excluir Item', 'Informe a senha de administrador para confirmar a exclusão.', (senha, motivo) => {
    socket.emit('remover_pedido_item', { id, senha, userName: window.loggedInUser || 'Caixa' });
  });
};

window.removerPagamento = async (paymentId) => {
  if (paymentId === undefined || paymentId === null || paymentId === '') return;

  const pObj = (window.pagamentosParciais || []).find(p => p.id === paymentId || p === paymentId);
  const targetId = pObj ? pObj.id : paymentId;
  const infoTxt = pObj ? `R$ ${pObj.valor.toFixed(2).replace('.', ',')} (${pObj.metodo})` : 'este pagamento';
  const mesaName = window.mesaAtual ? (window.mesaAtual.nome || window.mesaAtual.mesaName) : 'Mesa';

  const executeEstorno = (motivo) => {
    window.pagamentosParciais = (window.pagamentosParciais || []).filter(p => (p.id !== undefined ? p.id !== targetId : p !== targetId));
    if (typeof window.calcRestante === 'function') window.calcRestante();

    socket.emit('remover_pedido_item', targetId);
    socket.emit('remover_item_pedido', {
      orderId: targetId,
      mesaName: mesaName,
      usuario: window.loggedInUser || 'Caixa',
      motivo: motivo || 'Estorno manual'
    });

    if (typeof window.registrarLogAuditoria === 'function') {
      window.registrarLogAuditoria('CANCELAMENTO_PAGAMENTO_PARCIAL', `Estornado pagamento de ${infoTxt} da ${mesaName}`, motivo || 'Estorno manual', 'ALTO');
    }
  };

  if (typeof window.solicitarAutorizacaoAdmin === 'function') {
    window.solicitarAutorizacaoAdmin(
      'Estornar / Cancelar Pagamento',
      `Remover o pagamento de ${infoTxt} da ${mesaName} exige senha de gerente e justificativa.`,
      (senha, motivo) => {
        window.pagamentosParciais = (window.pagamentosParciais || []).filter(p => (p.id !== undefined ? p.id !== targetId : p !== targetId));
        if (typeof window.calcRestante === 'function') window.calcRestante();

        socket.emit('remover_pedido_item', { id: targetId, senha, userName: window.loggedInUser || 'Caixa' });
        socket.emit('remover_item_pedido', {
          orderId: targetId,
          mesaName: mesaName,
          usuario: window.loggedInUser || 'Caixa',
          motivo: motivo || 'Estorno manual',
          senha
        });

        if (typeof window.registrarLogAuditoria === 'function') {
          window.registrarLogAuditoria('CANCELAMENTO_PAGAMENTO_PARCIAL', `Estornado pagamento de ${infoTxt} da ${mesaName}`, motivo || 'Estorno manual', 'ALTO');
        }
      }
    );
  } else {
    if (await chefConfirm('Estornar item', `Deseja estornar ${infoTxt}?`, { danger: true, okText: 'Estornar' })) {
      executeEstorno('Confirmação simples');
    }
  }
};

setInterval(() => {
  const now = new Date();
  const clk = document.getElementById('status-clock');
  const dt = document.getElementById('status-date');
  if (clk) clk.innerText = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dt) dt.innerText = now.toLocaleDateString('pt-BR');
}, 1000);

window.updateTimers = () => {
  document.querySelectorAll('.time-badge[data-created]').forEach(el => {
    const createdStr = el.getAttribute('data-created');
    if (!createdStr || createdStr === 'undefined') return;
    const createdAt = new Date(createdStr);
    const diffMins = Math.floor((new Date() - createdAt) / 60000);
    el.innerHTML = `<i class="ph ph-clock"></i> ${diffMins} min`;
    if (diffMins >= 60) {
      el.style.color = '#eb5757';
      el.style.backgroundColor = '#fce8e8';
    }
  });
};
setInterval(window.updateTimers, 30000);

function updateSummaryValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.innerText = `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
}

// WebSocket Events
socket.on('initial_data', (data) => {
  socket.emit('get_mesas'); // Ensure we fetch mesas
  ordersData = data;
  renderOrders();
});

socket.on('pedidos_atualizados', (pedidos) => {
  ordersData = pedidos;
  renderOrders();
});

socket.on('pedido_adicionado', (novoPedido) => {
  const exists = ordersData.some(o => o.id === novoPedido.id);
  if (!exists) {
    ordersData.push(novoPedido);
    renderOrders();
  }
});

socket.on('status_atualizado', (pedidoAtualizado) => {
  const index = ordersData.findIndex(o => o.id === pedidoAtualizado.id);
  if (index !== -1) {
    ordersData[index] = pedidoAtualizado;
    renderOrders();
  }
});

socket.on('mesa_finalizada', ({ mesaName }) => {
  // Remove items that were closed
  ordersData = ordersData.filter(o => o.localName !== mesaName && o.mesa_grupo !== mesaName);
  renderOrders();

  // Close the new checkout modal if it's currently open for this table
  if (window.mesaAtual && (window.mesaAtual.nome || window.mesaAtual.mesaName) === mesaName) {
    window.fecharCheckoutModal();
    window.mesaAtual = null;
    const acoesSummary = document.getElementById('mobile-acoes-summary');
    if (acoesSummary) acoesSummary.style.display = 'none';
  }

  // Sucesso Interativo e Dinâmico
  const btnFinalizarModal = document.getElementById('btn-finalizar-venda');
  const newBtnSubmit = document.getElementById('checkout-modal-submit-btn');
  const isProcessing = (btnFinalizarModal && btnFinalizarModal.innerHTML.includes('Processando')) ||
    (newBtnSubmit && newBtnSubmit.innerHTML.includes('Processando'));

  if (isProcessing) {
    // Efeito de Confete
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#3ab55b', '#ffffff', '#2D9CDB']
      });
    }

    // Tocar som de sucesso (Cha-Ching)
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) { }

    // Atualiza visual do botão para sucesso
    if (btnFinalizarModal) {
      btnFinalizarModal.style.background = '#27ae60';
      btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 32px;"></i> VENDA CONCLUÍDA!';
    }

    if (newBtnSubmit) {
      newBtnSubmit.style.background = '#27ae60';
      newBtnSubmit.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONTA FECHADA COM SUCESSO!';
    }

    // Fecha o modal automaticamente após 2.5 segundos
    setTimeout(() => {
      const modalPagamento = document.getElementById('pagamento-overlay');
      if (modalPagamento) modalPagamento.style.display = 'none';

      // Reseta os botões para a próxima venda
      if (btnFinalizarModal) {
        btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 28px;"></i> FINALIZAR VENDA';
        btnFinalizarModal.style.background = '#3ab55b';
      }
      if (newBtnSubmit) {
        newBtnSubmit.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONCLUIR E FECHAR MESA';
        newBtnSubmit.style.background = '#3ab55b';
      }
    }, 2500);
  }

  const rightPanel = document.querySelector('.right-panel');
  if (rightPanel) {
    const itemsContainer = document.getElementById('panel-items');
    if (itemsContainer) itemsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Mesa Paga / Finalizada</div>';

    const panelHeader = document.querySelector('.panel-header h2');
    if (panelHeader) panelHeader.innerText = 'Mesa Paga';

    const paymentVal = document.querySelector('.payment-val');
    if (paymentVal) paymentVal.innerText = 'R$ 0,00';

    const btnFinalizar = document.getElementById('btn-finalizar');
    if (btnFinalizar) {
      btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 20px;"></i> Finalizada';
      btnFinalizar.disabled = true;
    }
  }
});

// Caixa Logic
socket.on('erro_caixa', (msg) => {
  alert(msg);
  const btnFinalizar = document.getElementById('btn-finalizar-venda');
  if (btnFinalizar) btnFinalizar.innerHTML = 'FINALIZAR VENDA';
  const submitBtnModal = document.getElementById('checkout-modal-submit-btn');
  if (submitBtnModal) {
    submitBtnModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 24px;"></i> CONCLUIR E FECHAR MESA';
    submitBtnModal.style.opacity = '1';
    submitBtnModal.style.pointerEvents = 'auto';
  }
});

socket.on('atualizacao_caixa', () => {
  socket.emit('get_estado_caixa');
  socket.emit('get_financeiro');
  socket.emit('get_relatorios');
});

socket.on('caixa_aberto_sucesso', () => {
  const overlay = document.getElementById('caixa-overlay');
  const span = document.getElementById('status-caixa-name');
  if (overlay) overlay.style.display = 'none';
  if (span) span.innerText = 'Caixa Aberto';
  socket.emit('get_mesas');
});

socket.on('estado_caixa', (turno) => {
  const overlay = document.getElementById('caixa-overlay');
  const span = document.getElementById('status-caixa-name');
  if (turno && (turno.status === 'Aberto' || turno.id || !turno.data_fechamento)) {
    if (overlay) overlay.style.display = 'none';
    if (span) span.innerText = 'Caixa Aberto';
    console.log("Caixa está aberto:", turno);
  } else {
    if (overlay) overlay.style.display = 'flex';
    if (span) span.innerText = 'Caixa Fechado';
    console.log("Caixa está fechado.");
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Inicialização essencial de dados (evita chamadas duplicadas ao backend)
  socket.emit('get_mesas');
  socket.emit('get_estado_caixa');
  socket.emit('get_produtos');
  socket.emit('get_funcionarios');
  socket.emit('get_promocoes');

  const btnAbrir = document.getElementById('btn-abrir-caixa');
  if (btnAbrir) {
    btnAbrir.onclick = () => {
      if (typeof window.abrirCaixaClick === 'function') {
        window.abrirCaixaClick();
      } else {
        let valInput = document.getElementById('fundo-troco') ? document.getElementById('fundo-troco').value : '0';
        const fundo = parseFloat(String(valInput || '0').replace(',', '.'));
        socket.emit('abrir_caixa', { fundo_troco: isNaN(fundo) ? 0 : fundo, operador: window.crmPerfil ? window.crmPerfil.nome : 'Caixa' });
      }
    };
  }

  const btnNovo = document.getElementById('btn-adicionar-produtos');
  const pdvOverlay = document.getElementById('pdv-overlay');

  window.pdvCart = [];
  window.pdvCurrentCategory = 'Todas';
  window.pdvConfigs = {};

  window.selectedOnboardingModality = null;

  const MODALITY_LABELS = {
    'a_la_carte': { name: 'À La Carte', icon: 'ph-bowl-food' },
    'pizzaria': { name: 'Pizzaria', icon: 'ph-pizza' },
    'a_kilo': { name: 'Restaurante À Kilo', icon: 'ph-scales' },
    'buffet': { name: 'Buffet', icon: 'ph-cooking-pot' },
    'lanchonete': { name: 'Lanchonete', icon: 'ph-hamburger' },
    'bar': { name: 'Bar / Pub', icon: 'ph-beer-bottle' },
    'balada': { name: 'Balada / Club', icon: 'ph-music-notes' },
    'quiosque': { name: 'Quiosque', icon: 'ph-storefront' },
    'eventos': { name: 'Eventos / Festas', icon: 'ph-ticket' }
  };

  window.onModalityLoaded = function(modality) {
    const badgeText = document.getElementById('modality-badge-text');
    const badge = document.getElementById('modality-indicator-badge');
    if (badgeText && badge) {
      const info = MODALITY_LABELS[modality] || { name: 'Restaurante', icon: 'ph-storefront' };
      badgeText.innerText = info.name;
      const iconEl = badge.querySelector('i');
      if (iconEl) {
        iconEl.className = 'ph-bold ' + info.icon;
      }
    }
  };
  window.selectOnboardingModality = function(el) {
    document.querySelectorAll('.onboarding-item-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    window.selectedOnboardingModality = el.getAttribute('data-modalidade');
    document.getElementById('btn-onboarding-confirm').removeAttribute('disabled');
  };

  window.confirmOnboardingModality = function() {
    if (!window.selectedOnboardingModality) return;
    const btn = document.getElementById('btn-onboarding-confirm');
    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.innerHTML = '<i class="ph-bold ph-spinner-gap animate-spin"></i> Salvando...';
    }
    
    if (typeof socket !== 'undefined' && socket) {
      socket.emit('save_restaurante_config', {
        'rest_modalidade': window.selectedOnboardingModality
      });
    }

    fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof authHeaders === 'function' ? authHeaders() : {})
      },
      body: JSON.stringify({
        'rest_modalidade': window.selectedOnboardingModality
      })
    }).then(r => r.json()).then(() => {
      const modal = document.getElementById('onboarding-modal');
      if (modal) modal.classList.add('hidden');
      if (window.onModalityLoaded) window.onModalityLoaded(window.selectedOnboardingModality);
      /* Abre o wizard de configuração após selecionar modalidade */
      setTimeout(() => window.showWizard(), 400);
    }).catch(() => {
      const modal = document.getElementById('onboarding-modal');
      if (modal) modal.classList.add('hidden');
      setTimeout(() => window.showWizard(), 400);
    });
  };

  function fetchPdvConfigs() {
    fetch('/api/config', { headers: authHeaders() })
      .then(r => r.json())
      .then(conf => {
        window.pdvConfigs = conf;
        const modal = document.getElementById('onboarding-modal');
        if (modal) {
          if (!conf.rest_modalidade) {
            modal.classList.remove('hidden');
          } else {
            modal.classList.add('hidden');
            if (window.onModalityLoaded) window.onModalityLoaded(conf.rest_modalidade);
            /* Mostra wizard na primeira vez */
            if (!conf.onboarding_completo) {
              setTimeout(() => window.showWizard(), 500);
            }
          }
        }
        if (typeof window.renderPdvMenu === 'function') window.renderPdvMenu();
      })
      .catch(e => console.error("Erro fetch configs:", e));
  }
  fetchPdvConfigs();
  socket.on('configuracoes_atualizadas', fetchPdvConfigs);

  /* ═══════════════════════════════════════════════════════════════ */
  /* ONBOARDING WIZARD — 3 passos (Dados, Mesas, Produtos)         */
  /* ═══════════════════════════════════════════════════════════════ */
  let _wizardStep = 1;
  const _wizardTotal = 3;
  let _wizardProdutos = []; /* [{categoria, nome, preco}] */
  let _wizardActive = false; /* evita re-exibição pelo fetchPdvConfigs */

  window.showWizard = function() {
    if (_wizardActive) return; /* já aberto, ignora */
    const el = document.getElementById('onboarding-wizard');
    if (!el) return;
    _wizardActive = true;
    el.classList.remove('hidden');
    _wizardStep = 1;
    _wizardProdutos = [];
    _renderWizardStep();
    _renderWizProdutos();
  };

  function _renderWizardStep() {
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById('wizard-panel-' + i);
      if (panel) panel.style.display = i === _wizardStep ? 'block' : 'none';
    }
    const bar = document.getElementById('wizard-progress-bar');
    const num = document.getElementById('wizard-step-num');
    const title = document.getElementById('wizard-step-title');
    const nav = document.getElementById('wizard-nav');
    const btnBack = document.getElementById('wizard-btn-back');
    const btnNext = document.getElementById('wizard-btn-next');

    if (bar) bar.style.width = (_wizardStep <= 3 ? (_wizardStep / _wizardTotal * 100) : 100) + '%';
    if (num) num.textContent = _wizardStep <= 3 ? _wizardStep : 3;
    if (nav) nav.style.display = _wizardStep === 4 ? 'none' : 'flex';
    if (btnBack) btnBack.style.display = _wizardStep > 1 ? 'inline-flex' : 'none';

    const titles = { 1: 'Dados do Restaurante', 2: 'Configurar Mesas', 3: 'Primeiros Produtos', 4: 'Tudo Pronto!' };
    if (title) title.textContent = titles[_wizardStep] || '';
    if (btnNext) {
      if (_wizardStep === 3) {
        btnNext.innerHTML = 'Finalizar <i class="ph-bold ph-check"></i>';
      } else {
        btnNext.innerHTML = 'Próximo <i class="ph-bold ph-arrow-right"></i>';
      }
    }

    /* Pré-visualiza mesas no passo 2 */
    if (_wizardStep === 2) _updateMesasPreview();
  }

  function _updateMesasPreview() {
    const preview = document.getElementById('wiz-mesas-preview');
    const qtd = parseInt(document.getElementById('wiz-qtd-mesas')?.value) || 0;
    const addDelivery = document.getElementById('wiz-add-delivery')?.checked;
    const addBalcao = document.getElementById('wiz-add-balcao')?.checked;
    if (!preview) return;
    let items = [];
    for (let i = 1; i <= qtd; i++) items.push('Mesa ' + i);
    if (addDelivery) items.push('Delivery');
    if (addBalcao) items.push('Balcão');
    preview.innerHTML = items.map(n =>
      '<span style="background:rgba(252,75,21,0.1); border:1px solid rgba(252,75,21,0.2); color:#f8fafc; padding:4px 10px; border-radius:8px; font-size:12px; white-space:nowrap;">' + n + '</span>'
    ).join('');
  }

  function _renderWizProdutos() {
    const list = document.getElementById('wiz-produtos-list');
    if (!list) return;
    if (_wizardProdutos.length === 0) {
      /* Produtos sugeridos por modalidade */
      const mod = window.pdvConfigs?.rest_modalidade || 'a_la_carte';
      const sugestoes = {
        'a_la_carte': [
          { categoria: 'Pratos', nome: 'Filé com Fritas', preco: 42.90, emoji: '🍽️' },
          { categoria: 'Bebidas', nome: 'Suco Natural', preco: 8.90, emoji: '🧃' },
          { categoria: 'Sobremesas', nome: 'Pudim', preco: 12.90, emoji: '🍮' }
        ],
        'pizzaria': [
          { categoria: 'Pizzas', nome: 'Margherita', preco: 49.90, emoji: '🍕' },
          { categoria: 'Pizzas', nome: 'Calabresa', preco: 44.90, emoji: '🍕' },
          { categoria: 'Bebidas', nome: 'Guaraná', preco: 7.90, emoji: '🥤' }
        ],
        'lanchonete': [
          { categoria: 'Lanches', nome: 'X-Burger', preco: 24.90, emoji: '🍔' },
          { categoria: 'Lanches', nome: 'Hot Dog', preco: 18.90, emoji: '🌭' },
          { categoria: 'Bebidas', nome: 'Coca-Cola Lata', preco: 8.90, emoji: '🥤' }
        ],
        'bar': [
          { categoria: 'Drinks', nome: 'Caipirinha', preco: 19.90, emoji: '🍹' },
          { categoria: 'Petiscos', nome: 'Bolinho de Bacalhau', preco: 28.90, emoji: '🧆' },
          { categoria: 'Bebidas', nome: 'Chopp 500ml', preco: 14.90, emoji: '🍺' }
        ],
        'a_kilo': [
          { categoria: 'Pratos', nome: 'Arroz com Feijão (100g)', preco: 8.90, emoji: '🍚' },
          { categoria: 'Saladas', nome: 'Salada Caesar (100g)', preco: 12.90, emoji: '🥗' },
          { categoria: 'Carnes', nome: 'Picanha (100g)', preco: 22.90, emoji: '🥩' }
        ],
        'buffet': [
          { categoria: 'Rodízio', nome: 'Rodízio Almoço', preco: 59.90, emoji: '🍽️' },
          { categoria: 'Bebidas', nome: 'Suco ilimitado', preco: 15.90, emoji: '🧃' }
        ]
      };
      _wizardProdutos = (sugestoes[mod] || sugestoes['a_la_carte']).map(p => ({ ...p }));
    }
    _refreshProdutosList();
  }

  function _refreshProdutosList() {
    const list = document.getElementById('wiz-produtos-list');
    if (!list) return;
    list.innerHTML = _wizardProdutos.map((p, i) => `
      <div style="display:flex; gap:8px; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:8px 10px;">
        <span style="font-size:20px; flex-shrink:0;">${p.emoji}</span>
        <input type="text" value="${p.categoria}" placeholder="Categoria" onchange="_wizardProdutos[${i}].categoria=this.value" style="flex:1; min-width:0; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#f8fafc; font-size:13px; outline:none; box-sizing:border-box;">
        <input type="text" value="${p.nome}" placeholder="Nome" onchange="_wizardProdutos[${i}].nome=this.value" style="flex:2; min-width:0; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#f8fafc; font-size:13px; outline:none; box-sizing:border-box;">
        <input type="number" value="${p.preco}" placeholder="R$" step="0.01" min="0" onchange="_wizardProdutos[${i}].preco=parseFloat(this.value)||0" style="width:80px; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#f8fafc; font-size:13px; outline:none; box-sizing:border-box;">
        <button onclick="_wizardProdutos.splice(${i},1); _refreshProdutosList();" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px; flex-shrink:0;" title="Remover"><i class="ph ph-x-circle" style="font-size:18px;"></i></button>
      </div>
    `).join('');
  }

  window.wizardAddProdutoRow = function() {
    _wizardProdutos.push({ categoria: '', nome: '', preco: 0, emoji: '🍽️' });
    _refreshProdutosList();
    /* Foca no último input de categoria */
    const list = document.getElementById('wiz-produtos-list');
    if (list) {
      const lastInputs = list.querySelectorAll('div:last-child input[type="text"]');
      if (lastInputs[0]) lastInputs[0].focus();
    }
  };

  window.wizardNext = function() {
    if (_wizardStep === 1) {
      /* Valida dados do restaurante */
      const nome = document.getElementById('wiz-rest-nome')?.value.trim();
      if (!nome) {
        window.showToast && window.showToast('Informe o nome do restaurante.', 'warning');
        document.getElementById('wiz-rest-nome')?.focus();
        return;
      }
      /* Salva dados do restaurante */
      _saveWizRestaurantData();
      _wizardStep = 2;
      _renderWizardStep();
    } else if (_wizardStep === 2) {
      /* Salva mesas */
      _saveWizMesas();
      _wizardStep = 3;
      _renderWizardStep();
    } else if (_wizardStep === 3) {
      /* Salva produtos e mostra tela de conclusão */
      _saveWizProdutos();
      _wizardStep = 4;
      _renderWizardStep();
    }
  };

  window.wizardPrev = function() {
    if (_wizardStep > 1) {
      _wizardStep--;
      _renderWizardStep();
    }
  };

  window.wizardSkip = function() {
    if (!confirm('Pular a configuração? Você poderá configurar depois em Configurações.')) return;
    _finishWizard();
  };

  window.wizardFinish = function() {
    _finishWizard();
  };

  function _saveWizRestaurantData() {
    const nome = document.getElementById('wiz-rest-nome')?.value.trim();
    const tel = document.getElementById('wiz-rest-tel')?.value.trim();
    const endereco = document.getElementById('wiz-rest-endereco')?.value.trim();
    const payload = {};
    if (nome) payload.nome_restaurante = nome;
    if (tel) payload.telefone_restaurante = tel;
    if (endereco) payload.endereco_restaurante = endereco;
    if (Object.keys(payload).length > 0) {
      socket.emit('save_restaurante_config', payload);
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(typeof authHeaders === 'function' ? authHeaders() : {}) },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }
  }

  function _saveWizMesas() {
    const qtd = parseInt(document.getElementById('wiz-qtd-mesas')?.value) || 0;
    const addDelivery = document.getElementById('wiz-add-delivery')?.checked;
    const addBalcao = document.getElementById('wiz-add-balcao')?.checked;
    for (let i = 1; i <= qtd; i++) {
      socket.emit('add_mesa', 'Mesa ' + i);
    }
    if (addDelivery) socket.emit('add_mesa', 'Delivery');
    if (addBalcao) socket.emit('add_mesa', 'Balcão');
  }

  function _saveWizProdutos() {
    _wizardProdutos.forEach(p => {
      if (p.nome && p.nome.trim()) {
        socket.emit('add_produto', {
          categoria: p.categoria || 'Geral',
          nome: p.nome.trim(),
          preco: p.preco || 0,
          emoji: p.emoji || '🍽️',
          hasAddons: false,
          setor: 'Cozinha 1',
          status_inicial: 'Em espera',
          status: 'ativo',
          categoria_fiscal: 'Alimentacao',
          descricao: '',
          codigo_barras: null,
          visibilidade: 'todos'
        });
      }
    });
  }

  function _finishWizard() {
    _wizardActive = false;
    /* Salva flag de onboarding completo */
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(typeof authHeaders === 'function' ? authHeaders() : {}) },
      body: JSON.stringify({ onboarding_completo: 'true' })
    }).catch(() => {});
    socket.emit('save_restaurante_config', { onboarding_completo: 'true' });

    const el = document.getElementById('onboarding-wizard');
    if (el) el.classList.add('hidden');
    window.showToast && window.showToast('Configuração inicial concluída! 🎉', 'success');
  }

  /* Atualiza preview de mesas ao digitar */
  document.addEventListener('input', function(e) {
    if (e.target.id === 'wiz-qtd-mesas' || e.target.id === 'wiz-add-delivery' || e.target.id === 'wiz-add-balcao') {
      _updateMesasPreview();
    }
  });
  document.addEventListener('change', function(e) {
    if (e.target.id === 'wiz-add-delivery' || e.target.id === 'wiz-add-balcao') {
      _updateMesasPreview();
    }
  });

  // --- MERCADO PAGO SOCKET STATUS ---
  socket.on('mp_status_pagamento', (data) => {
    const overlay = document.getElementById('modal-mp-pagamento');
    const statusEl = document.getElementById('mp-payment-status');
    const titleEl = document.getElementById('mp-payment-title');
    const spinner = document.getElementById('mp-payment-spinner');
    const successIcon = document.getElementById('mp-payment-success-icon');

    if (!overlay) return;

    if (data.status === 'processando') {
      if (titleEl) titleEl.innerText = 'Aguardando Cartão';
      if (statusEl) statusEl.innerText = data.msg;
    } else if (data.status === 'aprovado') {
      if (titleEl) titleEl.innerText = 'Pagamento Aprovado';
      if (statusEl) statusEl.innerText = 'Transação autorizada com sucesso!';
      if (spinner) spinner.style.display = 'none';
      if (successIcon) successIcon.style.display = 'flex';

      setTimeout(() => {
        overlay.style.display = 'none';
        if (window.pendingMpPayment) {
          const { valor, metodo } = window.pendingMpPayment;
          const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
          const modalTaxaCheckbox = document.getElementById('checkout-modal-taxa');
          const taxaCheckbox = document.getElementById('taxa-servico');
          const isTaxaChecked = modalTaxaCheckbox ? modalTaxaCheckbox.checked : (taxaCheckbox ? taxaCheckbox.checked : true);

          // Register partial payment - only via pagamento_parcial_valor to avoid duplicate in movimentacoes
          socket.emit('pagamento_parcial_valor', {
            mesaName: mesaName,
            valor: valor,
            metodo: metodo,
            comTaxa: isTaxaChecked,
            desconto: window.descontoAdicional || 0,
            userName: window.loggedInUser || 'Caixa'
          });

          // Reset inputs
          const inputValor = document.getElementById('checkout-modal-valor');
          if (inputValor) inputValor.value = '';
          window.checkoutModalCents = 0;
          if (typeof window.checkoutModalUpdateTouchVisor === 'function') {
            window.checkoutModalUpdateTouchVisor();
          }

          window.pendingMpPayment = null;
        }
      }, 1500);

    } else if (data.status === 'failed' || data.status === 'cancelado') {
      overlay.style.display = 'none';
      alert(`❌ Falha no pagamento: ${data.msg || 'Transação cancelada ou recusada.'}`);
      window.pendingMpPayment = null;
    }
  });

  window.pdvParaViagem = false;

  window.togglePdvParaViagem = function() {
    window.pdvParaViagem = !window.pdvParaViagem;
    const btn = document.getElementById('btn-toggle-pdv-viagem');
    const txt = document.getElementById('btn-toggle-pdv-viagem-text');
    if (window.pdvParaViagem) {
      if (btn) {
        btn.style.background = '#fffbeb';
        btn.style.borderColor = '#f59e0b';
        btn.style.color = '#d97706';
      }
      if (txt) txt.innerText = '🛍️ Para Viagem: SIM';
    } else {
      if (btn) {
        btn.style.background = '#f1f5f9';
        btn.style.borderColor = '#cbd5e1';
        btn.style.color = '#475569';
      }
      if (txt) txt.innerText = 'Para Viagem';
    }
  };

  window.podeEditarPrecoPdv = function() {
    const pdvCfg = window.pdvConfigs || {};
    const alterarValoresPdv = pdvCfg.feature_alterar_valores_pdv === 'true' || pdvCfg.feature_alterar_valores_pdv === true;
    if (alterarValoresPdv) return true;
    const roles = ['admin', 'administrador', 'gerente', 'dono', 'proprietario', 'adm'];
    const check = (creds) => {
      if (!creds) return false;
      const cargo = String(creds.cargo || creds.role || creds.tipo || '').toLowerCase().trim();
      if (roles.includes(cargo)) return true;
      if (creds.isAdmin || creds.isGerente || creds.isDono) return true;
      return false;
    };
    try { if (check(JSON.parse(localStorage.getItem('chef_app_creds') || '{}'))) return true; } catch (e) {}
    try { if (check(JSON.parse((localStorage.getItem('chef_session') || localStorage.getItem('chef_credentials')) || '{}'))) return true; } catch (e) {}
    return false;
  };

  window.pdvEditPriceInline = function(prodId) {
    if (!window.podeEditarPrecoPdv()) {
      alert('Apenas Administrador, Gerente ou Dono podem alterar o valor do produto.');
      return;
    }
    const prod = window.allProducts ? window.allProducts.find(p => p.id === prodId) : null;
    if (!prod) return;
    const inCart = (window.pdvCart || []).find(item => item.id === prodId);
    const currentPrice = inCart ? inCart.preco : (prod.preco || 0);

    const novoValStr = prompt(`Alterar valor de "${prod.nome}" para este pedido (R$):`, Number(currentPrice).toFixed(2));
    if (novoValStr === null) return;
    const novoVal = parseFloat(String(novoValStr).replace(',', '.'));
    if (isNaN(novoVal) || novoVal < 0) return alert('Valor inválido.');

    if (inCart) {
      inCart.preco = novoVal;
    } else {
      window.pdvCart.push({ ...prod, preco: novoVal, quantity: 1 });
    }
    window.renderPdvCart();
  };

  let pdvTouchTimer = null;

  window.pdvTouchStartCtx = function(prodId, event) {
    if (!event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    clearTimeout(pdvTouchTimer);
    pdvTouchTimer = setTimeout(() => {
      window.abrirPdvContextMenu(prodId, x, y);
    }, 450);
  };

  window.pdvTouchEndCtx = function() {
    clearTimeout(pdvTouchTimer);
  };

  window.abrirPdvContextMenu = function(prodId, posX, posY) {
    const prod = window.allProducts ? window.allProducts.find(p => p.id === prodId) : null;
    if (!prod) return;

    let menu = document.getElementById('pdv-quick-context-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'pdv-quick-context-menu';
      menu.style.cssText = 'display: none; position: fixed; z-index: 10005; background: var(--bg-card); border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.08); width: 260px; overflow: hidden; padding: 6px; user-select: none; font-family: inherit; transition: opacity 0.15s ease, transform 0.15s ease; cubic-bezier(0.16, 1, 0.3, 1);';
      document.body.appendChild(menu);
    }

    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
      menu.style.background = '#1a1f2e';
      menu.style.borderColor = 'rgba(255,255,255,0.12)';
      menu.style.color = '#f8fafc';
    } else {
      menu.style.background = '#ffffff';
      menu.style.borderColor = '#e2e8f0';
      menu.style.color = '#0f172a';
    }

    const inCart = (window.pdvCart || []).find(i => i.id === prodId);
    const totalQty = inCart ? inCart.quantity : 0;
    const canEditPrice = window.podeEditarPrecoPdv();

    const menuWidth = 260;
    const menuHeight = 360;
    let finalX = Math.min(posX, window.innerWidth - menuWidth - 12);
    let finalY = Math.min(posY, window.innerHeight - menuHeight - 12);
    finalX = Math.max(12, finalX);
    finalY = Math.max(12, finalY);

    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
    menu.style.display = 'block';

    const bgHeader = isDark ? '#252b3b' : '#f8fafc';
    const borderSub = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';

    menu.innerHTML = `
      <div style="padding: 10px 12px; background: ${bgHeader}; border-radius: 12px; border: 1px solid ${borderSub}; margin-bottom: 6px;">
        <div style="font-weight: 800; font-size: 14px; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px;">
          <span>${prod.emoji || '🍽️'}</span> <span style="overflow:hidden; text-overflow:ellipsis;">${escHtml(prod.nome)}</span>
        </div>
        <div style="font-size: 11.5px; color: ${textMuted}; margin-top: 3px; display: flex; justify-content: space-between; align-items: center;">
          <span>${totalQty > 0 ? `<strong style="color: #10b981;">${totalQty}x no pedido</strong>` : 'Não adicionado'}</span>
          <strong style="color: #fc4b15; font-size: 12.5px;">R$ ${(inCart ? inCart.preco : (prod.preco || 0)).toFixed(2).replace('.', ',')}</strong>
        </div>
      </div>

      <!-- Atalhos Rápidos de Quantidade -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 2px 0 6px 0; border-bottom: 1px solid ${borderSub}; margin-bottom: 6px;">
        <button onclick="window.pdvQuickAddQty(${prodId}, 1); window.fecharPdvContextMenu();" title="Adicionar +1"
                style="padding: 6px 0; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; font-weight: 800; font-size: 12px; color: #10b981; cursor: pointer; transition: 0.15s;"
                onmouseenter="this.style.background='rgba(16,185,129,0.25)'" onmouseleave="this.style.background='rgba(16,185,129,0.12)'">+1</button>
        <button onclick="window.pdvQuickAddQty(${prodId}, 2); window.fecharPdvContextMenu();" title="Adicionar +2"
                style="padding: 6px 0; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; font-weight: 800; font-size: 12px; color: #10b981; cursor: pointer; transition: 0.15s;"
                onmouseenter="this.style.background='rgba(16,185,129,0.25)'" onmouseleave="this.style.background='rgba(16,185,129,0.12)'">+2</button>
        <button onclick="window.pdvQuickAddQty(${prodId}, 5); window.fecharPdvContextMenu();" title="Adicionar +5"
                style="padding: 6px 0; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.25); border-radius: 8px; font-weight: 800; font-size: 12px; color: #3b82f6; cursor: pointer; transition: 0.15s;"
                onmouseenter="this.style.background='rgba(59,130,246,0.25)'" onmouseleave="this.style.background='rgba(59,130,246,0.12)'">+5</button>
        <button onclick="window.pdvQuickSubQty(${prodId}); window.fecharPdvContextMenu();" title="Subtrair -1"
                style="padding: 6px 0; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; font-weight: 800; font-size: 12px; color: #ef4444; cursor: pointer; transition: 0.15s; ${totalQty <= 0 ? 'opacity:0.4; pointer-events:none;' : ''}"
                onmouseenter="this.style.background='rgba(239,68,68,0.25)'" onmouseleave="this.style.background='rgba(239,68,68,0.12)'">-1</button>
      </div>

      <button onclick="window.pdvSetObsPrompt(${prodId}); window.fecharPdvContextMenu();" 
              style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; color: ${textColor}; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.15s; margin-bottom: 2px;"
              onmouseenter="this.style.background='${hoverBg}'" onmouseleave="this.style.background='none'">
        <i class="ph ph-pencil-line" style="color: #3b82f6; font-size: 17px;"></i> Observação / Detalhes
      </button>

      <button onclick="window.pdvSetQtyPrompt(${prodId}); window.fecharPdvContextMenu();" 
              style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; color: ${textColor}; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.15s; margin-bottom: 2px;"
              onmouseenter="this.style.background='${hoverBg}'" onmouseleave="this.style.background='none'">
        <i class="ph ph-hash" style="color: #8b5cf6; font-size: 17px;"></i> Digitar Quantidade Exata
      </button>

      <button onclick="window.pdvSetCortesia(${prodId}); window.fecharPdvContextMenu();" 
              style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; color: ${textColor}; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.15s; margin-bottom: 2px;"
              onmouseenter="this.style.background='${hoverBg}'" onmouseleave="this.style.background='none'">
        <i class="ph ph-gift" style="color: #ec4899; font-size: 17px;"></i> Aplicar Cortesia (R$ 0,00)
      </button>

      ${canEditPrice ? `
        <button onclick="window.pdvEditPriceInline(${prodId}); window.fecharPdvContextMenu();" 
                style="width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; color: ${textColor}; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.15s; margin-bottom: 2px;"
                onmouseenter="this.style.background='${hoverBg}'" onmouseleave="this.style.background='none'">
          <i class="ph ph-currency-dollar" style="color: #10b981; font-size: 17px;"></i> Preço Personalizado (Admin)
        </button>
      ` : ''}

      ${totalQty > 0 ? `
        <div style="border-top: 1px solid ${borderSub}; margin-top: 4px; padding-top: 4px;">
          <button onclick="window.pdvRemoveAllDirect(${prodId}); window.fecharPdvContextMenu();" 
                  style="width: 100%; text-align: left; padding: 8px 10px; background: rgba(239,68,68,0.08); border: none; border-radius: 8px; font-size: 13px; font-weight: 700; color: #ef4444; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.15s;"
                  onmouseenter="this.style.background='rgba(239,68,68,0.18)'" onmouseleave="this.style.background='rgba(239,68,68,0.08)'">
            <i class="ph ph-trash" style="color: #ef4444; font-size: 17px;"></i> Remover do Pedido
          </button>
        </div>
      ` : ''}
    `;

    setTimeout(() => {
      const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
          window.fecharPdvContextMenu();
          document.removeEventListener('click', closeHandler);
          document.removeEventListener('touchstart', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
      document.addEventListener('touchstart', closeHandler);
    }, 50);
  };

  window.fecharPdvContextMenu = function() {
    const menu = document.getElementById('pdv-quick-context-menu');
    if (menu) menu.style.display = 'none';
  };

  window.pdvSetObsPrompt = function(prodId) {
    const prod = window.allProducts.find(p => p.id === prodId);
    if (!prod) return;
    let item = (window.pdvCart || []).find(i => i.id === prodId);
    if (!item) {
      window.pdvAddToCart(prodId);
      item = (window.pdvCart || []).find(i => i.id === prodId);
    }
    const custom = prompt(`Observação para "${prod.nome}" (ex: Sem cebola, Bem passado, Com gelo):`, item ? (item.observations || '') : '');
    if (custom === null) return;
    if (item) {
      item.observations = custom.trim();
    }
    window.renderPdvCart();
  };

  window.pdvSetQtyPrompt = function(prodId) {
    const prod = window.allProducts.find(p => p.id === prodId);
    if (!prod) return;
    let item = (window.pdvCart || []).find(i => i.id === prodId);
    const currentQty = item ? item.quantity : 1;
    const custom = prompt(`Digite a quantidade para "${prod.nome}":`, currentQty);
    if (custom === null) return;
    const newQty = parseInt(custom);
    if (isNaN(newQty) || newQty <= 0) {
      if (item) {
        const idx = window.pdvCart.findIndex(i => i.id === prodId);
        if (idx >= 0) window.pdvCart.splice(idx, 1);
      }
    } else {
      if (item) {
        item.quantity = newQty;
      } else {
        window.pdvCart.push({ ...prod, quantity: newQty, preco: prod.preco || 0 });
      }
    }
    window.renderPdvCart();
  };

  window.pdvSetCortesia = function(prodId) {
    const prod = window.allProducts.find(p => p.id === prodId);
    if (!prod) return;
    let item = (window.pdvCart || []).find(i => i.id === prodId);
    if (!item) {
      window.pdvCart.push({
        ...prod,
        preco: 0.00,
        quantity: 1,
        observations: '[CORTESIA]'
      });
    } else {
      item.preco = 0.00;
      item.observations = item.observations ? `[CORTESIA] ${item.observations}` : '[CORTESIA]';
    }
    window.renderPdvCart();
  };

  window.pdvRemoveAllDirect = function(prodId) {
    if (!window.pdvCart) return;
    const idx = window.pdvCart.findIndex(i => i.id === prodId);
    if (idx >= 0) {
      window.pdvCart.splice(idx, 1);
      window.renderPdvCart();
    }
  };

  window.pdvDecQtyDirect = function(prodId) {
    if (!window.pdvCart) return;
    const idx = window.pdvCart.findIndex(item => item.id === prodId);
    if (idx >= 0) {
      window.pdvRemoveFromCart(idx);
    }
  };

  window.pdvViewModes = ['cards', 'list', 'icons'];
  window.pdvViewMode = 'cards';

  window.pdvSetViewMode = function(mode) {
    if (!window.pdvViewModes.includes(mode)) return;
    window.pdvViewMode = mode;
    ['cards', 'list', 'icons'].forEach(m => {
      const btn = document.getElementById(`btn-pdv-mode-${m}`);
      if (btn) {
        btn.style.background = m === mode ? '#ffffff' : 'transparent';
        btn.style.color = m === mode ? '#0f172a' : '#64748b';
        btn.style.boxShadow = m === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
      }
    });
    window.renderPdvMenu();
  };

  window.initPdvViewModeControls = function() {
    const itemsDiv = document.getElementById('pdv-menu-items');
    if (!itemsDiv || itemsDiv.dataset.viewControlsInited) return;
    itemsDiv.dataset.viewControlsInited = 'true';

    // Desktop: Ctrl + Mouse Scroll
    itemsDiv.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        let curIdx = window.pdvViewModes.indexOf(window.pdvViewMode);
        if (e.deltaY > 0) {
          curIdx = Math.min(window.pdvViewModes.length - 1, curIdx + 1);
        } else if (e.deltaY < 0) {
          curIdx = Math.max(0, curIdx - 1);
        }
        window.pdvSetViewMode(window.pdvViewModes[curIdx]);
      }
    }, { passive: false });

    // Mobile: Pinch Gesture
    let touchDistStart = 0;
    itemsDiv.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        touchDistStart = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
      }
    }, { passive: true });

    itemsDiv.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && touchDistStart > 0) {
        const curDist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const delta = curDist - touchDistStart;
        if (Math.abs(delta) > 40) {
          let curIdx = window.pdvViewModes.indexOf(window.pdvViewMode);
          if (delta < -40) {
            curIdx = Math.min(window.pdvViewModes.length - 1, curIdx + 1);
          } else if (delta > 40) {
            curIdx = Math.max(0, curIdx - 1);
          }
          touchDistStart = curDist;
          window.pdvSetViewMode(window.pdvViewModes[curIdx]);
        }
      }
    }, { passive: true });
  };

  window.scrollToActiveCategoryPill = function() {
    const catsDiv = document.getElementById('pdv-categories');
    if (!catsDiv) return;
    setTimeout(() => {
      const activeBtn = catsDiv.querySelector('.pdv-category-btn.active');
      if (!activeBtn) return;
      const containerWidth = catsDiv.clientWidth;
      const btnLeft = activeBtn.offsetLeft;
      const btnWidth = activeBtn.offsetWidth;
      const targetScrollLeft = btnLeft - (containerWidth / 2) + (btnWidth / 2);
      catsDiv.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth'
      });
    }, 30);
  };

  window.pdvSelectCategory = function(categoryName) {
    window.pdvCurrentCategory = categoryName;
    window.renderPdvMenu();
    window.scrollToActiveCategoryPill();
  };  window.renderPdvMenu = () => {
    if (!window.allProducts) return;
    const catsDiv = document.getElementById('pdv-categories');
    const itemsDiv = document.getElementById('pdv-menu-items');
    if (!catsDiv || !itemsDiv) return;

    window.initPdvViewModeControls();

    let categories = [...new Set(window.allProducts.map(p => p.categoria))];

    if (window.pdvConfigs && window.pdvConfigs.ordem_categorias) {
      try {
        const order = JSON.parse(window.pdvConfigs.ordem_categorias);
        categories.sort((a, b) => {
          let idxA = order.indexOf(a);
          let idxB = order.indexOf(b);
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
      } catch (e) { }
    }

    if (categories.includes('Mais Pedidos')) {
      categories = ['Mais Pedidos', ...categories.filter(t => t !== 'Mais Pedidos')];
    }

    categories = ['Todas', ...categories];

    catsDiv.innerHTML = categories.map(c => `
      <button class="pdv-category-btn ${c === window.pdvCurrentCategory ? 'active' : ''}" 
              onclick="window.pdvSelectCategory('${escHtml(c).replace(/'/g, "\\'")}')"
              style="padding: 8px 16px; border-radius: 20px; border: none; background: ${c === window.pdvCurrentCategory ? '#fc4b15' : '#e2e8f0'}; color: ${c === window.pdvCurrentCategory ? 'white' : '#334155'}; font-weight: 700; cursor: pointer; text-align: center; white-space: nowrap; font-size: 13px; transition: all 0.15s ease; flex-shrink: 0;">
        ${escHtml(c)}
      </button>
    `).join('');

    const normCat = (s) => String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const query = (window.pdvSearchQuery || '').trim();
    let filteredProds = [];
    if (query !== '') {
      filteredProds = window.FuzzySearch.filter(window.allProducts, query, (p) => [p.nome, p.categoria, String(p.codigo || ''), String(p.id || '')]);
    } else {
      filteredProds = window.pdvCurrentCategory === 'Todas' ? window.allProducts : window.allProducts.filter(p => normCat(p.categoria) === normCat(window.pdvCurrentCategory));
    }

    window.pdvFilteredProducts = filteredProds;
    if (typeof window.pdvSelectedIndex !== 'number' || window.pdvSelectedIndex >= filteredProds.length) {
      window.pdvSelectedIndex = 0;
    }

    const canEditPrice = window.podeEditarPrecoPdv();
    const pdvCfg = window.pdvConfigs || {};
    const vendaSemEstoque = pdvCfg.feature_venda_sem_estoque === 'true' || pdvCfg.feature_venda_sem_estoque === true;

    // Adjust grid template based on view mode
    const isMobile = window.innerWidth <= 768;
    if (window.pdvViewMode === 'list') {
      itemsDiv.style.setProperty('grid-template-columns', '1fr', 'important');
      itemsDiv.style.gap = '6px';
    } else if (window.pdvViewMode === 'icons') {
      itemsDiv.style.setProperty('grid-template-columns', isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(80px, 1fr))', 'important');
      itemsDiv.style.gap = '6px';
    } else {
      itemsDiv.style.setProperty('grid-template-columns', isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(150px, 1fr))', 'important');
      itemsDiv.style.gap = '8px';
    }

    itemsDiv.innerHTML = filteredProds.map((p, idx) => {
      const isSearchFocus = query !== '' && idx === window.pdvSelectedIndex;
      const inCartItems = (window.pdvCart || []).filter(item => item.id === p.id);
      const totalQty = inCartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
      const isSelected = totalQty > 0;
      const currentPrice = inCartItems.length > 0 ? inCartItems[0].preco : window.getPrecoAtivo(p.nome, p.preco || 0);
      const hasPromo = currentPrice < (p.preco || 0);
      const promoBadge = hasPromo ? `<span style="background:#fef3c7; color:#92400e; padding:1px 5px; border-radius:4px; font-size:9px; font-weight:700; margin-left:4px;">PROMO</span>` : '';
      const estoqueAtual = parseFloat(p.estoque) || 0;
      const semEstoqueBadge = (!vendaSemEstoque && estoqueAtual <= 0) ? `<span style="background:#fef2f2; color:#dc2626; padding:1px 5px; border-radius:4px; font-size:9px; font-weight:700; margin-left:4px;">SEM ESTOQUE</span>` : '';

      const cardBg = isSelected ? '#f0fdf4' : (isSearchFocus ? '#fff5f2' : '#ffffff');
      const isOutOfStock = !vendaSemEstoque && estoqueAtual <= 0;
      const cardBorder = isSelected ? '2px solid #22c55e' : (isSearchFocus ? '2px solid #fc4b15' : (isOutOfStock ? '1px dashed #fca5a5' : '1px solid #cbd5e1'));
      const cardShadow = isSelected ? 'box-shadow: 0 4px 12px rgba(34, 197, 94, 0.22);' : (isSearchFocus ? 'box-shadow: 0 0 8px rgba(252, 75, 21, 0.25);' : '');
      const cardOpacity = isOutOfStock ? 'opacity:0.6;' : '';
      const badge = isSearchFocus ? `<span style="background: #fc4b15; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 6px;">↵ Enter</span>` : '';
      const priceColor = isSelected ? '#15803d' : '#64748b';

      const ctxAttrs = `
        oncontextmenu="event.preventDefault(); window.abrirPdvContextMenu(${p.id}, event.clientX, event.clientY);"
        ontouchstart="window.pdvTouchStartCtx(${p.id}, event);"
        ontouchend="window.pdvTouchEndCtx();"
        ontouchmove="window.pdvTouchEndCtx();"
      `;

      // MODE 2: LIST MODE (1 item por linha)
      if (window.pdvViewMode === 'list') {
        return `
          <div class="pdv-item-card" onclick="window.pdvAddToCart(${p.id})" ${ctxAttrs}
               style="padding: 10px 14px; border-radius: 10px; cursor: pointer; transition: all 0.15s; background: ${cardBg}; border: ${cardBorder}; ${cardShadow} ${cardOpacity} display: flex; align-items: center; justify-content: space-between; gap: 10px; user-select: none; width: 100%; box-sizing: border-box;">
             
             <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
               <span style="font-size: 20px; flex-shrink: 0;">${p.emoji || '🍽️'}</span>
                 <span style="font-weight: 700; font-size: 14.5px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escHtml(p.nome)} ${badge} ${promoBadge} ${semEstoqueBadge}</span>
               ${isSelected ? `<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-weight: 800; font-size: 11.5px; flex-shrink: 0;"><i class="ph ph-check"></i> ${totalQty}x</span>` : ''}
             </div>

             <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
                <div onclick="${canEditPrice ? `event.stopPropagation(); window.pdvEditPriceInline(${p.id});` : ''}" title="${canEditPrice ? 'Clique para alterar o valor' : ''}">
                  ${hasPromo ? `<span style="color:#94a3b8; font-size:11px; text-decoration:line-through; margin-right:4px;">R$ ${Number(p.preco || 0).toFixed(2).replace('.', ',')}</span>` : ''}
                  <span style="color: ${hasPromo ? '#dc2626' : priceColor}; font-size: 14.5px; font-weight: 800;">R$ ${Number(currentPrice).toFixed(2).replace('.', ',')}</span>
                  ${canEditPrice ? `<i class="ph ph-pencil-simple" style="font-size: 11px; color: var(--text-secondary); margin-left: 2px;"></i>` : ''}
                </div>

               ${isSelected ? `
                 <div style="display: flex; align-items: center; gap: 4px;" onclick="event.stopPropagation();">
                   <button onclick="window.pdvDecQtyDirect(${p.id}); event.stopPropagation();" title="Diminuir"
                           style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; width: 30px; height: 30px; font-weight: 900; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;">-</button>
                   <span style="font-weight: 800; color: #15803d; font-size: 14px; min-width: 20px; text-align: center;">${totalQty}</span>
                   <button onclick="window.pdvAddToCart(${p.id}); event.stopPropagation();" title="Adicionar"
                           style="background: #22c55e; color: white; border: none; border-radius: 6px; width: 30px; height: 30px; font-weight: 900; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;">+</button>
                 </div>
               ` : ''}
             </div>
          </div>
        `;
      }

      // MODE 3: ICONS MODE (No mínimo 3 ícones por linha no mobile, ou mais conforme resolução)
      if (window.pdvViewMode === 'icons') {
        return `
          <div class="pdv-item-card" onclick="window.pdvAddToCart(${p.id})" ${ctxAttrs}
               style="padding: 8px 6px; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.15s; background: ${cardBg}; border: ${cardBorder}; ${cardShadow} ${cardOpacity} display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 86px; user-select: none; position: relative; box-sizing: border-box;">
             
             ${isSelected ? `<span style="position: absolute; top: 3px; right: 3px; background: #22c55e; color: white; padding: 1px 5px; border-radius: 10px; font-weight: 800; font-size: 10px;">${totalQty}x</span>` : ''}

             <div style="font-size: 24px; margin-top: 2px;">${p.emoji || '🍽️'}</div>
             
             <div style="font-weight: 700; font-size: 11.5px; color: #0f172a; line-height: 1.15; margin: 2px 0; max-height: 26px; overflow: hidden; word-break: break-word;">${escHtml(p.nome)}${semEstoqueBadge ? ' ' + semEstoqueBadge : ''}</div>

             <div style="color: ${hasPromo ? '#dc2626' : priceColor}; font-size: 11.5px; font-weight: 800;">${hasPromo ? `<span style="color:#94a3b8;text-decoration:line-through;font-size:9px;font-weight:400;">R$ ${Number(p.preco || 0).toFixed(2).replace('.', ',')} </span>` : ''}R$ ${Number(currentPrice).toFixed(2).replace('.', ',')}${promoBadge}</div>

             ${isSelected ? `
               <div style="display: flex; align-items: center; gap: 4px; margin-top: 4px;" onclick="event.stopPropagation();">
                 <button onclick="window.pdvDecQtyDirect(${p.id}); event.stopPropagation();" title="Diminuir"
                         style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; width: 22px; height: 22px; font-weight: 900; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center;">-</button>
                 <button onclick="window.pdvAddToCart(${p.id}); event.stopPropagation();" title="Adicionar"
                         style="background: #22c55e; color: white; border: none; border-radius: 4px; width: 22px; height: 22px; font-weight: 900; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center;">+</button>
               </div>
             ` : ''}
          </div>
        `;
      }

      // MODE 1: DEFAULT CARDS MODE
      return `
        <div class="pdv-item-card" onclick="window.pdvAddToCart(${p.id})" ${ctxAttrs}
             style="padding: 12px 14px; border-radius: 12px; cursor: pointer; text-align: left; transition: all 0.15s; position: relative; background: ${cardBg}; border: ${cardBorder}; ${cardShadow} ${cardOpacity} display: flex; flex-direction: column; justify-content: space-between; min-height: 100px; user-select: none;">
           
           <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
              <span style="font-weight: 700; font-size: 14px; color: #0f172a; line-height: 1.25;">${p.emoji || ''} ${escHtml(p.nome)} ${badge} ${promoBadge} ${semEstoqueBadge}</span>
             ${isSelected ? `<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-weight: 800; font-size: 12px; flex-shrink: 0;"><i class="ph ph-check"></i> ${totalQty}x</span>` : ''}
           </div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
              <div style="display: flex; align-items: center; gap: 4px;" onclick="${canEditPrice ? `event.stopPropagation(); window.pdvEditPriceInline(${p.id});` : ''}" title="${canEditPrice ? 'Clique para alterar o valor' : ''}">
                ${hasPromo ? `<span style="color:#94a3b8; font-size:11px; text-decoration:line-through;">R$ ${Number(p.preco || 0).toFixed(2).replace('.', ',')}</span>` : ''}
                <span style="color: ${hasPromo ? '#dc2626' : priceColor}; font-size: 14px; font-weight: 800;">R$ ${Number(currentPrice).toFixed(2).replace('.', ',')}</span>
                ${canEditPrice ? `<i class="ph ph-pencil-simple" style="font-size: 11px; color: var(--text-secondary); margin-left: 2px;"></i>` : ''}
              </div>

             ${isSelected ? `
               <div style="display: flex; align-items: center; gap: 6px;" onclick="event.stopPropagation();">
                 <button onclick="window.pdvDecQtyDirect(${p.id}); event.stopPropagation();" title="Diminuir"
                         style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; width: 32px; height: 32px; font-weight: 900; cursor: pointer; font-size: 17px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(220,38,38,0.12);">
                   -
                 </button>
                 <button onclick="window.pdvAddToCart(${p.id}); event.stopPropagation();" title="Adicionar"
                         style="background: #22c55e; color: white; border: none; border-radius: 8px; width: 32px; height: 32px; font-weight: 900; cursor: pointer; font-size: 17px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
                   +
                 </button>
               </div>
             ` : ''}
           </div>
        </div>
      `;
    }).join('');
  };

  window.pdvAddToCart = (id) => {
    const prod = window.allProducts.find(p => p.id === id);
    if (!prod) return;

    const pdvCfg = window.pdvConfigs || {};
    const vendaSemEstoque = pdvCfg.feature_venda_sem_estoque === 'true' || pdvCfg.feature_venda_sem_estoque === true;

    if (!vendaSemEstoque && prod.estoque !== undefined && prod.estoque !== null && prod.estoque !== '') {
      const estoqueAtual = parseFloat(prod.estoque) || 0;
      if (estoqueAtual <= 0) {
        return alert(`Produto "${prod.nome}" sem estoque disponível!`);
      }
    }

    const modality = pdvCfg.rest_modalidade || 'a_la_carte';

    // --- MODALITY ADAPTER: À KILO ---
    if (modality === 'a_kilo' && (prod.categoria && prod.categoria.toLowerCase().includes('kilo'))) {
      const custom = prompt(`Digite o peso de "${prod.nome}" em gramas (g):`, '500');
      if (custom === null) return;
      const grams = parseFloat(String(custom).replace(',', '.'));
      if (isNaN(grams) || grams <= 0) return alert('Peso inválido.');
      
      const precoUnitKilo = Number(prod.preco) || 0;
      const precoCalculado = (grams / 1000) * precoUnitKilo;
      
      window.pdvCart.push({
        ...prod,
        nome: `${prod.nome} (${grams}g)`,
        preco: precoCalculado,
        quantity: 1
      });
      window.renderPdvCart();
      return;
    }

    // --- MODALITY ADAPTER: PIZZARIA (SPLIT FLAVOR) ---
    if (modality === 'pizzaria' && (prod.categoria && prod.categoria.toLowerCase().includes('pizza'))) {
      const opt = prompt(`Selecione o tipo de venda:\n1 - Inteira (Sabor Único)\n2 - Meio a Meio (2 Sabores)`, '1');
      if (opt === null) return;
      if (opt.trim() === '2') {
        const pizzaProds = window.allProducts.filter(p => p.categoria && p.categoria.toLowerCase().includes('pizza'));
        let listStr = `Escolha o segundo sabor (digite o número):\n`;
        pizzaProds.forEach((p, index) => {
          listStr += `${index + 1} - ${p.nome} (R$ ${p.preco.toFixed(2)})\n`;
        });
        const choice = prompt(listStr);
        if (choice === null) return;
        const choiceIdx = parseInt(choice) - 1;
        const secondProd = pizzaProds[choiceIdx];
        if (!secondProd) return alert('Sabor inválido.');

        const finalPrice = Math.max(Number(prod.preco), Number(secondProd.preco));
        
        window.pdvCart.push({
          ...prod,
          nome: `Pizza 1/2 ${prod.nome} + 1/2 ${secondProd.nome}`,
          preco: finalPrice,
          quantity: 1
        });
        window.renderPdvCart();
        return;
      }
    }

    const existing = window.pdvCart.find(item => item.id === id);
    if (existing) {
      existing.quantity += 1;
    } else {
      let precoUnit = Number(prod.preco) || 0;
      precoUnit = window.getPrecoAtivo(prod.nome, precoUnit);
      const alterarValoresPdv = pdvCfg.feature_alterar_valores_pdv === 'true' || pdvCfg.feature_alterar_valores_pdv === true;
      if (prod.visibilidade === 'caixa' || alterarValoresPdv) {
        const custom = prompt(`Defina o valor de "${prod.nome}" (R$):`, precoUnit ? precoUnit.toFixed(2) : '');
        if (custom === null) return;
        const customVal = parseFloat(String(custom).replace(',', '.'));
        if (isNaN(customVal) || customVal < 0) return alert('Valor inválido.');
        precoUnit = customVal;
      }
      window.pdvCart.push({ ...prod, preco: precoUnit, quantity: 1 });
    }
    window.renderPdvCart();
  };

  window.pdvRemoveFromCart = (idx) => {
    const item = window.pdvCart[idx];
    if (!item) return;
    item.quantity -= 1;
    if (item.quantity <= 0) window.pdvCart.splice(idx, 1);
    window.renderPdvCart();
  };

  window.pdvIncFromCart = (idx) => {
    const item = window.pdvCart[idx];
    if (!item) return;
    item.quantity += 1;
    window.renderPdvCart();
  };

  window.pdvSetPreco = (id, valor) => {
    const item = window.pdvCart.find(i => i.id === id);
    if (!item) return;
    const v = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(v) || v < 0) return;
    item.preco = v;
    window.renderPdvCart();
  };

  window.pdvSetObservacao = (id, texto) => {
    const item = window.pdvCart.find(i => i.id === id);
    if (item) item.observations = String(texto || '');
  };

  window.podeVendaRapida = () => {
    const roles = ['admin', 'administrador', 'gerente', 'caixa', 'operador de caixa', 'caixa / pdv', 'adm'];
    const check = (creds) => {
      if (!creds || !creds.cargo) return false;
      return roles.includes(String(creds.cargo).toLowerCase());
    };
    try {
      if (check(JSON.parse(localStorage.getItem('chef_app_creds') || '{}'))) return true;
    } catch (e) { }
    try {
      if (check(JSON.parse((localStorage.getItem('chef_session') || localStorage.getItem('chef_credentials')) || '{}'))) return true;
    } catch (e) { }
    return false;
  };

  window.abrirVendaRapida = () => {
    if (!window.podeVendaRapida()) return alert('Venda rápida disponível apenas para Caixa, Gerente ou Administrador.');
    const modal = document.getElementById('venda-rapida-modal');
    if (!modal) return;
    const nomeInput = document.getElementById('venda-rapida-nome');
    const valorInput = document.getElementById('venda-rapida-valor');
    if (nomeInput) nomeInput.value = '';
    if (valorInput) valorInput.value = '';
    modal.style.display = 'flex';
    setTimeout(() => { if (nomeInput) nomeInput.focus(); }, 60);
  };

  window.fecharVendaRapida = () => {
    const modal = document.getElementById('venda-rapida-modal');
    if (modal) modal.style.display = 'none';
  };

  window.confirmarVendaRapida = () => {
    if (!window.podeVendaRapida()) return alert('Venda rápida disponível apenas para Caixa, Gerente ou Administrador.');
    const nome = (document.getElementById('venda-rapida-nome').value || '').trim();
    const raw = (document.getElementById('venda-rapida-valor').value || '').replace(',', '.');
    const valor = parseFloat(raw);
    if (!nome) return alert('Informe o nome do item.');
    if (isNaN(valor) || valor <= 0) return alert('Informe um valor maior que zero.');
    window.pdvCart.push({
      id: 'rapida_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      nome,
      emoji: '⚡',
      preco: valor,
      quantity: 1,
      categoria: 'Venda Rápida',
      setor: 'Nenhum',
      status_inicial: 'Pronto',
      isVendaRapida: true
    });
    window.renderPdvCart();
    window.fecharVendaRapida();
  };

  const btnVendaRapida = document.getElementById('btn-venda-rapida');
  if (btnVendaRapida) btnVendaRapida.style.display = window.podeVendaRapida() ? '' : 'none';

  window.renderPdvCart = () => {
    const cartList = document.getElementById('pdv-selected-items');
    const totalPrice = document.getElementById('pdv-total-price');
    const cartCountBadge = document.getElementById('pdv-cart-count-badge');
    
    let total = 0;
    let totalItemsCount = 0;
    (window.pdvCart || []).forEach(item => {
      total += (Number(item.preco) || 0) * (item.quantity || 1);
      totalItemsCount += (item.quantity || 1);
    });

    const descontoInfo = (typeof window.getDescontoAtivo === 'function') ? window.getDescontoAtivo(total) : { valor: 0 };
    const descontoValor = descontoInfo.valor || 0;
    const totalComDesconto = Math.max(0, total - descontoValor);

    if (totalPrice) totalPrice.innerText = `R$ ${totalComDesconto.toFixed(2).replace('.', ',')}`;
    if (cartCountBadge) cartCountBadge.innerText = `${totalItemsCount} item${totalItemsCount === 1 ? '' : 's'} selecionado${totalItemsCount === 1 ? '' : 's'}`;

    if (cartList) {
      cartList.innerHTML = window.pdvCart.map((item, idx) => {
        return `
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #eee;">
            <div style="flex: 1; display: flex; flex-direction: column; margin-right: 8px;">
              <strong style="font-size: 16px;">${escHtml(item.nome)}</strong>
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                <span style="color: var(--text-muted); font-size: 13px;">R$</span>
                <input type="number" min="0" step="0.01" value="${item.preco.toFixed(2)}" onchange="window.pdvSetPreco(${idx}, this.value)" style="width: 74px; padding: 2px 4px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px;">
                <span style="color: var(--text-muted); font-size: 13px;">x ${item.quantity}</span>
              </div>
              <input type="text" maxlength="140" placeholder="Observação (opcional)" value="${escHtml(item.observations || '')}" oninput="window.pdvSetObservacao(${idx}, this.value)" style="width: 100%; margin-top: 4px; padding: 3px 6px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 12px; box-sizing: border-box;">
              ${item.composicoes && item.composicoes.length > 0 ? '<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:3px;">' + item.composicoes.map(c => '<span style="background:#dbeafe;color:#1e40af;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:600;">' + escHtml(typeof c === 'object' ? (c.categoria + ': ' + c.opcao) : c) + '</span>').join('') + '</div>' : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button onclick="window.pdvRemoveFromCart(${idx})" style="background: #eee; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">-</button>
              <span style="font-size: 14px; width: 20px; text-align: center;">${item.quantity}</span>
              <button onclick="window.pdvIncFromCart(${idx})" style="background: #3ab55b; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">+</button>
            </div>
          </li>
        `;
      }).join('');
      if (window.pdvCart.length === 0) cartList.innerHTML = '<li style="text-align:center; padding: 20px; color: var(--text-muted);">Carrinho vazio</li>';
    }

    if (typeof window.renderPdvMenu === 'function') {
      window.renderPdvMenu();
    }
  };

  window.togglePdvClienteFields = function() {
    const fields = document.getElementById('pdv-top-fields');
    if (!fields) return;
    const isHidden = fields.style.display === 'none' || getComputedStyle(fields).display === 'none';
    fields.style.display = isHidden ? (window.innerWidth <= 768 ? 'grid' : 'flex') : 'none';
  };

  if (btnNovo && pdvOverlay) {
    btnNovo.onclick = () => {
      window.pdvCart = [];
      window.renderPdvCart();

      const searchInput = document.getElementById('pdv-search-product');
      if (searchInput) {
        searchInput.value = '';
        window.pdvSearchQuery = '';
        window.pdvSelectedIndex = 0;
      }

      window.renderPdvMenu();

      const tipoPedido = document.getElementById('pdv-tipo-pedido');
      const clienteNomeInput = document.getElementById('pdv-cliente-nome');
      const pdvTopFields = document.getElementById('pdv-top-fields');
      const pdvTitleText = document.getElementById('pdv-title-text');

      if (window.mesaAtual && tipoPedido) {
        tipoPedido.value = 'Mesa';
        tipoPedido.dispatchEvent(new Event('change'));
        tipoPedido.disabled = true;
        const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
        let clienteName = mesaName;
        const obsSrc = window.mesaAtual.observacao || (window.mesaAtual.originalMesa && window.mesaAtual.originalMesa.observacao) || '';
        if (obsSrc) {
          try {
            const obsObj = JSON.parse(obsSrc);
            if (obsObj.cliente) clienteName = obsObj.cliente;
          } catch (e) { }
        }
        if (clienteNomeInput) {
          clienteNomeInput.value = clienteName;
          clienteNomeInput.disabled = true;
        }

        // HIDE READ-ONLY TOP FIELDS WHEN LAUNCHING ITEMS ON A TABLE AND UPDATE TITLE
        if (pdvTopFields) pdvTopFields.style.display = 'none';
        if (pdvTitleText) pdvTitleText.innerHTML = `<i class="ph ph-plus-circle" style="color:#fc4b15;"></i> Lançar Pedido — <span style="color:#fc4b15; font-weight:800;">${escHtml(mesaName)}</span>`;

        if (window.mesaAtual.status !== 'Ocupada' && !mesaName.includes('Delivery') && !mesaName.includes('Balcão')) {
          socket.emit('atualizar_status_mesa', { nome: mesaName, status: 'Ocupada' });
        }
      } else if (tipoPedido) {
        tipoPedido.disabled = false;
        if (clienteNomeInput) clienteNomeInput.disabled = false;
        if (tipoPedido.value === 'Mesa') {
          tipoPedido.value = 'Balcão';
          tipoPedido.dispatchEvent(new Event('change'));
        }
        if (clienteNomeInput) clienteNomeInput.value = '';

        if (pdvTopFields) pdvTopFields.style.display = window.innerWidth <= 768 ? 'grid' : 'flex';
        if (pdvTitleText) pdvTitleText.innerText = 'Venda Rápida (PDV)';
      }

      pdvOverlay.style.display = 'flex';
      setTimeout(() => {
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }, 80);
    };
  }

  const btnFecharPdv = document.getElementById('btn-fechar-pdv');
  if (btnFecharPdv) {
    btnFecharPdv.onclick = () => pdvOverlay.style.display = 'none';
  }

  // Atalhos de Teclado (Enter para filtrar, selecionar e enviar)
  const pdvSearchInputEl = document.getElementById('pdv-search-product');
  if (pdvSearchInputEl) {
    pdvSearchInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (window.pdvFilteredProducts && window.pdvFilteredProducts.length > 0) {
          window.pdvSelectedIndex = Math.min((window.pdvFilteredProducts.length - 1), (window.pdvSelectedIndex || 0) + 1);
          window.renderPdvMenu();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (window.pdvFilteredProducts && window.pdvFilteredProducts.length > 0) {
          window.pdvSelectedIndex = Math.max(0, (window.pdvSelectedIndex || 0) - 1);
          window.renderPdvMenu();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const query = (window.pdvSearchQuery || '').trim();
        if (query !== '' && window.pdvFilteredProducts && window.pdvFilteredProducts.length > 0) {
          const targetIndex = window.pdvSelectedIndex || 0;
          const chosenProd = window.pdvFilteredProducts[targetIndex] || window.pdvFilteredProducts[0];
          if (chosenProd) {
            window.pdvAddToCart(chosenProd.id);
            pdvSearchInputEl.value = '';
            window.pdvSearchQuery = '';
            window.pdvSelectedIndex = 0;
            window.renderPdvMenu();
            pdvSearchInputEl.focus();
          }
        } else if (query === '' && window.pdvCart && window.pdvCart.length > 0) {
          const btnLancar = document.getElementById('btn-lancar-pdv');
          if (btnLancar) btnLancar.click();
        }
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const pdvOverlay = document.getElementById('pdv-overlay');
      const checkoutModal = document.getElementById('comanda-checkout-overlay');
      const fecharModal = document.getElementById('fechamento-modal');
      const activeEl = document.activeElement;

      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      const isAnyModalOpen = (pdvOverlay && pdvOverlay.style.display !== 'none' && pdvOverlay.style.display !== '') ||
        (checkoutModal && checkoutModal.style.display !== 'none' && checkoutModal.style.display !== '') ||
        (fecharModal && fecharModal.style.display !== 'none' && fecharModal.style.display !== '');

      if (!isAnyModalOpen && !isInputFocused && window.mesaAtual) {
        e.preventDefault();
        const btnLancar = document.getElementById('btn-adicionar-produtos');
        if (btnLancar) btnLancar.click();
      }
    }
  });

  const tipoPedido = document.getElementById('pdv-tipo-pedido');
  if (tipoPedido) {
    tipoPedido.onchange = (e) => {
      document.getElementById('pdv-delivery-fields').style.display = e.target.value === 'Delivery' ? 'flex' : 'none';
      window.renderPdvCart();
    };
  }

  const taxaEntregaInput = document.getElementById('pdv-taxa-entrega');
  if (taxaEntregaInput) taxaEntregaInput.oninput = window.renderPdvCart;

  // --- AUTO-COMPLETE CLIENTE POR TELEFONE ---
  const pdvTelInput = document.getElementById('pdv-cliente-telefone');
  let searchTimeout = null;
  if (pdvTelInput) {
    pdvTelInput.addEventListener('input', (e) => {
      const tel = e.target.value.trim();
      if (tel.length >= 8) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          socket.emit('buscar_cliente_telefone', tel);
        }, 500);
      }
    });
  }

  socket.on('resultado_cliente_telefone', (cliente) => {
    if (cliente) {
      document.getElementById('pdv-cliente-id').value = cliente.id;
      document.getElementById('pdv-cliente-nome').value = cliente.nome;
      if (cliente.endereco && document.getElementById('pdv-cliente-endereco')) {
        document.getElementById('pdv-cliente-endereco').value = cliente.endereco;
      }
      if (cliente.pontos !== undefined) {
        document.getElementById('pdv-cliente-pontos').innerText = `â­ ${cliente.pontos} pts`;
      }
      if (cliente.observacao) {
        alert(`Atenção: O cliente ${cliente.nome} possui a seguinte observação em seu cadastro:\n\n"${cliente.observacao}"`);
      }
    } else {
      document.getElementById('pdv-cliente-id').value = '';
      document.getElementById('pdv-cliente-pontos').innerText = '';
    }
  });

  // --- SCANNER DE QR CODE DE PREMIO ---
  const qrInput = document.getElementById('pdv-qr-premio');
  if (qrInput) {
    qrInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = qrInput.value.trim();
        if (code !== '') {
          socket.emit('resgatar_premio_qr', code);
          qrInput.value = '';
        }
      }
    });
  }

  socket.on('resgate_erro', (msg) => {
    alert(msg);
  });

  socket.on('resgate_sucesso', ({ cliente, produto, custo }) => {
    alert(`Prêmio resgatado com sucesso!\nCliente: ${cliente.nome}\nCusto: ${custo} pts\nProduto: ${produto}\n\nO item foi adicionado ao carrinho com custo R$ 0,00.`);
    // Adicionar o produto no carrinho com preço 0
    window.pdvCart.push({
      id: 'premio_' + Date.now(),
      nome: produto + ' (Prêmio)',
      emoji: '🎁',
      preco: 0.00,
      quantity: 1,
      categoria: 'Prêmios'
    });
    window.renderPdvCart();

    // Atualizar os pontos exibidos no PDV (subtrair)
    document.getElementById('pdv-cliente-pontos').innerText = `â­ ${cliente.pontos - custo} pts`;
  });

  const btnLancarPdv = document.getElementById('btn-lancar-pdv');
  if (btnLancarPdv) {
    btnLancarPdv.onclick = () => {
      if (window.pdvCart.length === 0) return alert('Adicione itens!');

      const tipo = document.getElementById('pdv-tipo-pedido').value;
      const clienteNome = document.getElementById('pdv-cliente-nome').value || 'Avulso';
      const clienteId = document.getElementById('pdv-cliente-id').value || null;
      const entregadorId = document.getElementById('pdv-entregador-select').value;
      const taxaEntrega = parseFloat(document.getElementById('pdv-taxa-entrega')?.value || 0);

      const isAddingToExisting = window.mesaAtual && window.mesaAtual.isGroup !== false;
      const comandaId = (tipo !== 'Mesa' && !isAddingToExisting)
        ? ` #${Date.now().toString(36).toUpperCase().slice(-4)}`
        : '';

      window.pdvCart.forEach(item => {
        let sector = item.setor || 'Cozinha 1';

        let finalLocalName = `Balcão - ${clienteNome}${comandaId}`;
        if (tipo === 'Delivery') {
          finalLocalName = `Delivery - ${clienteNome}${comandaId}`;
        } else if (tipo === 'Mesa') {
          finalLocalName = clienteNome;
        }

        let itemObs = item.observations || '';
        if (window.pdvParaViagem) {
          itemObs = '[PARA VIAGEM] ' + itemObs;
        }

        const pedido = {
          productName: item.nome,
          productEmoji: item.emoji,
          quantity: item.quantity,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          localName: finalLocalName,
          userName: window.loggedInUser || 'Caixa',
          total: item.isVendaRapida ? (item.preco * item.quantity).toFixed(2) : (item.preco * item.quantity).toFixed(2).replace('.', ','),
          status: 'Recebido',
          status_inicial: item.status_inicial,
          sector: sector,
          cliente_id: clienteId,
          entregador_id: entregadorId || null,
          mesa_comanda: tipo !== 'Mesa' ? finalLocalName : null,
          observations: itemObs.trim(),
          composicoes: item.composicoes || [],
          para_viagem: window.pdvParaViagem ? true : undefined,
          isVendaRapida: item.isVendaRapida ? true : undefined
        };
        socket.emit('novo_pedido', pedido);
      });

      // Reset estado de para viagem se estivesse ativo
      if (window.pdvParaViagem) {
        window.pdvParaViagem = false;
        const btnV = document.getElementById('btn-toggle-pdv-viagem');
        const txtV = document.getElementById('btn-toggle-pdv-viagem-text');
        if (btnV) { btnV.style.background = '#f1f5f9'; btnV.style.borderColor = '#cbd5e1'; btnV.style.color = '#475569'; }
        if (txtV) txtV.innerText = 'Para Viagem';
      }

      if (tipo === 'Delivery' && taxaEntrega > 0) {
        socket.emit('novo_pedido', {
          productName: 'Taxa de Entrega',
          productEmoji: '🚗',
          quantity: 1,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          localName: `Delivery - ${clienteNome}${comandaId}`,
          userName: window.loggedInUser || 'Caixa',
          total: taxaEntrega.toFixed(2).replace('.', ','),
          status: 'Pronto',
          sector: 'Nenhum'
        });
      }

      window.pdvCart = [];
      pdvOverlay.style.display = 'none';
      alert('Pedido lançado com sucesso!');
    };
  }
});


// --- ADMIN PANEL LOGIC ---
const btnAdminPanel = document.getElementById('btn-admin-panel');
const adminOverlay = document.getElementById('admin-overlay');
const btnFecharAdmin = document.getElementById('btn-fechar-admin');

// Removed if (btnAdminPanel && adminOverlay) so socket listeners can attach

// Tabs logic (Kept for compatibility, now handled mainly in configuracoes.js but harmless here)
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.admin-tab-btn').forEach(b => {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.fontWeight = 'normal';
    });
    btn.classList.add('active');
    btn.style.background = '#eee';
    btn.style.fontWeight = 'bold';

    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('admin-tab-' + btn.dataset.tab).style.display = 'block';
  };
});

// Socket updates
socket.on('mesas_atualizadas', (mesas) => {
  window.allMesas = mesas;
  if (typeof renderOrders === 'function') renderOrders();

  const list = document.getElementById('admin-mesas-list');
  if (!list) return;
  list.innerHTML = mesas.map(m => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${m.id}</td>
        <td style="padding: 10px;">${m.nome} <span style="font-size:12px; color:gray;">(${m.status})</span></td>
        <td style="padding: 10px;">
          <button onclick="window.deleteMesa(${m.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
});

socket.on('produtos_atualizados', (prods) => {
  window.allProducts = prods;
  if (typeof window.renderPdvMenu === 'function') window.renderPdvMenu();
  const list = document.getElementById('admin-produtos-list');
  if (!list) return;
  list.innerHTML = prods.map(p => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${p.categoria}</td>
        <td style="padding: 10px;">${p.emoji} ${p.nome}</td>
        <td style="padding: 10px;">R$ ${p.preco.toFixed(2)}</td>
        <td style="padding: 10px;">${p.setor || 'Cozinha 1'}</td>
        <td style="padding: 10px;">${p.status_inicial || 'Em espera'}</td>
        <td style="padding: 10px;">
          <button onclick="window.editProduto(${p.id}, '${p.categoria.replace(/'/g, "\\'")}', '${p.nome.replace(/'/g, "\\'")}', ${p.preco}, '${(p.emoji || '').replace(/'/g, "\\'")}', '${p.setor || 'Cozinha 1'}', '${p.status_inicial || 'Em espera'}')" style="color: #2D9CDB; border: none; background: none; cursor: pointer; margin-right: 8px;"><i class="ph ph-pencil"></i> Editar</button>
          <button onclick="window.deleteProduto(${p.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
});

socket.on('funcionarios_atualizados', (funcs) => {
  const pdvSelect = document.getElementById('pdv-entregador-select');
  if (pdvSelect) {
    pdvSelect.innerHTML = '<option value="">Nenhum</option>' +
      funcs.filter(f => f.status !== 'Pendente')
        .map(f => `<option value="${f.id}">${escHtml(f.nome)}</option>`).join('');
  }
  const listAtivos = document.getElementById('admin-funcionarios-list');
  const listPendentes = document.getElementById('admin-funcionarios-pendentes');
  if (!listAtivos || !listPendentes) return;

  window.funcionariosList = funcs;
  const pendentes = funcs.filter(f => f.status === 'Pendente');
  const ativos = funcs.filter(f => f.status !== 'Pendente');

  listPendentes.innerHTML = pendentes.map(f => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${escHtml(f.nome)}</td>
        <td style="padding: 10px;">${escHtml(f.usuario)}</td>
        <td style="padding: 10px; text-align: right;">
          <select id="cargo-pendente-${f.id}" style="padding: 6px; border-radius: 6px; border: 1px solid var(--border-color); margin-right: 8px; font-family: Inter;">
            <option value="Garçom">Garçom</option>
            <option value="Caixa">Caixa</option>
            <option value="Cozinha">Cozinha</option>
            <option value="Bar">Bar</option>
            <option value="Copa">Copa</option>
            <option value="Auxiliar">Auxiliar</option>
          </select>
          <button onclick="window.aprovarFuncionario(${f.id})" style="color: white; background: #3ab55b; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-right: 4px; font-weight: bold;"><i class="ph ph-check"></i> Aprovar</button>
          <button onclick="window.recusarFuncionario(${f.id})" style="color: white; background: #eb5757; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="ph ph-x"></i> Recusar</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="padding: 10px; text-align: center; color: var(--text-muted);">Nenhum cadastro pendente</td></tr>`;

  listAtivos.innerHTML = ativos.map(f => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${escHtml(f.nome)}</td>
        <td style="padding: 10px;">${escHtml(f.usuario)}</td>
        <td style="padding: 10px;">${escHtml(f.cargo)}</td>
        <td style="padding: 10px;">
          <button onclick="window.abrirModalEditarFuncionario(${f.id})" style="color: #2b5c9e; border: none; background: none; cursor: pointer; margin-right: 10px;"><i class="ph ph-pencil"></i> Editar</button>
            <button onclick="window.deleteFuncionario(${f.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
});

// Global functions for inline onclicks
window.deleteMesa = async (id) => { if (await chefConfirm('Excluir mesa?', 'Esta ação não pode ser desfeita.', { danger: true, okText: 'Excluir' })) socket.emit('delete_mesa', id); };
window.deleteProduto = async (id) => { if (await chefConfirm('Excluir produto?', 'Esta ação não pode ser desfeita.', { danger: true, okText: 'Excluir' })) socket.emit('delete_produto', id); };

window.editProduto = (id, categoria, nome, preco, emoji, setor, status_inicial) => {
  document.getElementById('admin-prod-id').value = id;
  document.getElementById('admin-prod-cat').value = categoria;
  document.getElementById('admin-prod-nome').value = nome;
  document.getElementById('admin-prod-preco').value = preco;
  document.getElementById('admin-prod-emoji').value = emoji;
  document.getElementById('admin-prod-setor').value = setor;
  const siEl = document.getElementById('admin-prod-status-inicial');
  if (siEl) siEl.value = status_inicial || 'Em espera';
  const btn = document.getElementById('btn-admin-add-prod');
  if (btn) btn.innerHTML = '<i class="ph ph-check"></i> Salvar';
};

window.deleteFuncionario = async (id) => { if (await chefConfirm('Excluir funcionário?', 'Esta ação não pode ser desfeita.', { danger: true, okText: 'Excluir' })) socket.emit('delete_funcionario', id); };
window.aprovarFuncionario = (id) => {
  solicitarAutorizacaoAdmin('Aprovar Colaborador', (senha) => {
    let cargoSelect = document.getElementById('cargo-pendente-' + id);
    let cargo = cargoSelect ? cargoSelect.value : 'Garçom'; let vInput = document.getElementById('valor-pendente-' + id); let valor_hora = vInput ? parseFloat(vInput.value) || 0 : 0;
    socket.emit('aprovar_funcionario', { id: id, cargo: cargo, valor_hora: valor_hora, senha });
  });
};
window.recusarFuncionario = async (id) => { if (await chefConfirm('Recusar colaborador?', 'O colaborador será removido do sistema.', { danger: true, okText: 'Recusar' })) socket.emit('recusar_funcionario', id); };

// Add Listeners
const addMesaBtn = document.getElementById('btn-admin-add-mesa');
if (addMesaBtn) addMesaBtn.onclick = () => {
  const nome = document.getElementById('admin-mesa-nome').value;
  if (nome) { socket.emit('add_mesa', nome); document.getElementById('admin-mesa-nome').value = ''; }
};

const addProdBtn = document.getElementById('btn-admin-add-prod');
if (addProdBtn) addProdBtn.onclick = () => {
  const id = document.getElementById('admin-prod-id').value;
  const categoria = document.getElementById('admin-prod-cat').value;
  const nome = document.getElementById('admin-prod-nome').value;
  const preco = parseFloat(document.getElementById('admin-prod-preco').value);
  const emoji = document.getElementById('admin-prod-emoji').value;
  const setor = document.getElementById('admin-prod-setor').value || 'Cozinha 1';
  const siEl = document.getElementById('admin-prod-status-inicial');
  const status_inicial = siEl ? siEl.value : 'Em espera';

  if (categoria && nome && !isNaN(preco)) {
    if (id) {
      socket.emit('edit_produto', { id, categoria, nome, preco, emoji: emoji || '🍔', setor, status_inicial });
    } else {
      socket.emit('add_produto', { categoria, nome, preco, emoji: emoji || '🍔', hasAddons: false, setor, status_inicial });
    }
    document.getElementById('admin-prod-id').value = '';
    document.getElementById('admin-prod-nome').value = '';
    document.getElementById('admin-prod-preco').value = '';
    document.getElementById('admin-prod-emoji').value = '';
    if (siEl) siEl.value = 'Em espera';
    addProdBtn.innerHTML = '<i class="ph ph-plus"></i>';
  }
};

const addFuncBtn = document.getElementById('btn-admin-add-func');
if (addFuncBtn) addFuncBtn.onclick = () => {
  const nome = document.getElementById('admin-func-nome').value;
  const usuario = document.getElementById('admin-func-user').value;
  const senha = document.getElementById('admin-func-pass').value;
  const cargo = document.getElementById('admin-func-cargo').value;
  if (nome && usuario && senha) {
    const valor_hora = parseFloat(document.getElementById('admin-func-valor-hora').value) || 0; socket.emit('add_funcionario', { nome, usuario, senha, cargo, valor_hora });
    document.getElementById('admin-func-nome').value = '';
    document.getElementById('admin-func-user').value = '';
    document.getElementById('admin-func-pass').value = '';
  }
};

// Cliente por mesa (identificado pelo QR da mesa)
socket.on('mesa_clientes_atualizados', (lista) => {
  if (!window.mesaClientes) window.mesaClientes = {};
  window.mesaClientes = {};
  (lista || []).forEach(m => {
    if (m.mesa && m.cliente_nome) window.mesaClientes[m.mesa] = m;
  });
  if (typeof renderOrders === 'function') renderOrders();
});

// Clientes
socket.on('clientes_atualizados', (lista) => {
  const tbody = document.getElementById('admin-clientes-list');
  if (!tbody) return;
  tbody.innerHTML = lista.map(c => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${c.id}</td>
        <td style="padding: 10px;">${c.nome}<br><small style="color:gray;">Nasc: ${c.data_nascimento ? new Date(c.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</small></td>
        <td style="padding: 10px;">${c.telefone || '-'}<br><small style="color:gray;">End: ${c.endereco || '-'}</small></td>
        <td style="padding: 10px; max-width: 150px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${c.observacao || ''}">${c.observacao || '-'}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: #3ab55b;">â­ ${c.pontos || 0}</td>
        <td style="padding: 10px;">
          <button onclick="window.editCliente(${c.id}, '${c.nome.replace(/'/g, "\\'")}', '${c.telefone || ''}', '${(c.observacao || '').replace(/'/g, "\\'")}', '${(c.endereco || '').replace(/'/g, "\\'")}', '${c.data_nascimento || ''}')" style="color: #2D9CDB; border: none; background: none; cursor: pointer; margin-right: 8px;"><i class="ph ph-pencil"></i></button>
          <button onclick="window.deleteCliente(${c.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i></button>
        </td>
      </tr>
    `).join('');
});

window.editCliente = (id, nome, telefone, observacao, endereco, nascimento) => {
  document.getElementById('admin-cli-id').value = id;
  document.getElementById('admin-cli-nome').value = nome;
  document.getElementById('admin-cli-tel').value = telefone;
  document.getElementById('admin-cli-obs').value = observacao;
  document.getElementById('admin-cli-endereco').value = endereco;
  document.getElementById('admin-cli-nascimento').value = nascimento;
  const btn = document.getElementById('btn-admin-add-cli');
  if (btn) btn.innerText = 'Atualizar';
};

// Promocoes
socket.on('promocoes_atualizadas', (lista) => {
  window.PROMOCOES = lista;
  const tbody = document.getElementById('admin-promocoes-list');
  if (!tbody) return;
  tbody.innerHTML = lista.map(p => {
    let cfg = {};
    try { cfg = JSON.parse(p.config || '{}'); } catch (e) { }

    let diasStr = cfg.dias_semana ? cfg.dias_semana.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ') : 'Todos';
    let horaStr = (cfg.horario_inicio && cfg.horario_fim) ? `${cfg.horario_inicio} às ${cfg.horario_fim}` : 'Sempre';
    let regraStr = `Tipo: ${cfg.tipo_promocao}<br><small>${diasStr} | ${horaStr}</small>`;

    return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${p.nome}</td>
        <td style="padding: 10px;">${cfg.tipo_promocao === 'combo' ? 'Combo' : (cfg.tipo_promocao === 'livre' ? 'Rodízio' : 'Desconto/Preço')}</td>
        <td style="padding: 10px;">${regraStr}</td>
        <td style="padding: 10px;">
          <button onclick="window.deletePromocao(${p.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
      `;
  }).join('');
});

window.deleteCliente = async (id) => { if (await chefConfirm('Excluir cliente?', 'Dados do cliente serão removidos.', { danger: true, okText: 'Excluir' })) socket.emit('delete_cliente', id); };
window.deletePromocao = async (id) => { if (await chefConfirm('Excluir promoção?', 'Esta promoção será removida permanentemente.', { danger: true, okText: 'Excluir' })) socket.emit('delete_promocao', id); };

const addCliBtn = document.getElementById('btn-admin-add-cli');
if (addCliBtn) addCliBtn.onclick = () => {
  const id = document.getElementById('admin-cli-id').value;
  const nome = document.getElementById('admin-cli-nome').value;
  const telefone = document.getElementById('admin-cli-tel').value;
  const observacao = document.getElementById('admin-cli-obs').value;
  const endereco = document.getElementById('admin-cli-endereco').value;
  const data_nascimento = document.getElementById('admin-cli-nascimento').value;

  if (nome) {
    socket.emit('add_cliente', { id: id || null, nome, telefone, observacao, endereco, data_nascimento });
    document.getElementById('admin-cli-id').value = '';
    document.getElementById('admin-cli-nome').value = '';
    document.getElementById('admin-cli-tel').value = '';
    document.getElementById('admin-cli-obs').value = '';
    document.getElementById('admin-cli-endereco').value = '';
    document.getElementById('admin-cli-nascimento').value = '';
    addCliBtn.innerText = 'Salvar';
  }
};

window.togglePromoFields = () => {
  const tipo = document.getElementById('admin-promo-tipo').value;
  document.getElementById('promo-fields-desconto').style.display = tipo === 'desconto_fixo' ? 'block' : 'none';
  document.getElementById('promo-fields-produto').style.display = tipo === 'preco_fixo' ? 'flex' : 'none';
  document.getElementById('promo-fields-combo').style.display = tipo === 'combo' ? 'flex' : 'none';
  document.getElementById('promo-fields-livre').style.display = tipo === 'livre' ? 'block' : 'none';

  // Combo tbm precisa do produto alvo
  if (tipo === 'combo') {
    document.getElementById('promo-fields-produto').style.display = 'flex';
    document.getElementById('admin-promo-novopreco').style.display = 'none'; // combo pode não alterar preço do principal
  } else {
    const elPreco = document.getElementById('admin-promo-novopreco');
    if (elPreco) elPreco.style.display = 'block';
  }
};

const addPromoBtn = document.getElementById('btn-admin-add-promo');
if (addPromoBtn) addPromoBtn.onclick = () => {
  const nome = document.getElementById('admin-promo-nome').value;
  if (!nome) return alert('Nome da promoção obrigatório!');

  const config = {
    tipo_promocao: document.getElementById('admin-promo-tipo').value,
    dias_semana: Array.from(document.querySelectorAll('#admin-promo-dias input:checked')).map(cb => parseInt(cb.value)),
    horario_inicio: document.getElementById('admin-promo-inicio').value || null,
    horario_fim: document.getElementById('admin-promo-fim').value || null,
  };

  let desconto = 0;

  if (config.tipo_promocao === 'desconto_fixo') {
    desconto = parseFloat(document.getElementById('admin-promo-desc').value) || 0;
  } else if (config.tipo_promocao === 'preco_fixo') {
    config.produto_alvo_nome = document.getElementById('admin-promo-alvo').value.trim();
    config.novo_preco = parseFloat(document.getElementById('admin-promo-novopreco').value) || 0;
  } else if (config.tipo_promocao === 'combo') {
    config.produto_alvo_nome = document.getElementById('admin-promo-alvo').value.trim();
    config.produto_brinde_nome = document.getElementById('admin-promo-brinde').value.trim();
  } else if (config.tipo_promocao === 'livre') {
    const cats = document.getElementById('admin-promo-cats').value.split(',').map(s => s.trim()).filter(s => s);
    config.categorias_inclusas = cats;
  }

  socket.emit('add_promocao', { nome, regra: config.tipo_promocao, desconto, ativo: true, config: JSON.stringify(config) });

  document.getElementById('admin-promo-nome').value = '';
  document.querySelectorAll('#admin-promo-dias input').forEach(cb => cb.checked = false);
};

// System Alert for "Pedir Conta"
socket.on('toque_pedir_conta', (mesaName) => {
  try {
    const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
    audio.play();
  } catch (e) { }
  alert('🔔 A ' + mesaName + ' está pedindo a conta!');
});

document.addEventListener('DOMContentLoaded', () => {
  // --- LÓGICA DO MODAL DE PAGAMENTO ---
  let modalPaymentValue = 0; // valor em centavos
  let isPaymentModalOpen = false;

  function updatePaymentDisplay() {
    const display = document.getElementById('pagamento-display-input');
    if (!display) return;
    const reais = (modalPaymentValue / 100).toFixed(2).replace('.', ',');
    display.innerText = reais;
  }

  function appendDigit(digit) {
    const str = modalPaymentValue.toString();
    if (str.length < 9) { // max limit approx 999.999,99
      if (digit === '00') {
        modalPaymentValue = parseInt(str + '00', 10);
      } else {
        modalPaymentValue = parseInt(str + digit, 10);
      }
      updatePaymentDisplay();
    }
  }

  function backspaceDigit() {
    const str = modalPaymentValue.toString();
    if (str.length <= 1) {
      modalPaymentValue = 0;
    } else {
      modalPaymentValue = parseInt(str.slice(0, -1), 10);
    }
    updatePaymentDisplay();
  }

  const btnAbrirModal = document.getElementById('btn-abrir-modal-pagamento');
  const btnFecharModal = document.getElementById('btn-fechar-modal-pagamento');
  const modalPagamento = document.getElementById('pagamento-overlay');

  if (btnAbrirModal) {
    btnAbrirModal.onclick = () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      isPaymentModalOpen = true;
      modalPaymentValue = 0;
      updatePaymentDisplay();
      if (window.calcRestante) window.calcRestante(); // Refresh labels
      modalPagamento.style.display = 'flex';
    };
  }

  if (btnFecharModal) {
    btnFecharModal.onclick = () => {
      isPaymentModalOpen = false;
      modalPagamento.style.display = 'none';
    };
  }

  document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute('data-val');
      if (val === 'BACKSPACE') {
        backspaceDigit();
      } else {
        appendDigit(val);
      }
    };
  });

  document.addEventListener('keydown', (e) => {
    if (!isPaymentModalOpen) return;
    // Captura números do teclado físico
    if (e.key >= '0' && e.key <= '9') {
      appendDigit(e.key);
    } else if (e.key === 'Backspace') {
      backspaceDigit();
    }
  });

  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.onclick = () => {
      if (!window.pagamentosParciais) window.pagamentosParciais = [];
      const metodo = btn.getAttribute('data-method');
      const valor = modalPaymentValue / 100;

      if (valor > 0) {
        window.pagamentosParciais.push({ metodo, valor });
        modalPaymentValue = 0;
        updatePaymentDisplay();
        if (window.calcRestante) window.calcRestante();
      } else {
        // Se o operador clicou no método com visor zerado, e há um restante, auto-preencher?
        // Vamos permitir que ele digite o valor antes de clicar.
        const faltaTexto = document.getElementById('modal-restante').innerText.replace('R$ ', '').replace('.', '').replace(',', '.');
        const falta = parseFloat(faltaTexto);
        if (falta > 0) {
          window.pagamentosParciais.push({ metodo, valor: falta });
          if (window.calcRestante) window.calcRestante();
        }
      }
    };
  });
});

window.zoomQrPonto = function () {
  const mainImg = document.getElementById('qr-ponto-img');
  const zoomImg = document.getElementById('qr-ponto-img-zoomed');
  const modal = document.getElementById('modal-zoom-qr-ponto');
  if (mainImg && zoomImg && modal) {
    zoomImg.src = mainImg.src;
    modal.style.display = 'flex';
  }
};

// --- Resizable Panels Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const resizerLeft = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');

  // Load saved widths
  const savedLeftWidth = localStorage.getItem('leftPanelWidth');
  const savedRightWidth = localStorage.getItem('rightPanelWidth');
  if (savedLeftWidth && leftPanel) leftPanel.style.width = savedLeftWidth + 'px';
  if (savedRightWidth && rightPanel) rightPanel.style.width = savedRightWidth + 'px';

  // Resizer Left
  if (resizerLeft && leftPanel) {
    let isResizingLeft = false;
    const initLeftDrag = () => {
      isResizingLeft = true;
      resizerLeft.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };
    resizerLeft.addEventListener('mousedown', (e) => initLeftDrag());
    resizerLeft.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) initLeftDrag();
    }, { passive: true });

    const doLeftDrag = (clientX) => {
      if (!isResizingLeft) return;
      let newWidth = clientX;
      if (newWidth < 150) newWidth = 150;
      if (newWidth > 500) newWidth = 500;
      leftPanel.style.width = newWidth + 'px';
      localStorage.setItem('leftPanelWidth', newWidth);
    };
    document.addEventListener('mousemove', (e) => doLeftDrag(e.clientX));
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) doLeftDrag(e.touches[0].clientX);
    }, { passive: false });

    const stopLeftDrag = () => {
      if (isResizingLeft) {
        isResizingLeft = false;
        resizerLeft.classList.remove('dragging');
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };
    document.addEventListener('mouseup', stopLeftDrag);
    document.addEventListener('touchend', stopLeftDrag);
  }

  // Resizer Right
  if (resizerRight && rightPanel) {
    let isResizingRight = false;
    const initRightDrag = () => {
      isResizingRight = true;
      resizerRight.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };
    resizerRight.addEventListener('mousedown', (e) => initRightDrag());
    resizerRight.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) initRightDrag();
    }, { passive: true });

    const doRightDrag = (clientX) => {
      if (!isResizingRight) return;
      let newWidth = window.innerWidth - clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 600) newWidth = 600;
      rightPanel.style.width = newWidth + 'px';
      localStorage.setItem('rightPanelWidth', newWidth);
    };
    document.addEventListener('mousemove', (e) => doRightDrag(e.clientX));
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) doRightDrag(e.touches[0].clientX);
    }, { passive: false });

    const stopRightDrag = () => {
      if (isResizingRight) {
        isResizingRight = false;
        resizerRight.classList.remove('dragging');
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };
    document.addEventListener('mouseup', stopRightDrag);
    document.addEventListener('touchend', stopRightDrag);
  }
});

// --- Sidebar Actions Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const btnConta = document.getElementById('btn-imprimir-conta');
  const btnDesconto = document.getElementById('btn-aplicar-desconto');
  const btnServico = document.getElementById('btn-aplicar-servico');
  const btnComissao = document.getElementById('btn-ver-comissao');
  const btnAgrupar = document.getElementById('btn-agrupar-itens');

  if (btnConta) {
    const btnCliente = document.getElementById('btn-mostrar-conta-cliente');
    if (btnCliente) {
      btnCliente.addEventListener('click', () => {
        if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');
        const nomeMesa = window.mesaAtual.nome || window.mesaAtual.mesaName;
        window.open('conta-cliente.html?mesa=' + encodeURIComponent(nomeMesa), '_blank');
      });
    }
    btnConta.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      let itemsHtml = window.mesaAtual.items.map(i => `
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
          <span>${i.quantity || 1}x ${i.productName}</span>
          <span>R$ ${parseFloat(String(i.total).replace(',', '.')).toFixed(2).replace('.', ',')}</span>
        </div>
      `).join('');

      const subtotal = window.mesaAtual.total;
      const taxaVal = window.servicoAdicional + (document.getElementById('taxa-servico')?.checked ? Math.max(0, subtotal - window.descontoAdicional) * 0.1 : 0);
      const totalFinal = subtotal - window.descontoAdicional + taxaVal;

      printWindow.document.write(`
        <html><head><style>
          body { font-family: monospace; padding: 20px; width: 300px; color: #000; background: var(--bg-card); }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
        </style></head><body>
          <div class="center bold" style="font-size:16px;">CHEF COZINHA</div>
          <div class="center" style="margin-bottom:10px;">CONFERÊNCIA DE MESA</div>
          <div>Mesa: <span class="bold">${window.mesaAtual.isGroup ? window.mesaAtual.mesaName : window.mesaAtual.nome}</span></div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>R$ ${subtotal.toFixed(2).replace('.', ',')}</span></div>
          ${window.descontoAdicional > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Desconto:</span><span>- R$ ${window.descontoAdicional.toFixed(2).replace('.', ',')}</span></div>` : ''}
          ${taxaVal > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Serviços/Taxas:</span><span>R$ ${taxaVal.toFixed(2).replace('.', ',')}</span></div>` : ''}
          <div class="divider"></div>
          <div class="bold" style="display:flex; justify-content:space-between; font-size:14px;"><span>TOTAL:</span><span>R$ ${totalFinal.toFixed(2).replace('.', ',')}</span></div>
          <div class="center" style="margin-top:20px; font-size:10px;">Obrigado pela preferência!</div>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    });
  }

  if (btnDesconto) {
    btnDesconto.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      if (window.mesaAtual.isGroup === false) return alert('Selecione uma mesa com pedidos ativos.');
      const modal = document.getElementById('modal-aplicar-desconto');
      if (modal) {
        document.getElementById('input-desconto-valor').value = '';
        document.getElementById('select-tipo-desconto').value = 'reais';
        document.getElementById('select-motivo-desconto').value = 'Cortesia da Casa';
        document.getElementById('input-motivo-desconto-outro').style.display = 'none';
        document.getElementById('lbl-tipo-desconto').innerText = 'R$';
        modal.style.display = 'flex';
      }
    });
  }

  if (btnServico) {
    btnServico.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const val = prompt('Digite o valor de serviço/couvert extra em R$ (Ex: 10.00):');
      if (val) {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          window.servicoAdicional = num;
          if (window.calcularTotal) window.calcularTotal();
          if (window.calcRestante) window.calcRestante();
        }
      }
    });
  }
});

window.aplicarDesconto = function() {
  const modal = document.getElementById('modal-aplicar-desconto');
  if (!modal) return;

  const valor = parseFloat(document.getElementById('input-desconto-valor').value.replace(',', '.'));
  const tipo = document.getElementById('select-tipo-desconto').value;
  const motivoRaw = document.getElementById('select-motivo-desconto').value;
  const motivo = motivoRaw === 'Outro'
    ? (document.getElementById('input-motivo-desconto-outro').value || '').trim()
    : motivoRaw;

  if (isNaN(valor) || valor <= 0) return alert('Informe um valor de desconto válido.');
  if (!motivo) return alert('Informe o motivo do desconto.');

  let descontoFinal = valor;
  if (tipo === 'porcentagem') {
    const subtotal = window.mesaAtual ? (window.mesaAtual.totalBruto || window.mesaAtual.total || 0) : 0;
    descontoFinal = subtotal * (valor / 100);
  }

  window.descontoAdicional = descontoFinal;
  if (window.calcularTotal) window.calcularTotal();
  if (window.calcRestante) window.calcRestante();

  modal.style.display = 'none';
};

window.removerDescontoAplicado = function() {
  window.descontoAdicional = 0;
  if (window.calcularTotal) window.calcularTotal();
  if (window.calcRestante) window.calcRestante();
  const modal = document.getElementById('modal-aplicar-desconto');
  if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
  // --- TOP MENUBAR DROPDOWNS ---
  document.querySelectorAll('.menu-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
      const dropdownId = trigger.getAttribute('data-dropdown');
      if (dropdownId) {
        document.getElementById(dropdownId).classList.toggle('show');
      }
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
  });

  const mnuAbrir = document.getElementById('menu-abrir-caixa');
  if (mnuAbrir) mnuAbrir.onclick = () => {
    const b = document.getElementById('btn-abrir-caixa');
    if (b) b.click();
    else {
      // if not in DOM, maybe we need to emit directly
      const val = prompt('Qual o valor inicial do caixa?');
      if (val !== null) {
        const senhaAdmin = prompt('Digite a senha de administrador para abrir o caixa:');
        if (!senhaAdmin) return alert('Operação cancelada.');
        socket.emit('abrir_caixa', { fundo_troco: parseFloat(val) || 0, operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido', senha: senhaAdmin });
      }
    }
  };

  const mnuFechar = document.getElementById('menu-fechar-caixa');
  if (mnuFechar) mnuFechar.onclick = () => {
    const b = document.getElementById('btn-fechar-caixa');
    if (b) b.click();
    else {
      const senhaAdmin = prompt('Digite a senha de administrador para fechar o caixa:');
      if (!senhaAdmin) return alert('Operação cancelada.');
      socket.emit('fechar_caixa', { operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido', senha: senhaAdmin });
    }
  };

  const btnMovParcial = document.getElementById('btn-movimento-parcial');
  if (btnMovParcial) {
    btnMovParcial.onclick = () => {
      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ou comanda ocupada primeiro.');
      if (typeof window.switchMobileTab === 'function') window.switchMobileTab('pedido');
      window.abrirCheckoutModal();
      setTimeout(() => {
        const inputVal = document.getElementById('checkout-modal-valor');
        if (inputVal) inputVal.focus();
      }, 150);
    };
  }

  const btnMovConcluir = document.getElementById('btn-movimento-concluir');
  if (btnMovConcluir) {
    btnMovConcluir.onclick = () => {
      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ou comanda ocupada primeiro.');
      if (typeof window.switchMobileTab === 'function') window.switchMobileTab('pedido');
      window.abrirCheckoutModal();
    };
  }

  const mnuConfig = document.getElementById('menu-configuracoes');
  if (mnuConfig) mnuConfig.onclick = () => { window.location.href = '/configuracoes.html'; };
  const mnuCad = document.getElementById('menu-cadastro');
  if (mnuCad) {
    mnuCad.onclick = (e) => {
      if (e) e.stopPropagation();
      if (typeof window.abrirModalCadastro === 'function') {
        window.abrirModalCadastro();
      } else {
        const m = document.getElementById('modal-central-cadastro');
        if (m) m.style.display = 'flex';
      }
    };
  }

  const mnuAjuda = document.getElementById('menu-ajuda');
  if (mnuAjuda) {
    mnuAjuda.onclick = () => {
      if (typeof window.abrirGuiaAtalhos === 'function') {
        window.abrirGuiaAtalhos();
      } else {
        const m = document.getElementById('modal-guia-atalhos');
        if (m) m.style.display = 'flex';
      }
    };
  }

  // --- KEYBOARD SHORTCUTS ---
  document.addEventListener('keydown', (e) => {
    // ESC - Voltar / Fechar Telas
    if (e.key === 'Escape') {
      let closedSomething = false;
      const overlays = [
        document.getElementById('pdv-overlay'),
        document.getElementById('admin-overlay'),
        document.getElementById('ajuda-overlay'),
        document.getElementById('relatorios-overlay'),
        document.getElementById('financeiro-overlay')
      ];
      overlays.forEach(overlay => {
        if (overlay && overlay.style.display === 'flex') {
          overlay.style.display = 'none';
          closedSomething = true;
        }
      });
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu.classList.contains('show')) {
          menu.classList.remove('show');
          closedSomething = true;
        }
      });
      // Se não fechou nenhum modal, pode ser que ele queira voltar a página
      if (!closedSomething && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        // Opcional: voltar caso esteja em outra tela e use main.js
      }
    }
    // Ctrl + O - Fila de Pedidos
    else if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      window.location.href = 'fila.html';
    }
    // F2 - Venda Rapida (Balcao)
    else if (e.key === 'F2') {
      e.preventDefault();
      document.getElementById('toolbar-balcao')?.click();
    }
    // F3 - Delivery
    else if (e.key === 'F3') {
      e.preventDefault();
      document.getElementById('toolbar-delivery')?.click();
    }
    // F4 - Finalizar Venda
    else if (e.key === 'F4') {
      e.preventDefault();
      document.getElementById('btn-finalizar-venda')?.click();
    }
  });

  // --- RELATORIOS OVERLAY ---
  const mnuRel = document.getElementById('menu-relatorios');
  if (mnuRel) {
    mnuRel.onclick = () => {
      window.location.href = '/financeiro.html?tab=relatorio';
    };
  }

  // --- FINANCEIRO OVERLAY ---
  const mnuFin = document.getElementById('menu-financeiro');
  if (mnuFin) {
    mnuFin.onclick = () => {
      window.location.href = '/financeiro.html';
    };
  }

  const btnAddDespesa = document.getElementById('btn-financeiro-add-despesa');
  if (btnAddDespesa) {
    btnAddDespesa.onclick = () => {
      const desc = document.getElementById('financeiro-despesa-desc').value;
      const val = parseFloat(document.getElementById('financeiro-despesa-valor').value);
      if (!desc || !val) return alert('Preencha descrição e valor!');
      socket.emit('add_despesa', { valor: val, descricao: desc, operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido' });
      document.getElementById('financeiro-despesa-desc').value = '';
      document.getElementById('financeiro-despesa-valor').value = '';
    };
  }

  // --- MERCADO PAGO CANCEL BUTTON ---
  const btnCancelMp = document.getElementById('btn-mp-cancel-payment');
  if (btnCancelMp) {
    btnCancelMp.onclick = () => {
      socket.emit('mp_cancelar_pagamento');
      const overlay = document.getElementById('modal-mp-pagamento');
      if (overlay) overlay.style.display = 'none';
    };
  }
});

socket.on('relatorios_atualizados', (data) => {
  const elTotal = document.getElementById('relatorios-total-geral');
  if (elTotal) elTotal.innerText = 'R$ ' + (data.total || 0).toFixed(2).replace('.', ',');
  const elProd = document.getElementById('relatorios-produtos-list');
  if (elProd) elProd.innerHTML = data.produtos.map(p => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${p.productName}</td>
      <td style="padding: 10px;">${p.qtd}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(p.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
  const elGarc = document.getElementById('relatorios-garcons-list');
  if (elGarc) elGarc.innerHTML = data.garcons.map(g => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${g.userName}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(g.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
  const elMesas = document.getElementById('relatorios-mesas-list');
  if (elMesas) elMesas.innerHTML = (data.mesas || []).map(m => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${m.localName || 'Avulso'}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(m.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
});

socket.on('financeiro_atualizado', (rows) => {
  const elList = document.getElementById('financeiro-extrato-list');
  if (elList) {
    elList.innerHTML = rows.map(r => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">${new Date(r.data).toLocaleString('pt-BR')}</td>
          <td style="padding: 10px;">${r.tipo === 'Entrada' ? '<span style="color:#3ab55b; font-weight:bold;">Entrada</span>' : '<span style="color:#eb5757; font-weight:bold;">Saída</span>'}</td>
          <td style="padding: 10px;">${r.descricao}</td>
          <td style="padding: 10px;">${r.forma_pagamento}</td>
          <td style="padding: 10px; text-align: right; font-weight:bold; color: ${r.tipo === 'Entrada' ? '#3ab55b' : '#eb5757'}">R$ ${(r.valor || 0).toFixed(2).replace('.', ',')}</td>
        </tr>`).join('');
  }
});


// --- UPDATE STATUS BAR AND PERMANENCIA PERIODICALLY ---
setInterval(() => {
  // Permanencia
  if (window.updatePermanencia && window.mesaAtual && window.mesaAtual.isGroup) {
    window.updatePermanencia();
  }

  // Footer Stats
  const elMesas = document.getElementById('status-mesas-count');
  const elComandas = document.getElementById('status-comandas-count');
  const elUser = document.getElementById('status-user-name');
  const elCaixa = document.getElementById('status-caixa-name');

  if (elMesas && window.allMesas) {
    const ocupadas = window.allMesas.filter(m => m.status !== 'Disponível').length;
    elMesas.innerText = ocupadas + ' / ' + window.allMesas.length;
  }

  if (elComandas && typeof ordersData !== 'undefined') {
    const uniqueComandas = new Set(ordersData.map(o => o.mesa_grupo || o.localName || o.id));
    elComandas.innerText = uniqueComandas.size;
  }

  if (elUser) {
    const creds = (localStorage.getItem('chef_session') || localStorage.getItem('chef_credentials'));
    if (creds) {
      try {
        const parsed = JSON.parse(creds);
        window.loggedInUser = parsed.nome || parsed.usuario;
      } catch (e) { }
    } else {
      window.loggedInUser = null;
    }
    elUser.innerText = window.loggedInUser || 'Não logado';
  }

  // Caixa could be updated if we receive it. 
  // Just keep it static "Caixa 1" for now or show "Aberto"/"Fechado"
}, 15000); // 15 seconds

// --- Backup & Restore (Admin Modal) ---
window.downloadBackup = () => {
  if (!confirm('Deseja baixar o arquivo de backup agora?')) return;
  // O endpoint /api/backup retorna o arquivo diretamente
  window.location.href = '/api/backup';
};

window.uploadRestore = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm(`ATENÇÃO: Você está prestes a restaurar o banco de dados usando o arquivo "${file.name}".\nIsso apagará irreversivelmente todas as vendas, alterações de produtos e mesas que ocorreram DEPOIS que este backup foi gerado.\n\nTem certeza absoluta que deseja prosseguir?`)) {
    event.target.value = ''; // reseta
    return;
  }

  const formData = new FormData();
  formData.append('backup', file);
  const confirmacao = prompt('Confirmação de segurança: informe a senha de um administrador para restaurar o banco de dados.');
  if (!confirmacao) {
    event.target.value = '';
    return;
  }
  formData.append('confirmacao', confirmacao);

  try {
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('chef_token') || ''}` },
      body: formData
    });

    if (res.ok) {
      alert('Backup restaurado com sucesso! O sistema será recarregado.');
      window.location.reload();
    } else {
      const errText = await res.text();
      alert('Falha ao restaurar: ' + errText);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao tentar restaurar o backup.');
  } finally {
    event.target.value = ''; // reseta
  }
};


// --- Reserva de Mesa ---
document.addEventListener('DOMContentLoaded', () => {
const btnReservarMesa = document.getElementById('btn-reservar-mesa');
const modalReserva = document.getElementById('modal-reserva');
const btnSalvarReserva = document.getElementById('btn-salvar-reserva');
const btnCancelarReserva = document.getElementById('btn-cancelar-reserva');
const btnRemoverReserva = document.getElementById('btn-remover-reserva');

if (btnReservarMesa) {
  btnReservarMesa.onclick = () => {
    if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
    if (window.mesaAtual.isGroup) return alert('No  possvel reservar uma mesa que j possui pedidos ativos.');

    // Check if already reserved
    if (window.mesaAtual.status === 'Reservada') {
      try {
        const obsObj = JSON.parse(window.mesaAtual.observacao || '{}');
        document.getElementById('reserva-cliente').value = obsObj.cliente || '';
        document.getElementById('reserva-telefone').value = obsObj.telefone || '';
        document.getElementById('reserva-pessoas').value = obsObj.pessoas || '2';
        document.getElementById('reserva-data').value = obsObj.data || '';
        document.getElementById('reserva-obs').value = obsObj.obs || '';
      } catch (e) {
        document.getElementById('reserva-obs').value = window.mesaAtual.observacao || '';
      }
      btnRemoverReserva.style.display = 'block';
      document.getElementById('modal-reserva-titulo').innerText = 'Editar Reserva: ' + (window.mesaAtual.nome || window.mesaAtual.mesaName);
    } else {
      document.getElementById('reserva-cliente').value = '';
      document.getElementById('reserva-telefone').value = '';
      document.getElementById('reserva-pessoas').value = '2';
      document.getElementById('reserva-data').value = '';
      document.getElementById('reserva-obs').value = '';
      btnRemoverReserva.style.display = 'none';
      document.getElementById('modal-reserva-titulo').innerText = 'Nova Reserva: ' + (window.mesaAtual.nome || window.mesaAtual.mesaName);
    }

    modalReserva.style.display = 'flex';
  };
}

if (btnCancelarReserva) {
  btnCancelarReserva.onclick = () => {
    modalReserva.style.display = 'none';
  };
}

if (btnSalvarReserva) {
  btnSalvarReserva.onclick = () => {
    const cliente = document.getElementById('reserva-cliente').value;
    const telefone = document.getElementById('reserva-telefone').value;
    const pessoas = document.getElementById('reserva-pessoas').value;
    const data = document.getElementById('reserva-data').value;
    const obs = document.getElementById('reserva-obs').value;

    if (!cliente) return alert('Preencha o nome do cliente.');

    const obsObj = {
      cliente,
      telefone,
      pessoas,
      data,
      obs
    };

    socket.emit('reservar_mesa', {
      mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName,
      observacao: JSON.stringify(obsObj),
      cliente,
      telefone
    });

    modalReserva.style.display = 'none';
  };
}

if (btnRemoverReserva) {
  btnRemoverReserva.onclick = () => {
    if (!confirm('Tem certeza que deseja cancelar esta reserva e liberar a mesa?')) return;
    socket.emit('cancelar_reserva', {
      mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName
    });
    modalReserva.style.display = 'none';
  };
}
});



// --- QR Code de Ponto ---
socket.on('update_ponto_token', (data) => {
  const img = document.getElementById('qr-ponto-img');
  const zoomedImg = document.getElementById('qr-ponto-img-zoomed');
  if (typeof window.qrImg === 'function') {
    if (img) window.qrImg(img, data.url, 300);
    if (zoomedImg) window.qrImg(zoomedImg, data.url, 300);
  } else {
    const qrUrl = (window.location.origin || '') + '/api/qr?size=300&data=' + encodeURIComponent(data.url);
    if (img) img.src = qrUrl;
    if (zoomedImg) zoomedImg.src = qrUrl;
  }
});


// --- Lógica Nova Comanda ---
window.abrirComandaNaMesa = (mesaName, comanda) => {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const findMesaCard = () => Array.from(document.querySelectorAll('.mesa-item')).find(c => {
    const idEl = c.querySelector('.mesa-id');
    return idEl && norm(idEl.innerText) === norm(mesaName);
  });
  let mesaCard = findMesaCard();
  const toolbarComandas = document.getElementById('toolbar-comandas');
  const inComandasView = toolbarComandas && toolbarComandas.classList.contains('active');
  if (!mesaCard && inComandasView) {
    const btnMesas = document.getElementById('toolbar-mesas');
    if (btnMesas) btnMesas.click();
    mesaCard = findMesaCard();
  }
  if (!mesaCard) {
    alert('Mesa "' + mesaName + '" não encontrada.');
    return;
  }
  mesaCard.click();
  setTimeout(() => {
    const rows = document.querySelectorAll('.comanda-racha-row');
    rows.forEach(r => {
      const label = r.querySelector('span');
      if (label && label.textContent.trim() === comanda) {
        r.style.outline = '2px solid #fc4b15';
        r.style.outlineOffset = '-2px';
        setTimeout(() => { r.style.outline = ''; }, 2500);
      }
    });
  }, 250);
};

window.abrirModalNovaComanda = () => {
  const modal = document.getElementById('modal-nova-comanda-ui');
  if (!modal) return;
  const inpNome = document.getElementById('nova-comanda-nome');
  const inpTel = document.getElementById('nova-comanda-telefone');
  if (inpNome) inpNome.value = '';
  if (inpTel) inpTel.value = '';
  modal.style.display = 'flex';
  setTimeout(() => { if (inpNome) inpNome.focus(); }, 100);
};

document.addEventListener('DOMContentLoaded', () => {
const btnNovaComanda = document.getElementById('btn-nova-comanda');
const modalNovaComanda = document.getElementById('modal-nova-comanda-ui');
const btnSalvarNovaComanda = document.getElementById('btn-salvar-nova-comanda');

if (btnNovaComanda) {
  btnNovaComanda.onclick = () => window.abrirModalNovaComanda();
}

if (btnSalvarNovaComanda) {
  btnSalvarNovaComanda.onclick = () => {
    const nome = document.getElementById('nova-comanda-nome').value.trim();
    const telefone = document.getElementById('nova-comanda-telefone').value.trim();
    if (!nome) return alert('Por favor, digite o nome do cliente.');

    socket.emit('nova_comanda_crm', { nome, telefone });
    modalNovaComanda.style.display = 'none';
  };
}

/* Criação rápida de comanda pela barra lateral direita */
const quickComandaBtn = document.getElementById('btn-quick-nova-comanda');
const quickComandaInput = document.getElementById('quick-comanda-nome');

function criarComandaRapida() {
  if (!quickComandaInput) return;
  const nome = quickComandaInput.value.trim();
  if (!nome) {
    quickComandaInput.focus();
    return alert('Digite o nome do cliente para criar a comanda.');
  }
  socket.emit('nova_comanda_crm', { nome, telefone: '' });
  quickComandaInput.value = '';
}

if (quickComandaBtn) quickComandaBtn.onclick = criarComandaRapida;
if (quickComandaInput) {
  quickComandaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      criarComandaRapida();
    }
  });
}
});

socket.on('comanda_criada_sucesso', ({ nomeMesa }) => {
  // Forçar a visualização para Comandas para o usuário ver a comanda criada
  window.viewFilter = 'Comandas';
  const btnToolbarComandas = document.getElementById('toolbar-comandas');
  if (btnToolbarComandas) btnToolbarComandas.click();

  // Auto-selecionar a mesa e abrir PDV
  setTimeout(() => {
    const cards = document.querySelectorAll('.mesa-item');
    let targetCard = null;
    cards.forEach(c => {
      if (c.querySelector('.mesa-id').innerText === nomeMesa) {
        targetCard = c;
      }
    });

    if (targetCard) {
      targetCard.click(); // Select
      const btnAdic = document.getElementById('btn-adicionar-produtos');
      if (btnAdic) btnAdic.click(); // Open PDV
    } else {
      // Fallback if not found visually immediately (socket delay)
      setTimeout(() => {
        const cards2 = document.querySelectorAll('.mesa-item');
        cards2.forEach(c => {
          if (c.querySelector('.mesa-id').innerText === nomeMesa) c.click();
        });
        const btnAdic = document.getElementById('btn-adicionar-produtos');
        if (btnAdic) btnAdic.click();
      }, 500);
    }
  }, 200);
});


window.abrirModalEditarFuncionario = (id) => {
  const func = (window.funcionariosList || []).find(f => f.id === id);
  if (!func) return;

  if (document.getElementById('edit-func-id')) document.getElementById('edit-func-id').value = func.id;
  if (document.getElementById('edit-func-nome')) document.getElementById('edit-func-nome').value = func.nome || '';
  if (document.getElementById('edit-func-usuario')) document.getElementById('edit-func-usuario').value = func.usuario || '';
  if (document.getElementById('edit-func-senha')) document.getElementById('edit-func-senha').value = '';
  if (document.getElementById('edit-func-cargo')) document.getElementById('edit-func-cargo').value = func.cargo || 'Garçom';

  const tipoRem = func.tipo_remuneracao || 'hora';
  const radios = document.getElementsByName('edit-func-tipo-rem');
  if (radios && radios.length) radios.forEach(r => { r.checked = (r.value === tipoRem); });

  if (document.getElementById('edit-func-valor-hora')) document.getElementById('edit-func-valor-hora').value = func.valor_hora || 0;
  if (document.getElementById('edit-func-valor-dia')) document.getElementById('edit-func-valor-dia').value = func.valor_dia || 0;
  if (document.getElementById('edit-func-valor-semana')) document.getElementById('edit-func-valor-semana').value = func.valor_semana || 0;
  if (document.getElementById('edit-func-valor-mes')) document.getElementById('edit-func-valor-mes').value = func.valor_mes || 0;

  if (document.getElementById('edit-func-pix')) document.getElementById('edit-func-pix').value = func.chave_pix || '';
  if (document.getElementById('edit-func-telefone')) document.getElementById('edit-func-telefone').value = func.telefone || '';
  if (document.getElementById('edit-func-cpf')) document.getElementById('edit-func-cpf').value = func.cpf || '';
  if (document.getElementById('edit-func-obs-rh')) document.getElementById('edit-func-obs-rh').value = func.observacao_rh || '';

  const modal = document.getElementById('modal-editar-funcionario');
  if (modal) modal.style.display = 'flex';
};

window.salvarEdicaoFuncionario = () => {
  const id = document.getElementById('edit-func-id') ? document.getElementById('edit-func-id').value : '';
  const nome = document.getElementById('edit-func-nome') ? document.getElementById('edit-func-nome').value.trim() : '';
  const usuario = document.getElementById('edit-func-usuario') ? document.getElementById('edit-func-usuario').value.trim() : '';
  const senha = document.getElementById('edit-func-senha') ? document.getElementById('edit-func-senha').value : '';
  const cargo = document.getElementById('edit-func-cargo') ? document.getElementById('edit-func-cargo').value : 'Garçom';

  let tipo_remuneracao = 'hora';
  const radios = document.getElementsByName('edit-func-tipo-rem');
  if (radios && radios.length) radios.forEach(r => { if (r.checked) tipo_remuneracao = r.value; });

  const valor_hora = parseFloat(document.getElementById('edit-func-valor-hora') ? document.getElementById('edit-func-valor-hora').value : 0) || 0;
  const valor_dia = parseFloat(document.getElementById('edit-func-valor-dia') ? document.getElementById('edit-func-valor-dia').value : 0) || 0;
  const valor_semana = parseFloat(document.getElementById('edit-func-valor-semana') ? document.getElementById('edit-func-valor-semana').value : 0) || 0;
  const valor_mes = parseFloat(document.getElementById('edit-func-valor-mes') ? document.getElementById('edit-func-valor-mes').value : 0) || 0;

  const chave_pix = document.getElementById('edit-func-pix') ? document.getElementById('edit-func-pix').value.trim() : '';
  const telefone = document.getElementById('edit-func-telefone') ? document.getElementById('edit-func-telefone').value.trim() : '';
  const cpf = document.getElementById('edit-func-cpf') ? document.getElementById('edit-func-cpf').value.trim() : '';
  const observacao_rh = document.getElementById('edit-func-obs-rh') ? document.getElementById('edit-func-obs-rh').value.trim() : '';

  if (!nome || !usuario || !cargo) return alert('Por favor, preencha o Nome, Usuário e Cargo!');

  socket.emit('update_funcionario', {
    id, nome, usuario, senha, cargo, tipo_remuneracao, valor_hora, valor_dia, valor_semana, valor_mes, chave_pix, telefone, cpf, observacao_rh
  });

  const modal = document.getElementById('modal-editar-funcionario');
  if (modal) modal.style.display = 'none';
};

// Initial Footer Sync
setTimeout(() => {
  const elUser = document.getElementById('status-user-name');
  if (elUser) {
    const creds = (localStorage.getItem('chef_session') || localStorage.getItem('chef_credentials'));
    if (creds) {
      try {
        const parsed = JSON.parse(creds);
        window.loggedInUser = parsed.nome || parsed.usuario;
      } catch (e) { }
    } else {
      window.loggedInUser = null;
    }
    elUser.innerText = window.loggedInUser || 'Não logado';
  }
}, 500);



// --- TOUCH SCREEN CHECKOUT CONTROLS ---
window.checkoutModalTouchModeActive = false;
window.checkoutModalCents = 0;
window._checkoutAutoFilled = false;

window.checkoutModalToggleTouchMode = (forcedState) => {
  if (typeof forcedState === 'boolean') {
    window.checkoutModalTouchModeActive = forcedState;
  } else {
    window.checkoutModalTouchModeActive = !window.checkoutModalTouchModeActive;
  }

  const btn = document.getElementById('checkout-modal-toggle-touch-btn');
  const standardContainer = document.getElementById('checkout-modal-standard-container');
  const touchContainer = document.getElementById('checkout-modal-touch-container');
  const isDark = document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-theme') === 'dark';

  if (btn) {
    if (window.checkoutModalTouchModeActive) {
      btn.style.background = '#fc4b15';
      btn.style.borderColor = '#fc4b15';
      btn.style.color = 'white';
      btn.querySelector('span').innerText = 'Modo Touch: ON';
    } else {
      btn.style.background = '#edf2f7';
      btn.style.borderColor = '#cbd5e0';
      btn.style.color = '#4a5568';
      btn.querySelector('span').innerText = 'Modo Touch: OFF';
    }
  }

  if (standardContainer) standardContainer.style.display = window.checkoutModalTouchModeActive ? 'none' : 'block';
  if (touchContainer) touchContainer.style.display = window.checkoutModalTouchModeActive ? 'flex' : 'none';

  // Sync values
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    const parseCurrencyInput = (valStr) => {
      let clean = valStr.trim().replace('R$', '').replace(/\s/g, '');
      if (clean.includes('.') && clean.includes(',')) {
        if (clean.indexOf('.') < clean.indexOf(',')) {
          clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      } else if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
          // decimal dot
        } else {
          clean = clean.replace(/\./g, '');
        }
      }
      return parseFloat(clean);
    };

    const parsed = parseCurrencyInput(inputValor.value);
    window.checkoutModalCents = isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100);
  }

  // Select Dinheiro by default in touch mode
  window.checkoutModalSelectTouchMethod('Dinheiro');
  window.checkoutModalUpdateTouchVisor();
};

window.checkoutModalUpdateTouchVisor = () => {
  const visor = document.getElementById('checkout-modal-touch-visor');
  if (visor) {
    visor.innerText = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
  }
  // Keep the hidden/native input updated so existing add logic functions
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    inputValor.value = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
  }
  if (window.calcRestante) window.calcRestante();
};

window.checkoutModalSelectTouchMethod = (metodo) => {
  window.checkoutModalSelectedMethod = metodo;
  const selectMetodo = document.getElementById('checkout-modal-metodo');
  if (selectMetodo) {
    selectMetodo.value = metodo;
  }

  // Style large method buttons
  document.querySelectorAll('.touch-method-btn').forEach(btn => {
    const m = btn.getAttribute('data-method');
    if (m === metodo) {
      btn.style.borderColor = '#fc4b15';
      btn.style.background = '#fff5f0';
      btn.style.boxShadow = '0 0 8px rgba(252, 75, 21, 0.15)';
    } else {
      btn.style.borderColor = '#e2e8f0';
      btn.style.background = 'white';
      btn.style.boxShadow = 'none';
    }
  });
  if (window.calcRestante) window.calcRestante();
};

let listaFormasPagamentoAtivas = [];

if (typeof socket !== 'undefined') {
  socket.on('formas_pagamento_atualizadas', (formas) => {
    if (Array.isArray(formas)) {
      listaFormasPagamentoAtivas = formas.filter(f => f.ativo === 1 || f.ativo === true);
      window.atualizarOpcoesPagamentoModal();
    }
  });
  socket.emit('get_formas_pagamento');
}

window._metodoPagamentoCores = {
  'dinheiro': { icon: 'ph-currency-dollar', color: '#27ae60' },
  'credito': { icon: 'ph-credit-card', color: '#9c27b0' },
  'debito': { icon: 'ph-credit-card', color: '#e67e22' },
  'pix': { icon: 'ph-qr-code', color: '#00b0ff' },
  'ticket': { icon: 'ph-ticket', color: '#e74c3c' },
  'carteira': { icon: 'ph-notebook', color: '#3498db' },
  'fiado': { icon: 'ph-notebook', color: '#e74c3c' },
  'outros': { icon: 'ph-wallet', color: '#718096' }
};

window._metodosIgnoradosPagamento = ['Múltiplo', 'Multiple', 'Dividir'];

window.atualizarOpcoesPagamentoModal = function () {
  const filtrados = listaFormasPagamentoAtivas.filter(f =>
    !window._metodosIgnoradosPagamento.some(ign => f.nome.toLowerCase().includes(ign.toLowerCase()))
  );

  const selectMetodo = document.getElementById('checkout-modal-metodo');
  if (selectMetodo && filtrados.length > 0) {
    const valorAtual = selectMetodo.value;
    selectMetodo.innerHTML = filtrados.map(f => `<option value="${f.nome}">${f.nome}</option>`).join('');
    if (filtrados.some(f => f.nome === valorAtual)) {
      selectMetodo.value = valorAtual;
    }
  }

  const touchContainer = document.getElementById('checkout-modal-touch-methods-container');
  if (touchContainer && filtrados.length > 0) {
    const numCols = filtrados.length <= 3 ? 3 : filtrados.length <= 5 ? 3 : 4;
    touchContainer.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    touchContainer.innerHTML = filtrados.map(f => {
      const tipo = (f.tipo || 'outros').toLowerCase();
      const estilo = window._metodoPagamentoCores[tipo] || window._metodoPagamentoCores['outros'];
      const iconeClass = f.icone || estilo.icon;
      const cor = estilo.color;
      return `
        <button type="button" class="touch-method-btn" data-method="${f.nome}"
          onclick="window.checkoutModalSelectTouchMethod('${f.nome}')"
          style="padding: 10px 4px; border: 2px solid var(--border-color); border-radius: 10px; font-size: 12px; font-weight: bold; background: var(--bg-card); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s;">
          <i class="ph ${iconeClass}" style="font-size: 20px; color: ${cor};"></i>
          ${f.nome}
        </button>
      `;
    }).join('');
  }
};

window.checkoutModalClearTouchValue = () => {
  window.checkoutModalCents = 0;
  window._checkoutAutoFilled = false;
  window.checkoutModalUpdateTouchVisor();
};

window.checkoutModalSetRemainingTouchValue = () => {
  const falta = window.mesaFaltaPagar || 0;
  if (falta > 0) {
    window.checkoutModalCents = Math.round(falta * 100);
  } else {
    window.checkoutModalCents = 0;
  }
  window._checkoutAutoFilled = true;
  window.checkoutModalUpdateTouchVisor();
};

// Bind keyboard input and touch numpad buttons
setTimeout(() => {
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    const parseCurrencyInput = (valStr) => {
      let clean = valStr.trim().replace('R$', '').replace(/\s/g, '');
      if (clean.includes('.') && clean.includes(',')) {
        if (clean.indexOf('.') < clean.indexOf(',')) {
          clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      } else if (clean.includes('.')) {
        const parts = clean.split('.');
        if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
          // decimal
        } else {
          clean = clean.replace(/\./g, '');
        }
      }
      return parseFloat(clean);
    };

    inputValor.addEventListener('focus', () => {
      if (window._checkoutAutoFilled) {
        inputValor.value = '';
        window.checkoutModalCents = 0;
        window._checkoutAutoFilled = false;
        window.checkoutModalUpdateTouchVisor();
      }
    });

    inputValor.addEventListener('input', (e) => {
      window._checkoutAutoFilled = false;
      const parsed = parseCurrencyInput(e.target.value);
      if (!isNaN(parsed) && parsed >= 0) {
        window.checkoutModalCents = Math.round(parsed * 100);
      } else {
        window.checkoutModalCents = 0;
      }
      const visor = document.getElementById('checkout-modal-touch-visor');
      if (visor) {
        visor.innerText = "R$ " + (window.checkoutModalCents / 100).toFixed(2).replace('.', ',');
      }
      if (window.calcRestante) window.calcRestante();
    });

    const selectMetodo = document.getElementById('checkout-modal-metodo');
    if (selectMetodo) {
      selectMetodo.addEventListener('change', () => {
        if (window.calcRestante) window.calcRestante();
      });
    }
  }

  // Bind touch numpad buttons
  document.querySelectorAll('.touch-num-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute('data-val');
      if (window._checkoutAutoFilled) {
        window.checkoutModalCents = 0;
        window._checkoutAutoFilled = false;
      }
      let str = window.checkoutModalCents.toString();
      if (val === 'BACKSPACE') {
        if (str.length <= 1) {
          window.checkoutModalCents = 0;
        } else {
          window.checkoutModalCents = parseInt(str.slice(0, -1), 10) || 0;
        }
      } else if (val === '00') {
        if (window.checkoutModalCents > 0) {
          window.checkoutModalCents = parseInt(str + '00', 10) || 0;
        }
      } else {
        if (window.checkoutModalCents === 0) {
          window.checkoutModalCents = parseInt(val, 10);
        } else {
          window.checkoutModalCents = parseInt(str + val, 10) || 0;
        }
      }
      window.checkoutModalUpdateTouchVisor();
    };
  });
}, 1000);

// --- CHECKOUT MODAL LIFECYCLE CONTROLS ---
window.abrirCheckoutModal = () => {
  if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');

  // RESET CUSTOM NFCE
  window.customNfceConfig = null;
  const btnNfce = document.getElementById('btn-customizar-nfce');
  if (btnNfce) {
    btnNfce.innerHTML = `<i class="ph ph-faders"></i> Personalizar Itens da NFC-e`;
    btnNfce.style.background = '#e0f2fe';
    btnNfce.style.color = '#0369a1';
    btnNfce.style.border = '1px solid #bae6fd';
  }

  const titleEl = document.getElementById('checkout-modal-mesa-title');
  if (titleEl) {
    titleEl.innerText = window.mesaAtual.nome || window.mesaAtual.mesaName;
  }

  const overlay = document.getElementById('checkout-modal-overlay');
  if (overlay) overlay.style.display = 'flex';

  const inputSplitParts = document.getElementById('checkout-modal-split-parts');
  if (inputSplitParts) inputSplitParts.value = '';

  // Configurar o Modo Touch padrão baseado nas configurações
  const defaultTouch = window.pdvConfigs && (window.pdvConfigs.modo_touch === 'true' || window.pdvConfigs.modo_touch === true);
  window.checkoutModalToggleTouchMode(defaultTouch);

  if (window.calcRestante) window.calcRestante();

  // Setar o valor do pagamento diretamente para o saldo restante da mesa (evitando clique extra)
  const falta = window.mesaFaltaPagar || 0;
  const inputValor = document.getElementById('checkout-modal-valor');
  const visor = document.getElementById('checkout-modal-touch-visor');
  if (falta > 0) {
    const formatted = `R$ ${falta.toFixed(2).replace('.', ',')}`;
    if (inputValor) inputValor.value = formatted;
    if (visor) visor.innerText = formatted;
    window.checkoutModalCents = Math.round(falta * 100);
    window._checkoutAutoFilled = true;
  } else {
    if (inputValor) inputValor.value = '';
    if (visor) visor.innerText = 'R$ 0,00';
    window.checkoutModalCents = 0;
    window._checkoutAutoFilled = false;
  }

  // Focar e selecionar automaticamente o input de valor para facilitar digitação de outro valor
  setTimeout(() => {
    const inputValor = document.getElementById('checkout-modal-valor');
    if (inputValor && !window.checkoutModalTouchModeActive) {
      inputValor.focus();
      inputValor.select();
    }
  }, 100);

  // Exibir ou ocultar o botão de pagamento por maquininha integrada
  const btnMpStandard = document.getElementById('btn-checkout-pagar-maquininha');
  const btnMpTouch = document.getElementById('btn-checkout-pagar-maquininha-touch');
  const activeProvider = window.pdvConfigs && window.pdvConfigs.mp_provider;
  const hasMp = activeProvider && activeProvider !== 'none';

  if (btnMpStandard) btnMpStandard.style.display = hasMp ? 'flex' : 'none';
  if (btnMpTouch) btnMpTouch.style.display = hasMp ? 'flex' : 'none';

  // Atualiza label do botão com ícone do provedor
  const providerLabels = { mercadopago: '🔵 Maquininha MP', stone: '🟢 Maquininha Stone', pagbank: '🟠 Maquininha PagBank', sitef: '⚙️ Maquininha TEF' };
  const btnLabel = providerLabels[activeProvider] || '💳 Maquininha';
  if (btnMpStandard) btnMpStandard.textContent = btnLabel;
  if (btnMpTouch) btnMpTouch.textContent = btnLabel;
};

window.fecharCheckoutModal = () => {
  const overlay = document.getElementById('checkout-modal-overlay');
  if (overlay) overlay.style.display = 'none';
};

window.checkoutModalAddPagamento = () => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
  const inputValor = document.getElementById('checkout-modal-valor');
  const selectMetodo = document.getElementById('checkout-modal-metodo');
  if (!inputValor || !selectMetodo) return;

  const parseCurrencyInput = (valStr) => {
    let clean = (valStr || '').trim().replace('R$', '').replace(/\s/g, '');
    if (clean.includes('.') && clean.includes(',')) {
      if (clean.indexOf('.') < clean.indexOf(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    } else if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts[1].length !== 3 || parseInt(parts[0]) === 0) {
        // Treat dot as decimal separator
      } else {
        clean = clean.replace(/\./g, '');
      }
    }
    return parseFloat(clean);
  };

  if (window.isAddingPaymentProcessing) return;

  let valor = parseCurrencyInput(inputValor.value);
  if (window.checkoutModalTouchModeActive) {
    valor = (window.checkoutModalCents || 0) / 100;
  }

  if (isNaN(valor) || valor <= 0) {
    return alert('Digite ou selecione um valor de pagamento válido maior que zero.');
  }

  const metodo = selectMetodo.value;
  const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
  const taxaCheckbox = document.getElementById('taxa-servico');
  const modalTaxaCheckbox = document.getElementById('checkout-modal-taxa');

  // Recalcular saldo restante em tempo real para ter o valor mais recente
  if (typeof window.calcRestante === 'function') {
    window.calcRestante();
  }
  const falta = typeof window.mesaFaltaPagar === 'number' ? window.mesaFaltaPagar : 0;

  if (falta <= 0.01) {
    return alert('⛔ Esta mesa/comanda já está totalmente paga!\n\nPara alterar os valores recebidos, remova um pagamento existente na lista ao lado.');
  }

  // REGRA RIGOROSA DE CAIXA:
  // Pagamentos eletrônicos (Cartão de Crédito, Cartão de Débito, Pix, Fiado/Conta) NÃO PODEM ser lançados com valor maior que o saldo restante da conta!
  // Troco é permitido EXCLUSIVAMENTE para pagamento em DINHEIRO.
  if (metodo !== 'Dinheiro') {
    if (valor > falta + 0.05) {
      return alert(`⛔ OPERAÇÃO BLOQUEADA PELO SISTEMA:\n\nPagamentos em ${metodo} não podem exceder o saldo restante da conta (R$ ${falta.toFixed(2).replace('.', ',')})!\n\nO valor inserido foi R$ ${valor.toFixed(2).replace('.', ',')}.\n\nPara pagamentos eletrônicos com valor maior que a conta, cancele ou ajuste o valor no terminal/máquina do cartão, pois o troco só é permitido em DINHEIRO.`);
    }
  }

  let valorRegistrado = valor;
  if (metodo === 'Dinheiro' && valor > falta + 0.01) {
    valorRegistrado = falta;
    const troco = valor - falta;
    alert(`✅ Pagamento em Dinheiro registrado.\n\nDEVOLVER DE TROCO AO CLIENTE: R$ ${troco.toFixed(2).replace('.', ',')}`);
  }

  // Travar botões e flag global para prevenir envios duplicados por cliques rápidos
  window.isAddingPaymentProcessing = true;
  const btns = document.querySelectorAll('#checkout-modal-overlay button');
  btns.forEach(b => b.style.pointerEvents = 'none');

  // Abater valor otimisticamente na memória para impedir cliques subsequentes instantâneos
  window.mesaFaltaPagar = Math.max(0, falta - valorRegistrado);

  setTimeout(() => {
    window.isAddingPaymentProcessing = false;
    btns.forEach(b => b.style.pointerEvents = 'auto');
  }, 2000);

  const isTaxaChecked = modalTaxaCheckbox ? modalTaxaCheckbox.checked : (taxaCheckbox ? taxaCheckbox.checked : true);

  // Register partial payment - only via pagamento_parcial_valor to avoid duplicate in movimentacoes
  socket.emit('pagamento_parcial_valor', {
    mesaName: mesaName,
    valor: valorRegistrado,
    metodo: metodo,
    comTaxa: isTaxaChecked,
    desconto: window.descontoAdicional || 0,
    userName: window.loggedInUser || 'Caixa'
  });

  inputValor.value = '';
  window.checkoutModalCents = 0;
  if (typeof window.checkoutModalUpdateTouchVisor === 'function') {
    window.checkoutModalUpdateTouchVisor();
  }
};

window.checkoutModalPagarMaquininha = () => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');

  let metodo = 'Cartão de Crédito';
  if (window.checkoutModalTouchModeActive) {
    const activeBtn = document.querySelector('.touch-method-btn.active');
    if (activeBtn) {
      metodo = activeBtn.dataset.method || 'Cartão de Crédito';
    }
  } else {
    const selectMetodo = document.getElementById('checkout-modal-metodo');
    if (selectMetodo) {
      metodo = selectMetodo.value;
    }
  }

  if (metodo !== 'Cartão de Crédito' && metodo !== 'Cartão de Débito') {
    return alert('A maquininha integrada aceita apenas pagamentos com Cartão (Crédito ou Débito). Selecione Cartão de Crédito ou Cartão de Débito.');
  }

  let valor = 0;
  if (window.checkoutModalTouchModeActive) {
    valor = (window.checkoutModalCents || 0) / 100;
  } else {
    const inputValor = document.getElementById('checkout-modal-valor');
    if (inputValor) {
      let clean = (inputValor.value || '').trim().replace('R$', '').replace(/\s/g, '');
      if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      }
      valor = parseFloat(clean);
    }
  }

  if (isNaN(valor) || valor <= 0) {
    return alert('Insira um valor de pagamento válido.');
  }

  // Verificar se o valor não excede o saldo restante da mesa (regra estrita)
  if (typeof window.calcRestante === 'function') {
    window.calcRestante();
  }
  const falta = typeof window.mesaFaltaPagar === 'number' ? window.mesaFaltaPagar : 0;
  if (falta <= 0.01) {
    return alert('⛔ Esta mesa/comanda já está totalmente paga!');
  }
  if (valor > falta + 0.05) {
    return alert(`⛔ OPERAÇÃO BLOQUEADA:\n\nPagamentos em ${metodo} não podem exceder o saldo restante da conta (R$ ${falta.toFixed(2).replace('.', ',')})!`);
  }

  // Exibir overlay de processamento
  const overlay = document.getElementById('modal-mp-pagamento');
  const amountEl = document.getElementById('mp-payment-amount');
  const statusEl = document.getElementById('mp-payment-status');
  const titleEl = document.getElementById('mp-payment-title');
  const spinner = document.getElementById('mp-payment-spinner');
  const successIcon = document.getElementById('mp-payment-success-icon');

  if (overlay) {
    overlay.style.display = 'flex';
    if (amountEl) amountEl.innerText = `R$ ${valor.toFixed(2).replace('.', ',')}`;
    if (statusEl) statusEl.innerText = 'Enviando cobrança para a maquininha. Aguarde...';
    if (titleEl) titleEl.innerText = 'Iniciando Transação';
    if (spinner) spinner.style.display = 'flex';
    if (successIcon) successIcon.style.display = 'none';
  }

  socket.emit('mp_iniciar_pagamento', { valor, metodo });
  window.pendingMpPayment = { valor, metodo };
};

window.checkoutModalCalcularDivisao = () => {
  const inputParts = document.getElementById('checkout-modal-split-parts');
  if (!inputParts) return;
  const parts = parseInt(inputParts.value, 10);
  if (isNaN(parts) || parts < 2) {
    return alert('Por favor, informe uma quantidade válida de pessoas (mínimo 2).');
  }

  const falta = window.mesaFaltaPagar;
  if (falta <= 0) {
    return alert('Não há saldo restante para dividir.');
  }

  const share = falta / parts;
  const inputValor = document.getElementById('checkout-modal-valor');
  if (inputValor) {
    inputValor.value = "R$ " + share.toFixed(2).replace('.', ',');
  }

  window.checkoutModalCents = Math.round(share * 100);
  if (typeof window.checkoutModalUpdateTouchVisor === 'function') {
    window.checkoutModalUpdateTouchVisor();
  }
};

window.customNfceConfig = null;

window.abrirModalCustomNfce = () => {
  const modal = document.getElementById('modal-custom-nfce');
  if (modal) modal.style.display = 'flex';

  if (!window.customNfceConfig) {
    const itemsSrc = window.mesaAtual && window.mesaAtual.items ? window.mesaAtual.items : (window.currentPanelItems || []);
    let itemsBase = [];
    if (itemsSrc.length > 0) {
      itemsBase = itemsSrc.map(it => ({
        nome: it.produto_nome || it.nome || 'Produto',
        quantidade: parseFloat(String(it.quantidade).replace(',', '.')) || 1,
        preco: parseFloat(String(it.preco).replace(',', '.')) || 0
      }));
    } else {
      itemsBase = [];
    }

    window.customNfceConfig = {
      agrupar: false,
      totalAgrupado: window.mesaFaltaPagar > 0 ? window.mesaFaltaPagar : (window.mesaTotalComTaxa || 0),
      items: itemsBase
    };
  }

  const chkAgrupar = document.getElementById('custom-nfce-agrupar');
  if (chkAgrupar) {
    chkAgrupar.checked = window.customNfceConfig.agrupar;
  }

  const inpTotal = document.getElementById('custom-nfce-total-agrupado');
  if (inpTotal) {
    inpTotal.value = window.customNfceConfig.totalAgrupado.toFixed(2).replace('.', ',');
  }

  window.toggleAgruparNfce();
};

window.toggleAgruparNfce = () => {
  const chk = document.getElementById('custom-nfce-agrupar');
  const agruparContainer = document.getElementById('custom-nfce-agrupar-container');
  const tabelaContainer = document.getElementById('custom-nfce-tabela-container');

  const isAgrupado = chk ? chk.checked : false;
  if (window.customNfceConfig) window.customNfceConfig.agrupar = isAgrupado;

  if (isAgrupado) {
    if (agruparContainer) agruparContainer.style.display = 'block';
    if (tabelaContainer) tabelaContainer.style.display = 'none';
  } else {
    if (agruparContainer) agruparContainer.style.display = 'none';
    if (tabelaContainer) tabelaContainer.style.display = 'block';
    window.renderCustomNfceTable();
  }
};

window.renderCustomNfceTable = () => {
  const tbody = document.getElementById('custom-nfce-tbody');
  if (!tbody || !window.customNfceConfig) return;

  tbody.innerHTML = '';
  let totalCalc = 0;

  window.customNfceConfig.items.forEach((item, index) => {
    const totalItem = item.quantidade * item.preco;
    totalCalc += totalItem;

    tbody.innerHTML += `
      <tr>
        <td style="padding: 6px; border-bottom: 1px solid var(--border-color);">
          <input type="text" value="${item.nome}" onchange="window.editarItemCustomNfce(${index}, 'nome', this.value)" style="width: 100%; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px;">
        </td>
        <td style="padding: 6px; text-align: center; border-bottom: 1px solid var(--border-color);">
          <input type="number" step="0.01" value="${item.quantidade}" onchange="window.editarItemCustomNfce(${index}, 'quantidade', this.value)" style="width: 100%; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; text-align: center;">
        </td>
        <td style="padding: 6px; text-align: right; border-bottom: 1px solid var(--border-color);">
          <input type="number" step="0.01" value="${item.preco.toFixed(2)}" onchange="window.editarItemCustomNfce(${index}, 'preco', this.value)" style="width: 100%; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; text-align: right;">
        </td>
        <td style="padding: 6px; text-align: right; border-bottom: 1px solid var(--border-color);">
          R$ ${totalItem.toFixed(2).replace('.', ',')}
        </td>
        <td style="padding: 6px; text-align: center; border-bottom: 1px solid var(--border-color);">
          <button onclick="window.removerItemCustomNfce(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;"><i class="ph ph-trash"></i></button>
        </td>
      </tr>
    `;
  });

  const spanTotal = document.getElementById('custom-nfce-total-calculado');
  if (spanTotal) {
    spanTotal.innerText = 'R$ ' + totalCalc.toFixed(2).replace('.', ',');
  }
};

window.editarItemCustomNfce = (index, campo, valor) => {
  if (!window.customNfceConfig || !window.customNfceConfig.items[index]) return;
  if (campo === 'nome') {
    window.customNfceConfig.items[index].nome = valor;
  } else if (campo === 'quantidade') {
    window.customNfceConfig.items[index].quantidade = parseFloat(valor) || 1;
  } else if (campo === 'preco') {
    window.customNfceConfig.items[index].preco = parseFloat(valor) || 0;
  }
  window.renderCustomNfceTable();
};

window.adicionarItemCustomNfce = () => {
  if (!window.customNfceConfig) return;
  window.customNfceConfig.items.push({
    nome: 'Novo Produto',
    quantidade: 1,
    preco: 0
  });
  window.renderCustomNfceTable();
};

window.removerItemCustomNfce = (index) => {
  if (!window.customNfceConfig) return;
  window.customNfceConfig.items.splice(index, 1);
  window.renderCustomNfceTable();
};

window.atualizarTotalAgrupadoNfce = () => {
  const inp = document.getElementById('custom-nfce-total-agrupado');
  if (!inp || !window.customNfceConfig) return;
  let val = parseFloat(inp.value.replace('R$', '').replace('.', '').replace(',', '.').trim());
  if (isNaN(val)) val = 0;
  window.customNfceConfig.totalAgrupado = val;
  inp.value = val.toFixed(2).replace('.', ',');
};

window.salvarCustomNfce = () => {
  if (!window.customNfceConfig) return;

  window.atualizarTotalAgrupadoNfce();

  if (window.customNfceConfig.agrupar) {
    window.customNfceConfig.finalItems = [{
      produto_nome: '1 Refeição',
      quantidade: 1,
      preco: window.customNfceConfig.totalAgrupado,
      total: window.customNfceConfig.totalAgrupado
    }];
    window.customNfceConfig.finalTotal = window.customNfceConfig.totalAgrupado;
  } else {
    window.customNfceConfig.finalItems = window.customNfceConfig.items.map(it => ({
      produto_nome: it.nome,
      quantidade: it.quantidade,
      preco: it.preco,
      total: it.quantidade * it.preco
    }));
    window.customNfceConfig.finalTotal = window.customNfceConfig.finalItems.reduce((acc, curr) => acc + curr.total, 0);
  }

  const chkNfce = document.getElementById('checkout-modal-emitir-nfce');
  if (chkNfce) chkNfce.checked = true; // Força emissão

  const btn = document.getElementById('btn-customizar-nfce');
  if (btn) {
    btn.innerHTML = `<i class="ph ph-check-circle"></i> Configuração Salva (R$ ${window.customNfceConfig.finalTotal.toFixed(2).replace('.', ',')})`;
    btn.style.background = '#dcfce7';
    btn.style.color = '#166534';
    btn.style.border = '1px solid #86efac';
  }

  const modal = document.getElementById('modal-custom-nfce');
  if (modal) modal.style.display = 'none';
};

window.emitirCustomNfceAgora = (event) => {
  if (!window.customNfceConfig) return;

  window.atualizarTotalAgrupadoNfce();

  if (window.customNfceConfig.agrupar) {
    window.customNfceConfig.finalItems = [{
      produto_nome: '1 Refeição',
      quantidade: 1,
      preco: window.customNfceConfig.totalAgrupado,
      total: window.customNfceConfig.totalAgrupado
    }];
    window.customNfceConfig.finalTotal = window.customNfceConfig.totalAgrupado;
  } else {
    window.customNfceConfig.finalItems = window.customNfceConfig.items.map(it => ({
      produto_nome: it.nome,
      quantidade: it.quantidade,
      preco: it.preco,
      total: it.quantidade * it.preco
    }));
    window.customNfceConfig.finalTotal = window.customNfceConfig.finalItems.reduce((acc, curr) => acc + curr.total, 0);
  }

  const cpfCnpj = document.getElementById('checkout-modal-cpf-cnpj') ? document.getElementById('checkout-modal-cpf-cnpj').value : '';
  const btn = event.currentTarget;
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i class="ph ph-spinner-gap"></i> Emitindo...';

  socket.emit('emitir_nfce', {
    pedidoId: null,
    mesaName: window.mesaAtual ? window.mesaAtual.nome || window.mesaAtual.mesaName : 'Avulsa',
    items: window.customNfceConfig.finalItems,
    totalValue: window.customNfceConfig.finalTotal,
    cpfCnpj: cpfCnpj,
    paymentMethods: 'Diversos'
  });

  setTimeout(() => {
    btn.innerHTML = oldText;
    const modal = document.getElementById('modal-custom-nfce');
    if (modal) modal.style.display = 'none';
    alert('A requisição de NFC-e Avulsa foi enviada à Sefaz!');
  }, 2000);
};

window.checkoutModalConfirmarFechamento = () => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
  const falta = window.mesaFaltaPagar;
  const total = window.mesaTotalComTaxa;

  if (falta > 0.01) {
    return alert('Pagamento incompleto! A mesa não pode ser fechada sem o pagamento total.');
  }

  const chkNfce = document.getElementById('checkout-modal-emitir-nfce');
  const inputCpf = document.getElementById('checkout-modal-cpf-cnpj');
  const inputTelefone = document.getElementById('checkout-modal-telefone-cliente');
  const emitirNfce = chkNfce ? chkNfce.checked : true;
  const cpfCnpj = inputCpf ? inputCpf.value.trim() : '';
  const telefoneCliente = inputTelefone ? inputTelefone.value.replace(/\D/g, '') : '';

  const btnConfirm = document.getElementById('checkout-modal-submit-btn');
  if (btnConfirm) {
    btnConfirm.innerHTML = '<i class="ph ph-spinner-gap"></i> Processando...';
    btnConfirm.style.pointerEvents = 'none';
  }

  socket.emit('finalizar_mesa', {
    mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName,
    payments: window.pagamentosParciais,
    totalValue: total,
    emitirNfce: emitirNfce,
    cpfCnpj: cpfCnpj,
    customNfceConfig: window.customNfceConfig,
    telefoneCliente: telefoneCliente
  });
};

// --- FUNÇÕES DE COBRANÇA POR COMANDA ---
window.comandaCobrarNome = '';
window.comandaModalTotalVal = 0;

window.cobrarComanda = function (comandaName, totalVal) {
  if (!window.mesaAtual || !window.mesaAtual.items) return;

  window.comandaCobrarNome = comandaName;
  const modalOverlay = document.getElementById('comanda-checkout-overlay');
  const modalTitle = document.getElementById('comanda-modal-title');
  const itemsContainer = document.getElementById('comanda-modal-items');
  const splitChk = document.getElementById('comanda-modal-split-shared');
  const splitValSpan = document.getElementById('comanda-modal-split-value');
  const sharedList = document.getElementById('comanda-modal-shared-list');

  if (!modalOverlay) return;

  if (modalTitle) {
    modalTitle.innerText = comandaName ? `Cobrar Comanda: ${comandaName}` : 'Cobrar Itens Compartilhados';
  }

  const unpaidItems = window.mesaAtual.items.filter(o => o.status !== 'Pago');
  const comandaItems = comandaName
    ? unpaidItems.filter(o => (o.mesa_comanda || '').trim() === comandaName)
    : unpaidItems.filter(o => !(o.mesa_comanda || '').trim());

  if (itemsContainer) {
    if (comandaItems.length === 0) {
      itemsContainer.innerHTML = '<span style="color:#27ae60; font-weight:600;"><i class="ph ph-check-circle"></i> Todos os itens desta comanda já foram pagos!</span>';
    } else {
      itemsContainer.innerHTML = comandaItems.map(it => `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>${it.quantity || it.quantidade || 1}x ${it.productName || it.nome || it.descricao || 'Produto'}</span>
          <span style="font-weight:bold;">R$ ${parseFloat(String(it.total).replace(',', '.')).toFixed(2).replace('.', ',')}</span>
        </div>
      `).join('');
    }
  }

  const numComandas = new Set(unpaidItems.map(o => (o.mesa_comanda || '').trim()).filter(Boolean)).size || 1;
  const sharedItems = unpaidItems.filter(o => !(o.mesa_comanda || '').trim());
  let sharedSum = 0;
  sharedItems.forEach(it => { sharedSum += parseFloat(String(it.total).replace(',', '.')); });

  const sharePerComanda = comandaName && numComandas > 0 ? (sharedSum / numComandas) : 0;
  if (splitValSpan) {
    splitValSpan.innerText = `R$ ${sharePerComanda.toFixed(2).replace('.', ',')}`;
  }
  if (splitChk) splitChk.checked = false;

  if (sharedList && sharedList.parentElement) {
    if (!comandaName || sharedItems.length === 0) {
      sharedList.parentElement.style.display = 'none';
    } else {
      sharedList.parentElement.style.display = 'block';
      sharedList.innerHTML = sharedItems.map(it => `
        <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
          <span style="display:flex; align-items:center; gap:6px;">
            <input type="checkbox" class="chk-shared-item" data-id="${it.id}" data-price="${parseFloat(String(it.total).replace(',', '.'))}" onchange="window.recalcComandaModal()">
            ${it.quantity || it.quantidade || 1}x ${it.productName || it.nome || it.descricao || 'Produto'}
          </span>
          <span>R$ ${parseFloat(String(it.total).replace(',', '.')).toFixed(2).replace('.', ',')}</span>
        </label>
      `).join('');
    }
  }

  modalOverlay.style.display = 'flex';
  window.recalcComandaModal();
};

window.recalcComandaModal = function () {
  if (!window.mesaAtual || !window.mesaAtual.items) return;
  const cName = window.comandaCobrarNome;
  const unpaidItems = window.mesaAtual.items.filter(o => o.status !== 'Pago');

  let baseTotal = 0;
  if (cName) {
    unpaidItems.filter(o => (o.mesa_comanda || '').trim() === cName).forEach(it => {
      baseTotal += parseFloat(String(it.total).replace(',', '.'));
    });
  } else {
    unpaidItems.filter(o => !(o.mesa_comanda || '').trim()).forEach(it => {
      baseTotal += parseFloat(String(it.total).replace(',', '.'));
    });
  }

  const splitChk = document.getElementById('comanda-modal-split-shared');
  if (splitChk && splitChk.checked && cName) {
    const sharedItems = unpaidItems.filter(o => !(o.mesa_comanda || '').trim());
    let sharedSum = 0;
    sharedItems.forEach(it => { sharedSum += parseFloat(String(it.total).replace(',', '.')); });
    const numComandas = new Set(unpaidItems.map(o => (o.mesa_comanda || '').trim()).filter(Boolean)).size || 1;
    baseTotal += (sharedSum / numComandas);
  } else {
    document.querySelectorAll('.chk-shared-item:checked').forEach(chk => {
      baseTotal += parseFloat(chk.getAttribute('data-price') || 0);
    });
  }

  const serviceCheckbox = document.getElementById('taxa-servico');
  if (serviceCheckbox && serviceCheckbox.checked) {
    baseTotal *= 1.1;
  }

  window.comandaModalTotalVal = baseTotal;
  const totalEl = document.getElementById('comanda-modal-total');
  if (totalEl) {
    totalEl.innerText = `R$ ${baseTotal.toFixed(2).replace('.', ',')}`;
  }
};

window.finalizarComandaModal = function () {
  if (window.isComandaPaymentProcessing) return;

  const val = window.comandaModalTotalVal || 0;
  if (val <= 0) {
    alert('Esta comanda já foi totalmente paga ou o valor a cobrar é zerado.');
    return;
  }
  const methodEl = document.getElementById('comanda-modal-method');
  const method = methodEl ? methodEl.value : 'Dinheiro';
  const cName = window.comandaCobrarNome;
  const mesaName = window.mesaAtual ? (window.mesaAtual.nome || window.mesaAtual.mesaName) : '';

  // Obter os IDs dos itens desta comanda que serão marcados como 'Pago'
  const unpaidItems = (window.mesaAtual && window.mesaAtual.items) ? window.mesaAtual.items.filter(o => o.status !== 'Pago') : [];
  let itemsToPay = [];
  if (cName) {
    itemsToPay = unpaidItems.filter(o => (o.mesa_comanda || '').trim() === cName);
  } else {
    itemsToPay = unpaidItems.filter(o => !(o.mesa_comanda || '').trim());
  }

  const checkedSharedIds = Array.from(document.querySelectorAll('.chk-shared-item:checked'))
    .map(chk => parseInt(chk.getAttribute('data-id'), 10))
    .filter(Boolean);

  const itemIds = [...new Set([...itemsToPay.map(i => i.id), ...checkedSharedIds])];

  // Marcar itens na memória imediatamente (baixa otimista)
  itemIds.forEach(id => {
    const found = window.mesaAtual.items.find(it => it.id === id);
    if (found) found.status = 'Pago';
  });
  window.comandaModalTotalVal = 0;

  window.isComandaPaymentProcessing = true;
  const modalOverlay = document.getElementById('comanda-checkout-overlay');
  const btns = modalOverlay ? modalOverlay.querySelectorAll('button') : [];
  btns.forEach(b => b.style.pointerEvents = 'none');

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('pagamento_parcial_valor', {
      mesaName: mesaName,
      valor: val,
      metodo: method,
      comandaName: cName,
      itemIds: itemIds,
      userName: window.loggedInUser || 'Caixa'
    });
  }

  setTimeout(() => {
    window.isComandaPaymentProcessing = false;
    btns.forEach(b => b.style.pointerEvents = 'auto');
    if (modalOverlay) modalOverlay.style.display = 'none';
    alert(`Pagamento de R$ ${val.toFixed(2).replace('.', ',')} (${method}) recebido com sucesso para ${cName ? 'Comanda ' + cName : 'Itens Compartilhados'}!`);
  }, 1000);
};

// --- SISTEMA DE PERSONALIZAÇÃO DE ATALHOS DO TECLADO (TECLAGEM OPERACIONAL) ---
window.DEFAULT_SHORTCUTS = {
  "adicionar_produtos": "F1",
  "pagamento_parcial": "F2",
  "fechar_mesa": "F3",
  "imprimir_conta": "F4",
  "atualizar_mesas": "F5",
  "desconto": "F6",
  "taxa_servico": "F7",
  "ver_comissao": "F8",
  "alterar_mesa": "F9",
  "juntar_mesa": "F10",
  "tela_cheia": "F11",
  "fila_cozinha": "F12",
  "venda_balcao": "F2",
  "venda_delivery": "F3"
};

window.SHORTCUT_LABELS = {
  "adicionar_produtos": { title: "Lançar Produtos / PDV", icon: "ph-shopping-cart-simple" },
  "pagamento_parcial": { title: "Pagamento Parcial / Comanda", icon: "ph-receipt" },
  "fechar_mesa": { title: "Fechar Conta / Checkout", icon: "ph-check-circle" },
  "imprimir_conta": { title: "Imprimir Conferência", icon: "ph-printer" },
  "atualizar_mesas": { title: "Recarregar / Atualizar Mesas", icon: "ph-arrows-clockwise" },
  "desconto": { title: "Aplicar Desconto", icon: "ph-percent" },
  "taxa_servico": { title: "Taxa de Serviço (10%)", icon: "ph-wine" },
  "ver_comissao": { title: "Ver Comissão do Garçom", icon: "ph-coins" },
  "alterar_mesa": { title: "Alterar / Transferir Mesa", icon: "ph-arrows-left-right" },
  "juntar_mesa": { title: "Juntar Mesas", icon: "ph-grid-four" },
  "tela_cheia": { title: "Alternar Tela Cheia", icon: "ph-arrows-out-cardinal" },
  "fila_cozinha": { title: "Fila de Preparo da Cozinha", icon: "ph-cooking-pot" },
  "venda_balcao": { title: "Atalho Venda Balcão", icon: "ph-storefront" },
  "venda_delivery": { title: "Atalho Delivery", icon: "ph-truck" }
};

window.getCustomShortcuts = function () {
  try {
    const saved = localStorage.getItem('custom_keyboard_shortcuts');
    if (saved) return { ...window.DEFAULT_SHORTCUTS, ...JSON.parse(saved) };
  } catch (err) { }
  return { ...window.DEFAULT_SHORTCUTS };
};

window.saveCustomShortcuts = function (newShortcuts) {
  localStorage.setItem('custom_keyboard_shortcuts', JSON.stringify(newShortcuts));
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('save_custom_shortcuts', newShortcuts);
  }
  window.renderGuiaAtalhosUI && window.renderGuiaAtalhosUI();
};

window.restaurarAtalhosPadrao = function () {
  if (confirm('Deseja restaurar as teclas de atalho padrão (F1 a F12)?')) {
    localStorage.removeItem('custom_keyboard_shortcuts');
    window.saveCustomShortcuts(window.DEFAULT_SHORTCUTS);
    alert('Atalhos restaurados para o padrão original (F1 - F12)!');
  }
};

window.abrirModalPersonalizarAtalhos = function () {
  const modal = document.getElementById('modal-custom-shortcuts');
  if (modal) modal.style.display = 'flex';
  window.renderGuiaAtalhosUI && window.renderGuiaAtalhosUI();
};

window.iniciarGravacaoAtalho = function (actionKey, btnEl) {
  if (!btnEl) return;
  btnEl.innerText = 'Pressione a tecla...';
  btnEl.style.background = '#fc4b15';
  btnEl.style.color = '#ffffff';

  function onCaptureKey(e) {
    e.preventDefault();
    e.stopPropagation();

    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';

    let combo = '';
    if (e.ctrlKey) combo += 'Ctrl+';
    if (e.altKey) combo += 'Alt+';
    if (e.shiftKey) combo += 'Shift+';

    const formattedKey = keyName.length === 1 ? keyName.toUpperCase() : keyName;
    combo += formattedKey;

    const shortcuts = window.getCustomShortcuts();
    shortcuts[actionKey] = combo;
    window.saveCustomShortcuts(shortcuts);

    window.removeEventListener('keydown', onCaptureKey, true);
    window.renderGuiaAtalhosUI && window.renderGuiaAtalhosUI();
  }

  window.addEventListener('keydown', onCaptureKey, true);
};

window.renderGuiaAtalhosUI = function () {
  const shortcuts = window.getCustomShortcuts();

  ['container-shortcuts-editor', 'container-shortcuts-editor-page'].forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    Object.keys(window.SHORTCUT_LABELS).forEach(actKey => {
      const info = window.SHORTCUT_LABELS[actKey];
      const curKey = shortcuts[actKey] || window.DEFAULT_SHORTCUTS[actKey];

      html += `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="ph ${info.icon}" style="font-size: 20px; color: #fc4b15;"></i>
            <span style="font-size: 13px; font-weight: 600; color: #1e293b;">${info.title}</span>
          </div>
          <button onclick="window.iniciarGravacaoAtalho('${actKey}', this)" style="padding: 6px 14px; background: var(--bg-secondary); color: #0f172a; border: 1px solid var(--border-color); border-radius: 8px; font-family: monospace; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
            ${curKey}
          </button>
        </div>
      `;
    });
    container.innerHTML = html;
  });

  const guiaTable = document.getElementById('guia-atalhos-table-body');
  if (guiaTable) {
    let tableRows = '';
    const mainActionKeys = [
      'adicionar_produtos',
      'pagamento_parcial',
      'fechar_mesa',
      'imprimir_conta',
      'atualizar_mesas',
      'desconto',
      'taxa_servico',
      'ver_comissao',
      'alterar_mesa',
      'juntar_mesa',
      'tela_cheia',
      'fila_cozinha'
    ];

    mainActionKeys.forEach(actKey => {
      const info = window.SHORTCUT_LABELS[actKey];
      const curKey = shortcuts[actKey] || window.DEFAULT_SHORTCUTS[actKey];
      if (info) {
        tableRows += `
          <tr>
            <td style="padding: 4px 0; width: 75px;">
              <kbd style="background: #fc4b15; color: #ffffff; padding: 2px 7px; border-radius: 4px; font-weight: bold; font-family: monospace; font-size: 11.5px; display: inline-block;">${curKey}</kbd>
            </td>
            <td style="color: #334155; font-weight: 600;">${info.title}</td>
          </tr>
        `;
      }
    });
    guiaTable.innerHTML = tableRows;
  }
};

window.focusedMesaIndex = -1;

window.abrirGuiaAtalhos = function () {
  const modal = document.getElementById('modal-guia-atalhos');
  if (modal) modal.style.display = 'flex';
  window.renderGuiaAtalhosUI && window.renderGuiaAtalhosUI();
};

document.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  const isInputActive = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) &&
    !activeEl.classList.contains('allow-shortcut');

  // ESC: Fechar modais ativos ou cancelar foco
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal-overlay, #pdv-overlay, #checkout-modal-overlay, #modal-guia-atalhos, #modal-zoom-qr-ponto, #comanda-checkout-overlay, #modal-custom-shortcuts, #modal-central-cadastro');
    let anyOpen = false;
    modals.forEach(m => {
      if (m.style.display !== 'none' && m.style.display !== '') {
        m.style.display = 'none';
        anyOpen = true;
      }
    });
    if (anyOpen) {
      e.preventDefault();
      return;
    }
  }

  // Tecla ? (Shift + /) para abrir o Guia de Atalhos
  if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !isInputActive) {
    e.preventDefault();
    window.abrirGuiaAtalhos();
    return;
  }

  // Se o modal de Checkout estiver visível
  const checkoutModal = document.getElementById('checkout-modal-overlay');
  const isCheckoutOpen = checkoutModal && checkoutModal.style.display !== 'none' && checkoutModal.style.display !== '';

  if (isCheckoutOpen) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (window.checkoutModalConfirmarFechamento) window.checkoutModalConfirmarFechamento();
      return;
    }
    if (!isInputActive) {
      const keyUpper = e.key.toUpperCase();
      let selectMethod = null;
      if (e.key === '1' || keyUpper === 'D') selectMethod = 'Dinheiro';
      else if (e.key === '2' || keyUpper === 'P') selectMethod = 'Pix';
      else if (e.key === '3' || keyUpper === 'C') selectMethod = 'Cartão de Crédito';
      else if (e.key === '4' || keyUpper === 'V') selectMethod = 'Cartão de Débito';
      else if (e.key === '5' || keyUpper === 'F') selectMethod = 'Fiado / Conta';

      if (selectMethod) {
        e.preventDefault();
        const sel = document.getElementById('checkout-modal-metodo');
        if (sel) {
          sel.value = selectMethod;
          if (window.checkoutModalAdicionarPagamento) window.checkoutModalAdicionarPagamento();
        }
      }
    }
  }

  // Se o modal de Lançamento PDV estiver visível
  const pdvModal = document.getElementById('pdv-overlay');
  const isPdvOpen = pdvModal && pdvModal.style.display !== 'none' && pdvModal.style.display !== '';
  if (isPdvOpen) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (window.pdvConfirmarEEnviar) window.pdvConfirmarEEnviar();
      return;
    }
  }

  if (isInputActive) return;

  const shortcuts = window.getCustomShortcuts();
  const currentKey = e.key.toUpperCase();

  function isTriggered(actionKey) {
    const configured = (shortcuts[actionKey] || window.DEFAULT_SHORTCUTS[actionKey] || '').trim();
    if (!configured) return false;

    if (!configured.includes('+')) {
      return configured.toUpperCase() === currentKey || configured.toUpperCase() === e.key.toUpperCase();
    }

    const parts = configured.split('+').map(p => p.trim().toUpperCase());
    const reqCtrl = parts.includes('CTRL');
    const reqShift = parts.includes('SHIFT');
    const reqAlt = parts.includes('ALT');
    const mainKey = parts[parts.length - 1];

    const ctrlMatch = reqCtrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
    const shiftMatch = reqShift ? e.shiftKey : !e.shiftKey;
    const altMatch = reqAlt ? e.altKey : !e.altKey;
    const keyMatch = (mainKey === currentKey || mainKey === e.key.toUpperCase());

    return ctrlMatch && shiftMatch && altMatch && keyMatch;
  }

  if (isTriggered('adicionar_produtos')) {
    e.preventDefault();
    document.getElementById('btn-adicionar-produtos')?.click();
  } else if (isTriggered('pagamento_parcial')) {
    e.preventDefault();
    document.getElementById('btn-movimento-parcial')?.click();
  } else if (isTriggered('fechar_mesa')) {
    e.preventDefault();
    if (window.abrirCheckoutModal) window.abrirCheckoutModal();
    else document.getElementById('btn-movimento-concluir')?.click();
  } else if (isTriggered('imprimir_conta')) {
    e.preventDefault();
    document.getElementById('btn-imprimir-conta')?.click();
  } else if (isTriggered('atualizar_mesas')) {
    e.preventDefault();
    if (typeof socket !== 'undefined' && socket) socket.emit('get_mesas');
  } else if (isTriggered('desconto')) {
    e.preventDefault();
    document.getElementById('btn-aplicar-desconto')?.click();
  } else if (isTriggered('taxa_servico')) {
    e.preventDefault();
    document.getElementById('btn-aplicar-servico')?.click();
  } else if (isTriggered('ver_comissao')) {
    e.preventDefault();
    document.getElementById('btn-ver-comissao')?.click();
  } else if (isTriggered('alterar_mesa')) {
    e.preventDefault();
    document.getElementById('btn-alterar-mesa')?.click();
  } else if (isTriggered('juntar_mesa')) {
    e.preventDefault();
    document.getElementById('btn-juntar-mesa')?.click();
  } else if (isTriggered('tela_cheia')) {
    e.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  } else if (isTriggered('fila_cozinha')) {
    e.preventDefault();
    window.location.href = 'fila-pedidos.html';
  } else if (isTriggered('venda_balcao')) {
    e.preventDefault();
    document.getElementById('toolbar-balcao')?.click();
  } else if (isTriggered('venda_delivery')) {
    e.preventDefault();
    document.getElementById('toolbar-delivery')?.click();
  }

  // SHIFT COMBINATIONS FOR NAVIGATION
  if (e.shiftKey && !isInputActive) {
    const kUpper = e.key.toUpperCase();
    const creds = JSON.parse((localStorage.getItem('chef_session') || localStorage.getItem('chef_credentials')) || '{}');
    const isManagerOrAdmin = ['Admin', 'Administrador', 'adm', 'Gerente'].includes(creds.cargo);
    if (kUpper === 'G') { e.preventDefault(); window.open('/garcom.html', '_blank'); }
    else if (kUpper === 'C' && isManagerOrAdmin) { e.preventDefault(); window.location.href = 'configuracoes.html'; }
    else if (kUpper === 'F' && isManagerOrAdmin) { e.preventDefault(); window.location.href = 'financeiro.html'; }
  }

  // NAVEGAÇÃO DE MESAS COM SETAS (ArrowKeys)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isCheckoutOpen && !isPdvOpen) {
    const mesaCards = Array.from(document.querySelectorAll('.mesa-item'));
    if (mesaCards.length === 0) return;
    e.preventDefault();

    if (window.focusedMesaIndex < 0 || window.focusedMesaIndex >= mesaCards.length) {
      window.focusedMesaIndex = 0;
    } else {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        window.focusedMesaIndex = (window.focusedMesaIndex + 1) % mesaCards.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        window.focusedMesaIndex = (window.focusedMesaIndex - 1 + mesaCards.length) % mesaCards.length;
      }
    }

    mesaCards.forEach((card, idx) => {
      if (idx === window.focusedMesaIndex) {
        card.style.outline = '3px solid #fc4b15';
        card.style.outlineOffset = '2px';
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        card.style.outline = 'none';
      }
    });
  }

  // ENTER PARA ABRIR A MESA EM FOCO
  if (e.key === 'Enter' && window.focusedMesaIndex >= 0 && !isCheckoutOpen && !isPdvOpen) {
    const mesaCards = Array.from(document.querySelectorAll('.mesa-item'));
    if (mesaCards[window.focusedMesaIndex]) {
      e.preventDefault();
      mesaCards[window.focusedMesaIndex].click();
    }
  }
});

// --- LÓGICA DE REDIMENSIONAMENTO E RECOLHIMENTO DA SEÇÃO DE MESAS (MARCAÇÃO AMARELA) ---
(function initMesasSectionResizer() {
  function setupResizer() {
    const splitterV = document.getElementById('splitter-middle-v');
    const mesasContainer = document.getElementById('mesas-section-container');
    const middleWorkspace = document.getElementById('main-panel');
    const btnToggleMesas = document.getElementById('btn-toggle-mesas-section');
    const iconToggle = document.getElementById('icon-toggle-mesas-section');
    const labelToggle = document.getElementById('label-toggle-mesas-section');

    if (!splitterV || !mesasContainer || !middleWorkspace) return;

    let isCollapsed = false;
    let savedHeightPercent = 45;

    function renderItensRecolhidos() {
      const strip = document.getElementById('mesas-collapsed-items');
      if (!strip) return;
      const m = window.mesaAtual;
      if (!m || !m.items || !m.items.length) {
        strip.innerHTML = '<span class="mi-vazio">Nenhuma mesa selecionada</span>';
        return;
      }
      let total = 0, qtd = 0;
      const grupos = {};
      m.items.forEach(o => {
        if (o.status === 'Pago') return;
        const t = parseFloat(String(o.total).replace(',', '.')) || 0;
        total += t;
        qtd += (o.quantity || 1);
        const k = o.productName || 'Produto';
        if (!grupos[k]) grupos[k] = { emoji: o.productEmoji || '', q: 0 };
        grupos[k].q += (o.quantity || 1);
      });
      const chips = Object.entries(grupos).map(([nome, g]) =>
        `<span class="mi-chip">${g.emoji} ${g.q}× ${escHtml(nome)}</span>`).join('');
      strip.innerHTML =
        `<span class="mi-mesa">${escHtml(m.mesaName || m.nome || 'Mesa')}</span>${chips}` +
        `<span class="mi-total">R$ ${total.toFixed(2).replace('.', ',')} · ${qtd} iten${qtd === 1 ? '' : 's'}</span>`;
    }
    window.renderItensRecolhidosMesas = renderItensRecolhidos;

    function toggleMesasSection() {
      isCollapsed = !isCollapsed;
      mesasContainer.classList.toggle('mesas-recolhida', isCollapsed);
      if (isCollapsed) {
        mesasContainer.style.flex = '0 0 auto';
        renderItensRecolhidos();
        if (iconToggle) iconToggle.className = 'ph ph-caret-down';
        if (labelToggle) labelToggle.innerText = 'Expandir';
      } else {
        mesasContainer.style.flex = `0 0 ${savedHeightPercent}%`;
        if (iconToggle) iconToggle.className = 'ph ph-caret-up';
        if (labelToggle) labelToggle.innerText = 'Recolher';
      }
    }

    if (btnToggleMesas) {
      btnToggleMesas.onclick = (e) => {
        e.stopPropagation();
        toggleMesasSection();
      };
    }

    splitterV.onDblClick = toggleMesasSection;
    splitterV.addEventListener('dblclick', toggleMesasSection);

    let isDraggingV = false;

    const initDragV = () => {
      isDraggingV = true;
      splitterV.classList.add('dragging');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    };
    splitterV.addEventListener('mousedown', (e) => {
      e.preventDefault();
      initDragV();
    });
    splitterV.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) initDragV();
    }, { passive: true });

    const doDragV = (clientY) => {
      if (!isDraggingV) return;
      const rect = middleWorkspace.getBoundingClientRect();
      const offsetY = clientY - rect.top;
      let percent = (offsetY / rect.height) * 100;
      if (percent < 10) percent = 10;
      if (percent > 85) percent = 85;

      savedHeightPercent = percent;
      if (isCollapsed) {
        isCollapsed = false;
        if (iconToggle) iconToggle.className = 'ph ph-caret-up';
        if (labelToggle) labelToggle.innerText = 'Recolher';
      }
      mesasContainer.style.flex = `0 0 ${percent}%`;
    };

    document.addEventListener('mousemove', (e) => doDragV(e.clientY));
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) doDragV(e.touches[0].clientY);
    }, { passive: false });

    const stopDragV = () => {
      if (isDraggingV) {
        isDraggingV = false;
        splitterV.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mouseup', stopDragV);
    document.addEventListener('touchend', stopDragV);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupResizer);
  } else {
    setupResizer();
  }
})();

// --- MODAL DE JUNÇÃO DE MESAS INTERATIVO ---
window.selectedTargetMesaJuntar = null;

window.abrirModalJuntarMesas = function () {
  if (!window.mesaAtual || window.mesaAtual.isGroup === false) {
    return alert('Selecione uma mesa ou comanda ocupada primeiro.');
  }

  const nomeOrigem = window.mesaAtual.nome || window.mesaAtual.mesaName;
  const modal = document.getElementById('modal-juntar-mesas');
  const labelOrigem = document.getElementById('modal-juntar-mesa-origem');
  const grid = document.getElementById('modal-juntar-mesas-grid');
  const searchInput = document.getElementById('modal-juntar-busca-input');

  if (labelOrigem) labelOrigem.innerText = nomeOrigem;
  if (searchInput) searchInput.value = '';
  window.selectedTargetMesaJuntar = null;

  if (grid) {
    let html = '';
    const nomesMesasEncontradas = new Set();

    // Capturar mesas ativas do DOM
    const mesaCardsDOM = Array.from(document.querySelectorAll('.mesa-item'));
    mesaCardsDOM.forEach(card => {
      const elNome = card.querySelector('.mesa-id');
      if (elNome) {
        const n = elNome.innerText.trim();
        if (n && n !== nomeOrigem) {
          nomesMesasEncontradas.add(n);
        }
      }
    });

    // Se estiver vazio por algum motivo, preencher de 1 a 30
    if (nomesMesasEncontradas.size === 0) {
      for (let i = 1; i <= 30; i++) {
        const n = `Mesa ${i}`;
        if (n !== nomeOrigem) nomesMesasEncontradas.add(n);
      }
    }

    const listaOrdenada = Array.from(nomesMesasEncontradas).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    listaOrdenada.forEach(nomeMesa => {
      html += `
        <div class="card-juntar-target" data-mesa="${nomeMesa}" onclick="window.selecionarMesaTargetJuntar('${nomeMesa}', this)" style="padding: 12px; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.15s; user-select: none;">
          <div style="font-weight: 700; font-size: 14px; color: #1e293b; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <i class="ph ph-table" style="color: #fc4b15;"></i> ${nomeMesa}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  if (modal) modal.style.display = 'flex';
};

window.selecionarMesaTargetJuntar = function (nomeMesa, el) {
  window.selectedTargetMesaJuntar = nomeMesa;
  document.querySelectorAll('.card-juntar-target').forEach(card => {
    card.style.borderColor = '#e2e8f0';
    card.style.background = 'white';
    card.style.boxShadow = 'none';
  });
  if (el) {
    el.style.borderColor = '#fc4b15';
    el.style.background = '#fff5f0';
    el.style.boxShadow = '0 2px 8px rgba(252,75,21,0.2)';
  }
};

window.filtrarMesasJuntar = function (termo) {
  const termoLower = (termo || '').toLowerCase().trim();
  document.querySelectorAll('.card-juntar-target').forEach(card => {
    const mesaNome = card.getAttribute('data-mesa').toLowerCase();
    if (!termoLower || mesaNome.includes(termoLower)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
};

window.confirmarJuncaoMesasModal = function (mode) {
  if (!window.mesaAtual) return alert('Nenhuma mesa de origem selecionada.');
  if (!window.selectedTargetMesaJuntar) return alert('Selecione uma mesa de destino para juntar.');

  const mesaA = window.mesaAtual.nome || window.mesaAtual.mesaName;
  const mesaB = window.selectedTargetMesaJuntar;
  const operador = window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido';

  if (typeof socket !== 'undefined' && socket) {
    if (mode === 'mover') {
      socket.emit('transferir_mesas_itens', { mesaA, mesaB, operador });
    } else {
      socket.emit('juntar_mesas', { mesaA, mesaB, operador });
    }
  }

  const modal = document.getElementById('modal-juntar-mesas');
  if (modal) modal.style.display = 'none';
};

// --- SISTEMA ANTI-FRAUDE E SOLICITAÇÃO DE SENHA ADMIN / GERENTE (TOUCH PIN) ---
window.pendingAdminAction = null;
let _pinValidating = false;

window.isUsuarioAdminOuGerente = function () {
  try {
    const p = window.crmPerfil || {};
    const cargo = String(p.cargo || p.funcao || p.role || localStorage.getItem('colaborador_cargo') || localStorage.getItem('usuario_cargo') || localStorage.getItem('user_role') || '').toLowerCase();
    const nome = String(p.nome || window.loggedInUser || localStorage.getItem('usuario_logado') || '').toLowerCase();
    if (cargo.includes('admin') || cargo.includes('gerente') || cargo.includes('dono') || cargo.includes('master') || cargo.includes('proprietario') || cargo.includes('supervisor')) return true;
    if (nome.includes('admin') || nome.includes('gerente') || nome.includes('dono') || nome === 'master') return true;
  } catch (e) { }
  return false;
};

window.solicitarAutorizacaoAdmin = function (titulo, detalhe, callback) {
  window.pendingAdminAction = callback;
  _pinValidating = false;

  const modal = document.getElementById('modal-confirmar-senha-admin');
  const elTitulo = document.getElementById('modal-senha-admin-titulo');
  const elDetalhe = document.getElementById('modal-senha-admin-detalhe');
  const inputSenha = document.getElementById('input-modal-senha-admin');
  const inputMotivo = document.getElementById('input-modal-motivo-admin');
  const wrapMotivo = document.getElementById('wrap-modal-motivo-admin');
  const elStatus = document.getElementById('modal-senha-admin-status');

  if (elTitulo && titulo) elTitulo.innerText = titulo;
  if (elDetalhe && detalhe) elDetalhe.innerText = detalhe;
  if (inputSenha) {
    inputSenha.value = '';
    inputSenha.style.borderColor = 'var(--border-color, #334155)';
    inputSenha.style.boxShadow = 'none';
  }
  if (inputMotivo) inputMotivo.value = '';
  if (elStatus) { elStatus.style.display = 'none'; elStatus.innerHTML = ''; }

  // Se o usuário for Dono/Admin/Gerente, motivo é opcional/oculto
  const isAdmin = window.isUsuarioAdminOuGerente();
  if (wrapMotivo) {
    wrapMotivo.style.display = isAdmin ? 'none' : 'block';
  }

  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => { if (inputSenha) inputSenha.focus(); }, 120);
  }
};

window.fecharModalSenhaAdmin = function () {
  const modal = document.getElementById('modal-confirmar-senha-admin');
  if (modal) modal.style.display = 'none';
  window.pendingAdminAction = null;
  _pinValidating = false;
};

window.pinAdminAddDigit = function (digit) {
  const input = document.getElementById('input-modal-senha-admin');
  if (!input) return;
  if (input.value.length >= 12) return;
  input.value += digit;
  window.onPinAdminInput(input.value);
};

window.pinAdminBackspace = function () {
  const input = document.getElementById('input-modal-senha-admin');
  if (!input) return;
  input.value = input.value.slice(0, -1);
  window.onPinAdminInput(input.value);
};

window.pinAdminClear = function () {
  const input = document.getElementById('input-modal-senha-admin');
  if (input) input.value = '';
  const elStatus = document.getElementById('modal-senha-admin-status');
  if (elStatus) { elStatus.style.display = 'none'; elStatus.innerHTML = ''; }
};

window.onPinAdminInput = function (val) {
  const pin = (val || '').trim();
  const elStatus = document.getElementById('modal-senha-admin-status');
  const input = document.getElementById('input-modal-senha-admin');

  if (pin.length < 4) {
    if (elStatus) { elStatus.style.display = 'none'; elStatus.innerHTML = ''; }
    if (input) input.style.borderColor = 'var(--border-color, #334155)';
    return;
  }

  if (_pinValidating) return;

  // Validação automática sem precisar apertar confirmar
  _pinValidating = true;

  const handleValidationResult = (ok) => {
    if (ok) {
      if (input) {
        input.style.borderColor = '#22c55e';
        input.style.boxShadow = '0 0 12px rgba(34,197,94,0.4)';
      }
      if (elStatus) {
        elStatus.style.display = 'block';
        elStatus.style.background = 'rgba(34,197,94,0.15)';
        elStatus.style.color = '#22c55e';
        elStatus.innerHTML = '<i class="ph-bold ph-check-circle"></i> ✨ PIN Correto! Autorizando ação...';
      }

      setTimeout(() => {
        const callback = window.pendingAdminAction;
        const inputMotivo = document.getElementById('input-modal-motivo-admin');
        const motivo = (inputMotivo && inputMotivo.value.trim()) ? inputMotivo.value.trim() : 'Autorizado via PIN Touch';
        window.fecharModalSenhaAdmin();
        if (typeof callback === 'function') {
          callback(pin, motivo);
        }
        if (typeof window.showToast === 'function') {
          window.showToast('✨ Autorizado com sucesso!', 'success');
        }
      }, 350);
    } else {
      _pinValidating = false;
      if (pin.length >= 6) {
        if (input) {
          input.style.borderColor = '#ef4444';
          input.style.boxShadow = '0 0 12px rgba(239,68,68,0.4)';
        }
        if (elStatus) {
          elStatus.style.display = 'block';
          elStatus.style.background = 'rgba(239,68,68,0.15)';
          elStatus.style.color = '#ef4444';
          elStatus.innerHTML = '<i class="ph-bold ph-warning-circle"></i> PIN incorreto. Tente novamente.';
        }
      }
    }
  };

  if (typeof socket !== 'undefined' && socket && socket.connected) {
    socket.emit('validar_pin_admin', { pin: pin }, (res) => {
      handleValidationResult(res && res.ok);
    });
  } else {
    fetch('/api/validar-pin-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin })
    })
      .then(r => r.json())
      .then(data => handleValidationResult(data && data.ok))
      .catch(() => { _pinValidating = false; });
  }
};

window.confirmarSenhaAdminAcao = function () {
  const inputSenha = document.getElementById('input-modal-senha-admin');
  const inputMotivo = document.getElementById('input-modal-motivo-admin');

  const senha = inputSenha ? inputSenha.value.trim() : '';
  const isAdmin = window.isUsuarioAdminOuGerente();
  let motivo = inputMotivo ? inputMotivo.value.trim() : '';

  if (!senha) {
    if (typeof window.showToast === 'function') window.showToast('Por favor, digite o PIN ou senha.', 'warning');
    else alert('Por favor, informe a senha de administrador ou PIN.');
    if (inputSenha) inputSenha.focus();
    return;
  }

  if (!isAdmin && !motivo) {
    if (typeof window.showToast === 'function') window.showToast('Informe o motivo/justificativa obrigatoriamente.', 'warning');
    else alert('Por favor, informe o motivo/justificativa obrigatoriamente.');
    if (inputMotivo) inputMotivo.focus();
    return;
  }

  if (!motivo) motivo = 'Autorizado por Admin/Gerente';

  const callback = window.pendingAdminAction;
  window.fecharModalSenhaAdmin();

  if (typeof callback === 'function') {
    callback(senha, motivo);
  }
};

// --- LOGGING DE AUDITORIA ---
window.registrarLogAuditoria = function (tipo, detalhe, motivo, risco = 'MEDIO') {
  const logObj = {
    dataHora: new Date().toLocaleString('pt-BR'),
    usuario: window.loggedInUser || 'Caixa',
    tipo: tipo,
    detalhe: detalhe,
    motivo: motivo,
    risco: risco
  };

  try {
    let logs = JSON.parse(localStorage.getItem('audit_logs_anti_fraude') || '[]');
    logs.unshift(logObj);
    if (logs.length > 200) logs = logs.slice(0, 200);
    localStorage.setItem('audit_logs_anti_fraude', JSON.stringify(logs));
  } catch (e) { }

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('novo_log_auditoria', logObj);
  }
};

// --- REMOVER ITEM DA MESA PROTEGIDO COM SENHA ---
window.removerItemPedido = function (orderId) {
  if (!orderId) return;

  const mesaNome = window.mesaAtual ? (window.mesaAtual.nome || window.mesaAtual.mesaName) : 'Mesa';

  window.solicitarAutorizacaoAdmin(
    'Autorizar Exclusão de Item',
    `Remover o item da ${mesaNome} exige senha de gerente e justificativa obrigatoriamente.`,
    (motivo) => {
      if (typeof socket !== 'undefined' && socket) {
        socket.emit('remover_item_pedido', {
          orderId: orderId,
          mesaName: mesaNome,
          usuario: window.loggedInUser || 'Caixa',
          motivo: motivo
        });
      }
      window.registrarLogAuditoria('EXCLUSÃO_ITEM_MESA', `Excluído item da ${mesaNome}`, motivo, 'MEDIO');
      alert('Item removido com sucesso!');
    }
  );
};

// --- FECHAMENTO CEGO DE CAIXA ANTI-FRAUDE ---
window.abrirFechamentoCegoCaixa = function () {
  const modal = document.getElementById('modal-fechamento-cego-caixa');
  const inputDinheiro = document.getElementById('input-fechamento-cego-dinheiro');
  const inputObs = document.getElementById('input-fechamento-cego-obs');

  if (inputDinheiro) inputDinheiro.value = '';
  if (inputObs) inputObs.value = '';

  if (modal) modal.style.display = 'flex';
};

window.confirmarFechamentoCegoCaixa = function () {
  const inputDinheiro = document.getElementById('input-fechamento-cego-dinheiro');
  const inputObs = document.getElementById('input-fechamento-cego-obs');

  const contado = inputDinheiro ? parseFloat(inputDinheiro.value) : 0;
  const obs = inputObs ? inputObs.value.trim() : '';

  if (isNaN(contado) || contado < 0) {
    return alert('Por favor, informe o valor total contado na gaveta.');
  }

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('fechar_caixa_cego', {
      valorContado: contado,
      observacao: obs,
      operador: window.crmPerfil ? window.crmPerfil.nome : 'Desconhecido',
      usuario: window.loggedInUser || 'Caixa'
    });
  }

  window.registrarLogAuditoria('FECHAMENTO_CEGO_CAIXA', `Caixa encerrado com R$ ${contado.toFixed(2)} contados na gaveta`, obs || 'Fechamento Cego de Turno', 'INFO');

  const modal = document.getElementById('modal-fechamento-cego-caixa');
  if (modal) modal.style.display = 'none';

  alert(`Caixa encerrado com sucesso! Valor contado de R$ ${contado.toFixed(2).replace('.', ',')} registrado no relatório de auditoria do proprietário.`);
};

// --- SESSÃO DE USUÁRIO & TROCA DE OPERADOR / LOGOUT ---
window.abrirUserModal = function () {
  const modal = document.getElementById('modal-user-session');
  const userDisp = document.getElementById('modal-user-name-display');
  const currentUser = document.getElementById('status-user-name') ? document.getElementById('status-user-name').innerText.trim() : 'Operador';
  if (userDisp) userDisp.innerText = currentUser;
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('lista-aparelhos-conectados').innerHTML = '<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 10px;">Carregando...</div>';
    socket.emit('get_connected_devices');
  }
};

socket.on('connected_devices', (devices) => {
  const container = document.getElementById('lista-aparelhos-conectados');
  if (!container) return;

  if (!devices || devices.length === 0) {
    container.innerHTML = '<div style="font-size: 13px; color: #94a3b8; text-align: center; padding: 16px;">Nenhum aparelho conectado no momento</div>';
    return;
  }

  container.innerHTML = devices.map(d => {
    const iconClass = d.icon || (d.isMobile ? 'ph-device-mobile' : 'ph-desktop');
    const userStr = d.user || 'Visitante';
    const cargoStr = d.cargo || (d.user === 'Visitante' ? 'Sem Login' : 'Operador');
    const modelStr = d.model || 'Dispositivo Web';
    const osStr = d.os ? `${d.os} • ${d.browser}` : (d.device || '');
    const tempoStr = d.tempoConectadoStr || 'Pouco tempo';

    return `
      <div style="padding: 12px; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 12px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--bg-secondary); color: #334155; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
            <i class="ph ${iconClass}"></i>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <strong style="font-size: 14px; color: #0f172a;">${userStr}</strong>
              <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-weight: 700;">${cargoStr}</span>
            </div>
            <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">📱 ${modelStr}</span>
            <span style="font-size: 11px; color: var(--text-secondary);">🌐 IP: ${d.ip} | ${osStr}</span>
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 6px; background: #ecfdf5; padding: 3px 8px; border-radius: 20px;">
            <div style="width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></div>
            <span style="font-size: 11px; font-weight: 700; color: #047857;">Online</span>
          </div>
          <span style="font-size: 11px; color: #94a3b8; font-weight: 500;">⏱️ ${tempoStr}</span>
        </div>
      </div>
    `;
  }).join('');
});
socket.on('server_status_update', (devices) => {
  socket.emit('get_connected_devices');
});

window.trocarUsuario = function () {
  const modal = document.getElementById('modal-user-session');
  if (modal) modal.style.display = 'none';
  const novoNome = prompt('Digite o nome do novo usuário/operador:');
  if (novoNome && novoNome.trim()) {
    const cleanName = novoNome.trim();
    const userEl = document.getElementById('status-user-name');
    if (userEl) userEl.innerText = cleanName;
    localStorage.setItem('logged_user', cleanName);
    alert(`Usuário alterado com sucesso para "${cleanName}"!`);
  }
};

window.fazerLogout = function () {
  if (confirm('Deseja realmente encerrar a sessão do Operador?')) {
    localStorage.removeItem('logged_user');
    window.location.href = '/painel-funcionario.html';
  }
};

window.desconectarSaaS = function () {
  const creds = JSON.parse(localStorage.getItem('chef_app_creds') || '{}');
  const role = (creds.cargo || '').toLowerCase();
  if (role === 'admin' || role === 'administrador' || role === 'gerente') {
    if (confirm('ATENÇÃO: Deseja desconectar este aparelho do Restaurante SaaS?')) {
      localStorage.removeItem('logged_user');
      localStorage.removeItem('chef_token');
      localStorage.removeItem('restaurante_id');
      localStorage.removeItem('chef_app_creds');
      localStorage.removeItem('chef_credentials');
      window.location.href = '/login.html';
    }
  } else {
    alert('Apenas gerentes e administradores podem desconectar o sistema.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('logged_user');
  const userEl = document.getElementById('status-user-name');
  if (userEl) {
    if (savedUser) {
      userEl.innerText = savedUser;
    } else if (userEl.innerText === 'Carregando...' || !userEl.innerText) {
      userEl.innerText = 'spy';
    }
  }
});

// --- CENTRAL DE CADASTROS ---
window.abrirModalCadastro = function () {
  const modal = document.getElementById('modal-central-cadastro');
  if (modal) modal.style.display = 'flex';
};

window.abrirCadastroTab = function (tabName) {
  const modal = document.getElementById('modal-central-cadastro');
  if (modal) modal.style.display = 'none';
  window.location.href = `/configuracoes.html?tab=${tabName}`;
};

// --- MÓDULO FISCAL NFC-E CLIENTE ---
window.todasNotasNfce = [];

window.abrirModalNfce = function () {
  const modal = document.getElementById('nfce-overlay');
  if (modal) modal.style.display = 'flex';
  window.carregarNotasNfce();
};

window.carregarNotasNfce = function () {
  let creds = {};
  try { creds = JSON.parse(localStorage.getItem('chef_app_creds') || '{}'); } catch (e) { }
  const role = (creds.cargo || '').toLowerCase();
  const isAdmin = ['admin', 'administrador', 'gerente'].includes(role);
  const opts = isAdmin ? { period: 'semana' } : {};
  const limit = isAdmin ? 300 : 50;

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('get_nfce_notas', opts);
  } else {
    fetch('/api/nfce/notas?limit=' + limit + '&restaurante_id=' + encodeURIComponent(localStorage.getItem('restaurante_id') || '1'))
      .then(r => r.json())
      .then(data => {
        window.todasNotasNfce = data || [];
        window.filtrarNotasNfce();
      })
      .catch(e => console.error('Erro ao buscar NFC-e:', e));
  }
};

if (typeof socket !== 'undefined' && socket) {
  socket.on('nfce_lista_atualizada', (rows) => {
    window.todasNotasNfce = rows || [];
    window.filtrarNotasNfce();
  });

  socket.on('nfce_emitida_sucesso', (res) => {
    if (res && res.ok) {
      const printBtn = document.createElement('button');
      printBtn.innerHTML = '🖨️ Imprimir DANFE NFC-e';
      printBtn.style.cssText = 'padding: 10px 16px; background: #27ae60; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; font-size: 13px; display: flex; align-items: center; gap: 6px;';
      printBtn.onclick = () => window.imprimirDanfeNfce(res.notaId);

      const popup = document.createElement('div');
      popup.style.cssText = 'position: fixed; bottom: 25px; right: 25px; background: var(--bg-card); border-left: 6px solid #27ae60; border-radius: 12px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); z-index: 100000; font-family: sans-serif; max-width: 380px; animation: slideIn 0.3s ease;';
      popup.innerHTML = '<h4 style="margin:0 0 8px 0; color:#1e293b; font-size:16px;">✅ NFC-e Emitida!</h4><p style="margin:0; font-size:14px; color: var(--text-secondary);">A Nota Fiscal foi autorizada pela SEFAZ.</p>';
      popup.appendChild(printBtn);
      document.body.appendChild(popup);

      setTimeout(() => popup.remove(), 10000);
    }
  });
}
window.filtrarNotasNfce = function () {
  const tbody = document.getElementById('nfce-tabela-body');
  const searchInput = document.getElementById('nfce-search-input');
  const statusFilter = document.getElementById('nfce-status-filter');

  if (!tbody) return;

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const statusSel = statusFilter ? statusFilter.value : 'TODOS';

  const filtradas = (window.todasNotasNfce || []).filter(n => {
    if (statusSel !== 'TODOS' && n.status !== statusSel) return false;
    if (query) {
      const matchNum = String(n.numero_nota || '').includes(query);
      const matchCpf = (n.cpf_cnpj || '').toLowerCase().includes(query);
      const matchMesa = (n.localName || '').toLowerCase().includes(query);
      const matchChave = (n.chave_acesso || '').toLowerCase().includes(query);
      const matchCliente = (n.cliente_nome || '').toLowerCase().includes(query);
      return matchNum || matchCpf || matchMesa || matchChave || matchCliente;
    }
    return true;
  });

  let totalEmitido = 0;
  let countAut = 0;
  let countCanc = 0;

  (window.todasNotasNfce || []).forEach(n => {
    if (n.status === 'Autorizada') {
      totalEmitido += parseFloat(n.valor_total || 0);
      countAut++;
    } else if (n.status === 'Cancelada') {
      countCanc++;
    }
  });

  const elTot = document.getElementById('nfce-total-valor');
  const elAut = document.getElementById('nfce-count-autorizadas');
  const elCanc = document.getElementById('nfce-count-canceladas');

  if (elTot) elTot.innerText = 'R$ ' + totalEmitido.toFixed(2).replace('.', ',');
  if (elAut) elAut.innerText = countAut;
  if (elCanc) elCanc.innerText = countCanc;

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #888;">Nenhuma Nota Fiscal (NFC-e) encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = filtradas.map(n => {
    const dataFmt = n.created_at ? new Date(n.created_at).toLocaleString('pt-BR') : '---';
    const cpfFmt = n.cpf_cnpj ? n.cpf_cnpj : 'Consumidor Não Identificado';
    const valFmt = 'R$ ' + parseFloat(n.valor_total || 0).toFixed(2).replace('.', ',');
    const badgeColor = n.status === 'Autorizada' ? '#27ae60' : (n.status === 'Cancelada' ? '#eb5757' : '#f39c12');

    return `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 10px; font-weight: bold;">Nº ${String(n.numero_nota).padStart(6, '0')}</td>
        <td style="padding: 10px; font-size: 12px; color: #555;">${dataFmt}</td>
        <td style="padding: 10px; font-weight: 500;">${n.localName || 'Mesa'}</td>
        <td style="padding: 10px; font-size: 12px; color: var(--text-primary);">${cpfFmt}</td>
        <td style="padding: 10px; font-weight: bold; color: var(--text-primary);">${valFmt}</td>
        <td style="padding: 10px; text-align: center;">
          <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">
            ${n.status || 'Autorizada'}
          </span>
        </td>
        <td style="padding: 10px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button onclick="window.imprimirDanfeNfce(${n.id})" title="Imprimir DANFE" style="background: #27ae60; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: bold; cursor: pointer;">
              🖨️ DANFE
            </button>
            <button onclick="window.baixarXmlNfce(${n.id})" title="Download XML" style="background: #2563eb; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: bold; cursor: pointer;">
              📄 XML
            </button>
            ${n.status === 'Autorizada' ? `
              <button onclick="window.cancelarNotaNfce(${n.id}, ${n.numero_nota})" title="Cancelar Nota" style="background: #eb5757; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: bold; cursor: pointer;">
                ✖ Cancelar
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
};


// --- MÓDULO DE FILA DE ESPERA DE CLIENTES PARA MESAS ---
window.filaEsperaDados = [];

window.abrirFilaEsperaModal = function () {
  const modal = document.getElementById('modal-fila-espera');
  if (modal) modal.style.display = 'flex';
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('get_fila_espera');
  }
};

window.abrirQrFilaEsperaModal = function () {
  const modal = document.getElementById('modal-qr-fila-espera');
  if (modal) modal.style.display = 'flex';
  const url = buildAppUrl('cardapio.html?modo=fila');
  const display = document.getElementById('display-url-fila-espera');
  if (display) display.textContent = url;
  const container = document.getElementById('container-qr-fila-espera');
  if (!container) return;
  container.innerHTML = '';
  const qrImgEl = document.createElement('img');
  qrImgEl.width = 180;
  qrImgEl.height = 180;
  qrImgEl.style.imageRendering = 'pixelated';
  container.appendChild(qrImgEl);
  if (typeof window.qrImg === 'function') {
    window.qrImg(qrImgEl, url, 180);
  } else {
    qrImgEl.src = (window.location.origin || '') + '/api/qr?size=180&data=' + encodeURIComponent(url);
  }
};

window.adicionarClienteFilaEspera = function () {
  const inpNome = document.getElementById('input-fila-nome');
  const inpTel = document.getElementById('input-fila-telefone');
  const inpPessoas = document.getElementById('input-fila-pessoas');
  const inpPref = document.getElementById('input-fila-preferencia');
  const inpObs = document.getElementById('input-fila-obs');

  const nome = inpNome ? inpNome.value.trim() : '';
  if (!nome) return alert('Informe o nome do cliente.');

  const telefone = inpTel ? inpTel.value.trim() : '';
  const pessoas = inpPessoas ? parseInt(inpPessoas.value) || 2 : 2;
  const mesa_preferida = inpPref ? inpPref.value.trim() : '';
  const observacao = inpObs ? inpObs.value.trim() : '';

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('adicionar_fila_espera', {
      cliente_nome: nome,
      cliente_telefone: telefone,
      pessoas,
      mesa_preferida,
      observacao
    });
  }

  if (inpNome) inpNome.value = '';
  if (inpTel) inpTel.value = '';
  if (inpPref) inpPref.value = '';
  if (inpObs) inpObs.value = '';
};

window.removerClienteFilaEspera = function (id) {
  if (!confirm('Deseja remover este cliente da fila de espera?')) return;
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('remover_fila_espera', id);
  }
};

window.chamarClienteWhatsapp = function (id, nome, telefone, pessoas) {
  if (!telefone) {
    alert('Telefone do cliente não informado.');
    return;
  }
  const telLimpo = telefone.replace(/\D/g, '');
  const numCompleto = telLimpo.length <= 11 ? '55' + telLimpo : telLimpo;
  const texto = encodeURIComponent(`Olá ${nome}! Sua mesa (${pessoas} pessoas) no restaurante está pronta! Por favor, dirija-se à recepção.`);
  window.open(`https://wa.me/${numCompleto}?text=${texto}`, '_blank');
  
  if (typeof socket !== 'undefined' && socket && id) {
    socket.emit('atualizar_status_fila_espera', { id: id, status: 'Notificado' });
  }
};

window.filaEnviarAviso = function (id, nomeCliente) {
  const mensagem = prompt(`Enviar aviso para ${nomeCliente}:`, '');
  if (mensagem === null || !mensagem.trim()) return;
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('fila_enviar_aviso', { fila_id: id, mensagem: mensagem.trim() });
  }
};

// Resposta do envio de aviso
if (typeof socket !== 'undefined' && socket) {
  socket.on('fila_aviso_enviado', (d) => {
    if (d && d.cliente) {
      showToastIA(`Aviso enviado para ${d.cliente}!`, '#7c3aed');
    }
  });
  socket.on('fila_erro', (msg) => {
    if (msg) showToastIA(String(msg), '#dc2626');
  });
}

window.acomodarClienteFilaPrompt = function (id, nomeCliente) {
  const isAuto = window.pdvConfigs && window.pdvConfigs.rest_fila_alocacao_auto === 'auto';
  const mesasLivres = (window.allMesas || []).filter(m => m.status === 'Disponível' || m.status === 'Livre').map(m => m.nome || m.mesaName);
  
  if (isAuto) {
    if (mesasLivres.length === 0) {
      alert('Nenhuma mesa livre disponível no momento para oferta automática.');
      return;
    }
    const sugestaoMesa = mesasLivres[0];
    if (confirm(`Alocação Automática ativa:\nDeseja ofertar a ${sugestaoMesa} para ${nomeCliente}? (O cliente aceitará ou recusará no celular)`)) {
      if (typeof socket !== 'undefined' && socket) {
        socket.emit('acomodar_cliente_fila', { id: id, mesaName: sugestaoMesa, autoOffer: true });
      }
      return;
    }
  }

  let sugestaoMsg = mesasLivres.length > 0 ? `Mesas livres disponíveis: ${mesasLivres.join(', ')}` : 'Nenhuma mesa livre no momento.';
  const mesaName = prompt(`Informe a mesa para acomodar ${nomeCliente}:\n(${sugestaoMsg})`, mesasLivres[0] || 'Mesa 1');
  if (!mesaName || !mesaName.trim()) return;

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('acomodar_cliente_fila', { id: id, mesaName: mesaName.trim() });
  }
};

function renderFilaEsperaTabela(rows) {
  window.filaEsperaDados = rows || [];
  const tbody = document.getElementById('tbody-fila-espera');
  const countEl = document.getElementById('info-fila-espera-count');

  if (countEl) countEl.innerText = window.filaEsperaDados.length;
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8; font-weight: 500;"><i class="ph ph-users" style="font-size: 24px; display: block; margin-bottom: 4px; color: #cbd5e1;"></i> Nenhum cliente na fila de espera no momento.</td></tr>';
    return;
  }

  const agora = new Date();

  tbody.innerHTML = rows.map((r, index) => {
    let minsEspera = 0;
    if (r.criado_em) {
      const dt = new Date(r.criado_em.includes('T') ? r.criado_em : r.criado_em.replace(' ', 'T'));
      if (!isNaN(dt.getTime())) minsEspera = Math.floor((agora - dt) / 60000);
    }
    minsEspera = Math.max(0, minsEspera);
    
    let statusTag = '';
    if (r.status === 'Notificado') {
      statusTag = `<span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;"><i class="ph ph-bell-ringing"></i> Notificado (${minsEspera}m)</span>`;
    } else if (r.status === 'Mesa Ofertada' || r.mesa_ofertada) {
      statusTag = `<span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;"><i class="ph ph-check-circle"></i> Ofertado (${escHtml(r.mesa_ofertada || '')})</span>`;
    } else {
      const badgeColor = minsEspera > 30 ? '#dc2626' : (minsEspera > 15 ? '#d97706' : '#16a34a');
      const badgeBg = minsEspera > 30 ? '#fef2f2' : (minsEspera > 15 ? '#fffbe6' : '#f0fdf4');
      const badgeBorder = minsEspera > 30 ? '#fecaca' : (minsEspera > 15 ? '#ffe58f' : '#bbf7d0');
      const pulseStyle = minsEspera > 30 ? 'animation: pulse 1.5s infinite;' : '';
      statusTag = `<span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px; ${pulseStyle}"><i class="ph ph-clock"></i> ${minsEspera} min</span>`;
    }

    const prefObs = [r.mesa_preferida ? `Pref: ${r.mesa_preferida}` : '', r.observacao || ''].filter(Boolean).join(' - ') || '—';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;">
        <td style="padding: 12px 10px; font-weight: 700; color: #0f172a;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: var(--bg-secondary); color: var(--text-secondary); border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0;">${index + 1}</span>
            <div>
              <div>${escHtml(r.cliente_nome)}</div>
              ${r.cliente_telefone ? `<div style="font-weight: normal; font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;"><i class="ph ph-whatsapp-logo" style="color: #25d366;"></i> ${escHtml(r.cliente_telefone)}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding: 12px 10px; text-align: center; font-weight: 800; color: #d97706; font-size: 14px;">${r.pessoas || 2}p</td>
        <td style="padding: 12px 10px;">${statusTag}</td>
        <td style="padding: 12px 10px; font-size: 12px; color: var(--text-secondary);">${escHtml(prefObs)}</td>
        <td style="padding: 12px 10px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
            <button onclick="window.acomodarClienteFilaPrompt(${r.id}, '${escHtml(r.cliente_nome).replace(/'/g, "\\'")}')" title="Acomodar na Mesa" style="background: #10b981; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11.5px; display: flex; align-items: center; gap: 4px; transition: 0.15s;">
              <i class="ph ph-armchair"></i> Sentar
            </button>
            ${r.status !== 'Acomodado' && r.status !== 'Cancelado' && r.status !== 'Concluido' ? `
            <button onclick="window.filaEnviarAviso(${r.id}, '${escHtml(r.cliente_nome).replace(/'/g, "\\'")}')" title="Enviar aviso para o cliente" style="background: #7c3aed; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11.5px; display: flex; align-items: center; gap: 4px; transition: 0.15s;">
              <i class="ph ph-megaphone"></i> Avisar
            </button>
            ` : ''}
            ${r.cliente_telefone ? `
              <button onclick="window.chamarClienteWhatsapp(${r.id}, '${escHtml(r.cliente_nome).replace(/'/g, "\\'")}', '${r.cliente_telefone}', ${r.pessoas || 2})" title="Chamar no WhatsApp" style="background: #25d366; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11.5px; display: flex; align-items: center; gap: 4px; transition: 0.15s;">
                <i class="ph ph-whatsapp-logo"></i> Chamar
              </button>
            ` : ''}
            <button onclick="window.removerClienteFilaEspera(${r.id})" title="Remover da Fila" style="background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-color); padding: 6px 9px; border-radius: 6px; cursor: pointer; font-size: 11px; transition: 0.15s;">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

if (typeof socket !== 'undefined' && socket) {
  socket.on('fila_espera_atualizada', (rows) => {
    renderFilaEsperaTabela(rows);
  });
}

// Timer para atualizar tempos de espera na tela a cada 15 segundos
setInterval(() => {
  const modal = document.getElementById('modal-fila-espera');
  if (modal && modal.style.display !== 'none' && window.filaEsperaDados && window.filaEsperaDados.length > 0) {
    renderFilaEsperaTabela(window.filaEsperaDados);
  }
}, 15000);

// Hide unauthorized UI elements for non-manager/non-admin roles
(function () {
  function checkAndHideUnauthorizedUI() {
    const credsStr = (localStorage.getItem('chef_session') || localStorage.getItem('chef_credentials'));
    if (!credsStr) return;
    try {
      const creds = JSON.parse(credsStr);
      const isManagerOrAdmin = ['Admin', 'Administrador', 'adm', 'Gerente'].includes(creds.cargo);
      if (!isManagerOrAdmin) {
        // Dropdown Items
        const mnuFin = document.getElementById('menu-financeiro');
        if (mnuFin) mnuFin.style.display = 'none';
        const mnuRel = document.getElementById('menu-relatorios');
        if (mnuRel) mnuRel.style.display = 'none';
        const mnuConf = document.getElementById('menu-configuracoes');
        if (mnuConf) mnuConf.style.display = 'none';

        // Menu Trigger for Cadastro
        const mnuCad = document.getElementById('menu-cadastro');
        if (mnuCad) mnuCad.style.display = 'none';

        // Toolbar Buttons
        const btnFin = document.getElementById('btn-financeiro-panel');
        if (btnFin) btnFin.style.display = 'none';
        const btnAdmin = document.getElementById('btn-admin-panel');
        if (btnAdmin) btnAdmin.style.display = 'none';
      }
    } catch (e) {
      console.error('Error applying UI role restrictions:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndHideUnauthorizedUI);
  } else {
    checkAndHideUnauthorizedUI();
  }
})();

// --- QR CODE PEDIDOS CAIXA LOGIC ---
let pendingQrOrders = [];

socket.on('qr_pedidos_pendentes_list', (list) => {
  pendingQrOrders = list || [];

  const badge = document.getElementById('btn-qr-pedidos-pendentes');
  const countSpan = document.getElementById('qr-pedidos-pendentes-count');

  if (badge && countSpan) {
    if (pendingQrOrders.length > 0) {
      badge.style.display = 'flex';
      countSpan.innerText = pendingQrOrders.length;
    } else {
      badge.style.display = 'none';

      const modal = document.getElementById('modal-qr-pedidos-pendentes');
      if (modal && modal.style.display === 'flex') {
        modal.style.display = 'none';
      }
    }
  }

  renderQrPedidosPendentesList();
});

socket.on('validacao_pedido_necessaria', ({ id, mesa, mesa_origem, cliente_nome }) => {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:#fffbeb;border:1.5px solid #f59e0b;border-radius:12px;padding:16px 20px;box-shadow:0 8px 30px rgba(0,0,0,0.12);display:flex;align-items:center;gap:12px;animation:slideInRight .4s ease;max-width:400px;font-family:system-ui,-apple-system,sans-serif;';
  toast.innerHTML = '<i class="ph ph-warning" style="color:#d97706;font-size:24px;"></i><div><strong style="color:#92400e;font-size:14px;">⚠️ Validação Necessária</strong><div style="color:#a16207;font-size:13px;margin-top:2px;">' + escHtml(cliente_nome || 'Cliente') + ' trocou de mesa (' + escHtml(mesa_origem || '?') + ' → ' + escHtml(mesa) + '). Garçom deve confirmar no local.</div></div>';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; }, 6000);
  setTimeout(() => toast.remove(), 6500);
});

window.abrirModalQrPendentes = () => {
  const modal = document.getElementById('modal-qr-pedidos-pendentes');
  if (modal) {
    modal.style.display = 'flex';
    renderQrPedidosPendentesList();
  }
};

function renderQrPedidosPendentesList() {
  const container = document.getElementById('qr-pedidos-list-container');
  if (!container) return;

  if (pendingQrOrders.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 30px;">Nenhum pedido QR Code pendente.</div>';
    return;
  }

  container.innerHTML = pendingQrOrders.map(order => {
    let items = [];
    try {
      items = JSON.parse(order.itens_json || '[]');
    } catch (e) { }

    const itemsHtml = items.map(item => `
      <div style="font-size: 13.5px; color: #334155; margin-bottom: 4px; display: flex; justify-content: space-between; font-weight: 500;">
        <span>${item.quantity}x ${item.productEmoji || '🍽️'} ${item.productName}</span>
        <span style="color: var(--text-secondary);">R$ ${(parseFloat(String(item.total).replace(',', '.')) * item.quantity).toFixed(2).replace('.', ',')}</span>
      </div>
    `).join('');

    const paymentLabel = order.pago_pix
      ? '<span style="background: #e6fcf5; color: #0ca678; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;"><i class="ph ph-check-circle"></i> Pago via Pix (Aguardando Verificação)</span>'
      : '<span style="background: #fff0f0; color: #c92a2a; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Pagar no Caixa ao fechar conta</span>';

    const needsValidation = order.requires_validacao === 1;
    const validationBanner = needsValidation
      ? `<div style="background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; gap: 8px;">
           <i class="ph ph-warning" style="color: #d97706; font-size: 20px;"></i>
           <div style="flex:1;">
             <strong style="color: #92400e; font-size: 12px;">⚠️ VALIDAÇÃO NECESSÁRIA</strong>
             <div style="font-size: 12px; color: #a16207; margin-top: 2px;">Cliente trocou de mesa${order.mesa_origem ? ' (' + order.mesa_origem + ' → ' + order.mesa + ')' : ''}. Um garçom deve confirmar no local.</div>
           </div>
         </div>`
      : '';

    const approveButton = needsValidation
      ? `<button id="btn-qr-approve-${order.id}" onclick="window.aprovarPedidoQr(${order.id})" style="flex: 1; padding: 10px; background: #f59e0b; color: #1e293b; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s; outline:none;" onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">
            <i class="ph ph-check"></i> Validado pelo Garçom / Enviar p/ Cozinha
          </button>`
      : `<button id="btn-qr-approve-${order.id}" onclick="window.aprovarPedidoQr(${order.id})" style="flex: 1; padding: 10px; background: #3ab55b; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s; outline:none;" onmouseover="this.style.background='#2f9e4f'" onmouseout="this.style.background='#3ab55b'">
            <i class="ph ph-check"></i> Aceitar / Enviar p/ Cozinha
          </button>`;

    return `
      <div style="background: var(--bg-secondary); border: 1px solid ${needsValidation ? '#f59e0b' : '#e2e8f0'}; border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
        ${validationBanner}
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px;">
          <div>
            <strong style="color: #0f172a; font-size: 15px;">${order.mesa}</strong>
            <span style="font-size: 13px; color: var(--text-secondary); margin-left: 6px;">Cliente: ${order.cliente_nome}${order.cliente_telefone ? ' · ' + order.cliente_telefone : ''}</span>
            ${order.cliente_nome ? `<div style="margin-top: 4px;"><span style="background: #f3e8ff; color: #7c3aed; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Comanda - ${order.cliente_nome}</span></div>` : ''}
          </div>
          <span style="font-size: 11.5px; color: #94a3b8;">${new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        
        <div style="padding: 4px 0;">
          ${itemsHtml}
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 4px;">
          <div>
            ${paymentLabel}
          </div>
          <div style="font-size: 15px; font-weight: 800; color: #fc4b15;">
            Total: R$ ${parseFloat(order.valor_total).toFixed(2).replace('.', ',')}
          </div>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          ${approveButton}
          <button onclick="window.recusarPedidoQr(${order.id})" style="padding: 10px 14px; background: #fff0f0; color: #c92a2a; border: 1px solid #ffc9c9; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s; outline:none;" onmouseover="this.style.background='#ffe3e3'" onmouseout="this.style.background='#fff0f0'">
            <i class="ph ph-trash"></i> Recusar
          </button>
        </div>
      </div>
    `;
  }).join('');
}

const approvingQrIds = new Set();

window.aprovarPedidoQr = (id) => {
  if (approvingQrIds.has(id)) return;
  approvingQrIds.add(id);

  const btn = document.getElementById('btn-qr-approve-' + id);
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
    btn.innerHTML = '<i class="ph ph-spinner"></i> Enviando...';
  }
  socket.emit('aprovar_pedido_qr', { id });
};

window.recusarPedidoQr = (id) => {
  if (!confirm('Tem certeza que deseja recusar este pedido? O cliente será notificado.')) return;
  socket.emit('recusar_pedido_qr', { id });
};

socket.on('aprovar_pedido_qr_resposta', (res) => {
  if (res && !res.success) {
    alert(res.error || 'Erro ao aprovar pedido QR.');
    approvingQrIds.clear();
  } else if (res && res.success) {
    const modal = document.getElementById('modal-qr-pedidos-pendentes');
    if (modal) modal.style.display = 'none';
    approvingQrIds.clear();
  }
});

socket.on('recusar_pedido_qr_resposta', (res) => {
  if (res && !res.success) {
    alert(res.error || 'Erro ao recusar pedido QR.');
  }
});

// Emit request to fetch pending QR orders on connect
socket.on('connect', () => {
  socket.emit('get_qr_pedidos_pendentes');
  socket.emit('get_mesas');
});
if (socket.connected) {
  socket.emit('get_qr_pedidos_pendentes');
  socket.emit('get_mesas');
}

// --- LOGICA DO QR CODE DA MESA ---
// main.js roda no <head>, antes do DOM existir: aguarda o DOMContentLoaded
// para anexar os listeners (caso contrário getElementById retorna null).
document.addEventListener('DOMContentLoaded', () => {
const btnQrMesa = document.getElementById('btn-qr-mesa');
const modalQrMesa = document.getElementById('modal-qr-mesa');
const imgQrMesa = document.getElementById('qr-mesa-img');
const titleQrMesa = document.getElementById('qr-mesa-title');
const btnPrintQr = document.getElementById('btn-print-qr-mesa');

if (btnQrMesa) {
  btnQrMesa.addEventListener('click', () => {
    const mesaLabel = document.getElementById('info-mesa-nome');
    if (!mesaLabel || mesaLabel.innerText === '-' || mesaLabel.innerText.trim() === '') {
      alert('Selecione uma mesa primeiro clicando nela.');
      return;
    }

    const mesaNome = mesaLabel.innerText.trim();
    if (titleQrMesa) titleQrMesa.innerHTML = `<i class="ph ph-qr-code" style="font-size: 24px;"></i> Cardápio Digital - ${escHtml(mesaNome)}`;

    // Generate QR Code pointing to cardapio.html
    const appUrl = buildAppUrl('cardapio.html', mesaNome);
    if (imgQrMesa) {
      if (typeof window.qrImg === 'function') {
        window.qrImg(imgQrMesa, appUrl, 350);
      } else {
        imgQrMesa.src = (window.location.origin || '') + '/api/qr?size=350&data=' + encodeURIComponent(appUrl);
      }
    }

    if (modalQrMesa) modalQrMesa.style.display = 'flex';
  });
}

if (btnPrintQr) {
  btnPrintQr.addEventListener('click', () => {
    const mesaNome = document.getElementById('info-mesa-nome').innerText.trim();
    const qrSrc = imgQrMesa.src;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code - ${mesaNome}</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            h1 { color: var(--text-primary); margin-bottom: 20px; font-size: 32px; }
            img { width: 350px; height: 350px; border: 2px solid var(--border-color); border-radius: 10px; padding: 15px; }
            p { font-size: 18px; color: #666; margin-top: 15px; }
          </style>
        </head>
        <body>
          <h1>${mesaNome}</h1>
          <img src="${qrSrc}" alt="QR Code">
          <p>Escaneie com a câmera do celular para abrir o cardápio e fazer o pedido.</p>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  });
}
});

window.socket.on('erro_servidor', (msg) => alert('Erro no Servidor: ' + msg));

// ── Controle Remoto pelo Dono: Navegar para outra página ──
socket.on('navegar_para', function(data) {
  var destino = data && data.destino;
  var solicitadoPor = data && data.solicitadoPor;
  if (!destino) return;
  console.log('[Controle Remoto] Navegando para ' + destino + ' (por ' + (solicitadoPor || 'Dono') + ')');
  var banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#000;padding:20px 24px;font-size:20px;font-weight:800;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
  banner.textContent = '📡 ' + (solicitadoPor || 'Dono') + ' redirecionou este terminal para ' + destino + '...';
  document.body.appendChild(banner);
  setTimeout(function() { window.location.href = '/' + destino; }, 2000);
});

// ── Controle Remoto pelo Dono: Ações Instantâneas no Caixa ──
socket.on('comando_caixa_acao', function(data) {
  if (!data || !data.acao) return;
  const acao = data.acao;
  const solicitadoPor = data.solicitadoPor || 'Dono';

  if (acao === 'recarregar') {
    if (typeof showToast === 'function') showToast(`📡 ${solicitadoPor} recarregou o sistema...`, '#fc4b15');
    setTimeout(() => window.location.reload(), 1200);
  } else if (acao === 'bloquear_tela') {
    if (typeof window.fecharTodosModaisEPopups === 'function') window.fecharTodosModaisEPopups();
    if (typeof window.abrirModalSenhaAdmin === 'function') {
      window.abrirModalSenhaAdmin('Terminal bloqueado remotamente pelo Dono', () => {});
    } else {
      alert(`🔒 Terminal bloqueado remotamente por ${solicitadoPor}`);
    }
  } else if (acao === 'tocar_alerta') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch(e) {}
    if (typeof showToast === 'function') showToast(`🔔 Chamada de atenção do Dono (${solicitadoPor})!`, '#e11d48');
  } else if (acao === 'alternar_tema') {
    if (window.ChefTheme && typeof window.ChefTheme.toggle === 'function') {
      window.ChefTheme.toggle();
    }
  } else if (acao === 'abrir_gaveta') {
    if (typeof window.abrirGavetaDinheiro === 'function') window.abrirGavetaDinheiro();
    if (typeof showToast === 'function') showToast(`🖨️ Gaveta acionada por ${solicitadoPor}`, '#16a34a');
  } else if (acao === 'abrir_fila') {
    if (typeof window.abrirFilaEsperaModal === 'function') window.abrirFilaEsperaModal();
  } else if (acao === 'abrir_relatorio') {
    if (typeof window.abrirRelatoriosModal === 'function') window.abrirRelatoriosModal();
  }
});

// ── Aviso Urgente do Dono para a Equipe ──
socket.on('aviso_dono', function(data) {
  var texto = data && data.texto;
  var hora = data && data.hora;
  if (!texto) return;
  var avisoEl = document.getElementById('aviso-dono-banner');
  if (!avisoEl) {
    avisoEl = document.createElement('div');
    avisoEl.id = 'aviso-dono-banner';
    avisoEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99998;background:#7c3aed;color:white;padding:18px 28px;border-radius:18px;font-size:18px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.4);max-width:90vw;text-align:center;transition:opacity 0.4s;';
    document.body.appendChild(avisoEl);
  }
  avisoEl.innerHTML = '📢 <strong>Aviso do Dono:</strong> ' + texto + (hora ? '<span style=\'opacity:0.7;font-size:14px;display:block;margin-top:4px;\'>' + hora + '</span>' : '');
  avisoEl.style.opacity = '1';
  if (avisoEl._timeout) clearTimeout(avisoEl._timeout);
  avisoEl._timeout = setTimeout(function() { avisoEl.style.opacity = '0'; }, 8000);
});

// --- IA CAIXA: Alertas Inteligentes, Manobras & Zoom de Cards ---
function removerAlertaIA(btnOuEl) {
  const card = btnOuEl.closest ? btnOuEl.closest('.ia-card, [data-pedido-id]') : btnOuEl;
  if (card && card.remove) {
    card.remove();
  }
  if (typeof window.atualizarEstadoPainelIA === 'function') {
    window.atualizarEstadoPainelIA();
  }
}

if (typeof socket !== 'undefined' && socket.on) {
  socket.on('ia_alerta_caixa', (data) => {
    const { nivel, mesa, produto, minutos, mensagem, sugestoes, pedidoId } = data;
    const bgColor = nivel === 'critico' ? '#ef4444' : '#f59e0b';
    const icon = nivel === 'critico' ? '<i class="ph ph-warning-circle"></i>' : '<i class="ph ph-warning"></i>';

    // Toast notification
    showToastIA(`${icon} ${mensagem}`, bgColor);

    // Notificação do navegador
    if ('Notification' in window && Notification.permission === 'granted') {
      if (!window._lastIaNotifTime || Date.now() - window._lastIaNotifTime > 5000) {
        new Notification(`${nivel === 'critico' ? 'CRÍTICO' : 'ALERTA'} - Mesa ${mesa}`, { body: mensagem, icon: '/favicon.ico' });
        window._lastIaNotifTime = Date.now();
      }
    }

    // Painel de alertas persistente no PDV
    const painel = document.getElementById('ia-alertas-panel') || criarPainelAlertasIA();
    const body = document.getElementById('ia-alertas-body') || painel;
    const existing = body.querySelector(`[data-pedido-id="${pedidoId}"]`);
    if (existing) existing.remove();

    const alerta = document.createElement('div');
    alerta.className = 'ia-card';
    alerta.setAttribute('data-pedido-id', pedidoId);
    alerta.style.borderLeft = `4px solid ${bgColor}`;
    alerta.innerHTML = `
      <div class="ia-card-title"><span style="color:${bgColor};display:flex;align-items:center;">${icon}</span> Mesa ${escHtml(mesa)} - <span style="color:${bgColor}">${nivel.toUpperCase()}</span></div>
      <div class="ia-card-desc">${escHtml(mensagem)}</div>
      <div class="ia-card-actions">
        ${(sugestoes || []).map(s => `<button class="ia-card-btn" onclick="window.socket.emit('ia_resposta_sugestao',{tipo:'${nivel === 'critico' ? 'espera_critica' : 'espera_alerta'}',mesa:${escJs(mesa)},pedidoId:${pedidoId},resposta:${escJs(s.toLowerCase().replace(/\s+/g, '_'))}});removerAlertaIA(this);" style="background:#1e293b;color:#f8fafc;border-color:${bgColor};"><i class="ph ph-check"></i> ${escHtml(s)}</button>`).join('')}
      </div>
      <button class="ia-card-close" onclick="removerAlertaIA(this)" title="Dispensar alerta"><i class="ph ph-x"></i></button>`;
    
    body.appendChild(alerta);
    if (typeof window.atualizarEstadoPainelIA === 'function') window.atualizarEstadoPainelIA();

    // Auto-remover após 5 minutos
    setTimeout(() => { if (alerta.parentElement) removerAlertaIA(alerta); }, 300000);
  });

  socket.on('ia_pedido_especial', (data) => {
    const { pedidoId, tipo, cor, urgencia, mensagem } = data;
    document.querySelectorAll(`[data-item-id="${pedidoId}"], [data-pedido-id="${pedidoId}"]`).forEach(el => {
      el.style.borderLeft = `4px solid ${cor}`;
      el.style.boxShadow = `0 0 12px ${cor}33`;
      const badge = document.createElement('span');
      badge.style.cssText = `background:${cor};color:white;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;margin-left:8px;display:inline-block;margin-top:4px;`;
      badge.textContent = mensagem;
      const descTd = el.querySelector('td:nth-child(2)');
      if (descTd) {
        descTd.appendChild(badge);
      } else {
        el.appendChild(badge);
      }
    });
  });

  // --- MANOBRA: Alerta de risco de desistência ---
  socket.on('ia_manobra_sugerida', (data) => {
    const { pedidoId, mesa, produto, minutos, itensProntos, itensPendentes, temParcial, mensagem, setor } = data;
    const bgColor = '#ff6b35';

    showToastIA(`Manobra: ${mensagem}`, bgColor);

    if ('Notification' in window && Notification.permission === 'granted') {
      if (!window._lastIaNotifTime || Date.now() - window._lastIaNotifTime > 5000) {
        new Notification(`Manobra - Mesa ${mesa}`, { body: mensagem, icon: '/favicon.ico' });
        window._lastIaNotifTime = Date.now();
      }
    }

    const painel = document.getElementById('ia-alertas-panel') || criarPainelAlertasIA();
    const body = document.getElementById('ia-alertas-body') || painel;
    const existing = body.querySelector(`[data-pedido-id="${pedidoId}"]`);
    if (existing) existing.remove();

    const alerta = document.createElement('div');
    alerta.className = 'ia-card';
    alerta.setAttribute('data-pedido-id', pedidoId);
    alerta.style.borderLeft = `4px solid ${bgColor}`;
    alerta.innerHTML = `
      <div class="ia-card-title"><i class="ph ph-fire" style="color:${bgColor}"></i> MANOBRA - Mesa ${escHtml(mesa)}</div>
      <div class="ia-card-desc">${escHtml(mensagem)}</div>
      ${temParcial ? `<div class="ia-card-info">Itens prontos: ${escHtml(itensProntos)} | Pendentes: ${escHtml(itensPendentes)}</div>` : ''}
      <div class="ia-card-info" style="color:${bgColor};font-weight:700;">Setor: ${escHtml(setor || 'Cozinha')}</div>
      <div class="ia-card-actions">
        <button class="ia-card-btn" onclick="window.socket.emit('ia_manobra_confirmar',{pedidoId:${pedidoId},mesa:${escJs(mesa)},produto:${escJs(produto)},minutos:${minutos},acao:'solicitar_entrada'});this.closest('.ia-card').innerHTML='<div style=\'padding:8px;color:#34d399;font-weight:600;font-size:calc(12px * var(--ia-scale, 1));display:flex;align-items:center;gap:4px;\'><i class=\'ph ph-check-circle\'></i> Entrada solicitada ao garçom!</div>';setTimeout(()=>removerAlertaIA(this),2000);" style="background:#ea580c;color:white;"><i class="ph ph-bowl-food"></i> Solicitar entrada ao garçom</button>
        <button class="ia-card-btn" onclick="window.socket.emit('ia_manobra_confirmar',{pedidoId:${pedidoId},mesa:${escJs(mesa)},produto:${escJs(produto)},minutos:${minutos},acao:'informar_cliente'});this.closest('.ia-card').innerHTML='<div style=\'padding:8px;color:#60a5fa;font-weight:600;font-size:calc(12px * var(--ia-scale, 1));display:flex;align-items:center;gap:4px;\'><i class=\'ph ph-info\'></i> Cliente informado sobre o atraso.</div>';setTimeout(()=>removerAlertaIA(this),2000);" style="background:#1e293b;color:#60a5fa;border-color:#3b82f6;"><i class="ph ph-info"></i> Informar cliente</button>
      </div>
      <button class="ia-card-close" onclick="removerAlertaIA(this)" title="Dispensar manobra"><i class="ph ph-x"></i></button>`;
    
    body.appendChild(alerta);
    if (typeof window.atualizarEstadoPainelIA === 'function') window.atualizarEstadoPainelIA();

    setTimeout(() => { if (alerta.parentElement) removerAlertaIA(alerta); }, 300000);
  });

  // --- IA: Remover alerta quando pedido eh resolvido ---
  socket.on('ia_pedido_resolvido', (data) => {
    const { pedidoId, status } = data;
    const body = document.getElementById('ia-alertas-body') || document.getElementById('ia-alertas-panel');
    if (body) {
      const existing = body.querySelector('[data-pedido-id="' + pedidoId + '"]');
      if (existing) {
        existing.remove();
        if (typeof window.atualizarEstadoPainelIA === 'function') window.atualizarEstadoPainelIA();
      }
    }
  });

  socket.on('ia_dica_gerente', (data) => {
    const { dicas, resumo } = data;
    if (dicas && dicas.length > 0) {
      const painel = document.getElementById('ia-gerente-panel');
      if (painel) {
        painel.innerHTML = dicas.map(d => {
          const icone = d.tipo === 'alerta' ? '<i class="ph ph-warning"></i>' : d.tipo === 'acao' ? '<i class="ph ph-target"></i>' : d.tipo === 'dica' ? '<i class="ph ph-lightbulb"></i>' : '<i class="ph ph-info"></i>';
          return `<div style="padding:8px 12px;font-size:12px;color:#cbd5e1;">${icone} ${escHtml(d.texto)}</div>`;
        }).join('');
      }
    }
  });
}

function criarPainelAlertasIA() {
  let panel = document.getElementById('ia-alertas-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'ia-alertas-panel';

  // Escala inicial de fontes e botões
  let iaScale = parseFloat(localStorage.getItem('ia_alertas_scale')) || 1.0;
  panel.style.setProperty('--ia-scale', iaScale);

  panel.innerHTML = `
    <div class="ia-alertas-header" id="ia-alertas-header">
      <div class="ia-header-left">
        <i class="ph ph-robot ia-robot-icon"></i>
        <span>Alertas Inteligentes</span>
        <span id="ia-alertas-header-badge" class="ia-count-badge">0</span>
      </div>
      <div class="ia-header-actions">
        <button id="ia-btn-font-down" class="ia-tool-btn" title="Diminuir letras e botões (a-)">
          <i class="ph ph-text-aa"></i><span style="font-size:9px;margin-left:-2px;font-weight:900;">-</span>
        </button>
        <button id="ia-btn-font-up" class="ia-tool-btn" title="Aumentar letras e botões (A+)">
          <i class="ph ph-text-aa"></i><span style="font-size:9px;margin-left:-2px;font-weight:900;">+</span>
        </button>
        <button id="ia-btn-minimize" class="ia-tool-btn" title="Minimizar para botão flutuante">
          <i class="ph ph-caret-down"></i>
        </button>
        <button id="ia-btn-close" class="ia-tool-btn" title="Fechar">
          <i class="ph ph-x"></i>
        </button>
      </div>
    </div>
    <div id="ia-alertas-body" class="ia-alertas-body">
      <div id="ia-alertas-empty" class="ia-alertas-empty">
        <div class="ia-empty-icon-wrap">
          <i class="ph ph-check-circle"></i>
        </div>
        <div class="ia-empty-title">Tudo sob controle!</div>
        <div class="ia-empty-desc">Nenhum alerta ou atraso pendente no momento.</div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Restaurar dimensões salvas
  try {
    const w = localStorage.getItem('ia_alerta_w'), h = localStorage.getItem('ia_alerta_h');
    if (w) { panel.style.width = w + 'px'; panel.style.maxWidth = 'none'; }
    if (h) { panel.style.height = h + 'px'; panel.style.maxHeight = 'none'; }
  } catch (e) { }

  /* ── Botões de Zoom de Letras e Botões ── */
  function aplicarEscala(nova) {
    iaScale = Math.min(1.8, Math.max(0.75, Math.round(nova * 100) / 100));
    panel.style.setProperty('--ia-scale', iaScale);
    try { localStorage.setItem('ia_alertas_scale', iaScale); } catch (e) {}
  }

  const btnDown = panel.querySelector('#ia-btn-font-down');
  const btnUp = panel.querySelector('#ia-btn-font-up');
  if (btnDown) btnDown.onclick = (e) => { e.stopPropagation(); aplicarEscala(iaScale - 0.1); };
  if (btnUp) btnUp.onclick = (e) => { e.stopPropagation(); aplicarEscala(iaScale + 0.1); };

  /* ── Alça de redimensionamento ── */
  const handle = document.createElement('div');
  handle.title = 'Arraste para ajustar o tamanho';
  handle.style.cssText = 'position:absolute;left:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;z-index:2;';
  handle.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M14 14L6 6M14 9l-5 5M9 14l5-5" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/></svg>';
  panel.appendChild(handle);

  let resizing = false;
  const iniciarResize = (cx, cy) => {
    resizing = true;
    const r = panel.getBoundingClientRect();
    panel._rw = r.width; panel._rh = r.height;
    handle._sx = cx; handle._sy = cy;
    document.body.style.userSelect = 'none';
  };
  const moverResize = (cx, cy) => {
    if (!resizing) return;
    const nw = Math.min(Math.max(260, panel._rw + (handle._sx - cx)), window.innerWidth * 0.95);
    const nh = Math.min(Math.max(160, panel._rh + (handle._sy - cy)), window.innerHeight * 0.85);
    panel.style.width = nw + 'px'; panel.style.maxWidth = 'none';
    panel.style.height = nh + 'px'; panel.style.maxHeight = 'none';
  };
  const pararResize = () => {
    if (!resizing) return;
    resizing = false;
    document.body.style.userSelect = '';
    const r = panel.getBoundingClientRect();
    try { localStorage.setItem('ia_alerta_w', Math.round(r.width)); localStorage.setItem('ia_alerta_h', Math.round(r.height)); } catch (e) { }
  };
  handle.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); iniciarResize(e.clientX, e.clientY); });
  handle.addEventListener('touchstart', (e) => { const t = e.touches[0]; iniciarResize(t.clientX, t.clientY); }, { passive: true });
  document.addEventListener('mousemove', (e) => moverResize(e.clientX, e.clientY));
  document.addEventListener('touchmove', (e) => { if (!resizing) return; const t = e.touches[0]; moverResize(t.clientX, t.clientY); }, { passive: true });
  document.addEventListener('mouseup', pararResize);
  document.addEventListener('touchend', pararResize);

  /* ── Ícone Flutuante / Botão de Acesso Rápido ── */
  let icone = document.getElementById('ia-alertas-icon');
  if (!icone) {
    icone = document.createElement('button');
    icone.id = 'ia-alertas-icon';
    icone.title = 'Alertas Inteligentes';
    icone.style.cssText = 'display:none;position:fixed;bottom:80px;right:16px;width:46px;height:46px;border-radius:50%;border:none;background:#1e293b;color:#fbbf24;font-size:22px;cursor:pointer;z-index:9000;box-shadow:0 4px 16px rgba(0,0,0,0.35);align-items:center;justify-content:center;';
    icone.innerHTML = '<i class="ph ph-robot"></i><span id="ia-alertas-badge" style="display:none;position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:800;line-height:18px;text-align:center;">0</span>';
    document.body.appendChild(icone);
  }

  function abrirPainel() {
    icone.style.display = 'none';
    panel.style.display = 'flex';
    try { localStorage.setItem('ia_alerta_minimized', 'false'); } catch (e) {}
    atualizarEstado();
  }

  function minimizarPainel() {
    panel.style.display = 'none';
    icone.style.display = 'flex';
    try { localStorage.setItem('ia_alerta_minimized', 'true'); } catch (e) {}
    atualizarEstado();
  }

  icone.onclick = abrirPainel;

  const btnMin = panel.querySelector('#ia-btn-minimize');
  if (btnMin) btnMin.onclick = (e) => { e.stopPropagation(); minimizarPainel(); };

  const btnClose = panel.querySelector('#ia-btn-close');
  if (btnClose) btnClose.onclick = (e) => { e.stopPropagation(); minimizarPainel(); };

  /* ── Atualização do Estado, Badges e Empty State ── */
  function atualizarEstado() {
    const body = panel.querySelector('#ia-alertas-body');
    const emptyState = panel.querySelector('#ia-alertas-empty');
    const cards = body ? body.querySelectorAll('[data-pedido-id]') : [];
    const count = cards.length;

    const headerBadge = panel.querySelector('#ia-alertas-header-badge');
    if (headerBadge) {
      headerBadge.textContent = count;
      if (count > 0) {
        headerBadge.classList.add('has-alerts');
      } else {
        headerBadge.classList.remove('has-alerts');
      }
    }

    const iconBadge = document.getElementById('ia-alertas-badge');
    if (iconBadge) {
      iconBadge.textContent = count;
      iconBadge.style.display = count > 0 ? 'block' : 'none';
    }

    if (emptyState) {
      emptyState.style.display = count === 0 ? 'flex' : 'none';
    }

    // Se chegar um novo alerta enquanto minimizado, restaura o painel automaticamente
    if (count > 0 && panel.style.display === 'none') {
      abrirPainel();
    }
  }

  window.atualizarEstadoPainelIA = atualizarEstado;
  atualizarEstado();

  // Se o colaborador havia minimizado previamente e não tem alertas ativos, respeita
  try {
    const wasMin = localStorage.getItem('ia_alerta_minimized') === 'true';
    if (wasMin) {
      minimizarPainel();
    }
  } catch (e) {}

  return panel;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try { criarPainelAlertasIA(); } catch (e) {}
  });
} else {
  try { criarPainelAlertasIA(); } catch (e) {}
}

// --- IA Toast Queue (prevents stacking) ---
window._iaToastQueue = [];
window._iaToastActive = false;

function showToastIA(msg, bg) {
  window._iaToastQueue.push({ msg: msg, bg: bg });
  processIaToastQueue();
}

function processIaToastQueue() {
  if (window._iaToastActive || window._iaToastQueue.length === 0) return;
  window._iaToastActive = true;
  var item = window._iaToastQueue.shift();
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:60px;right:16px;background:' + (item.bg || '#1e293b') + ';color:white;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;max-width:350px;box-shadow:0 4px 16px rgba(0,0,0,0.2);animation:slideToast 0.2s ease-out;transition:opacity 0.3s;';
  el.innerHTML = item.msg;
  document.body.appendChild(el);
  setTimeout(function () { el.style.opacity = '0'; }, 4000);
  setTimeout(function () {
    el.remove();
    window._iaToastActive = false;
    processIaToastQueue();
  }, 4500);
}

// --- RESIZABLE COLUMNS FOR PRODUCTS TABLE ---
document.addEventListener('DOMContentLoaded', () => {
  const tables = document.querySelectorAll('.products-table');
  tables.forEach(table => {
    const cols = table.querySelectorAll('th');
    [].forEach.call(cols, function (col) {
      const resizer = document.createElement('div');
      resizer.classList.add('resizer');
      col.appendChild(resizer);

      let x = 0;
      let w = 0;

      const mouseDownHandler = function (e) {
        x = e.clientX;
        w = col.getBoundingClientRect().width;

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        resizer.classList.add('resizing');
      };

      const mouseMoveHandler = function (e) {
        const dx = e.clientX - x;
        col.style.width = (w + dx) + 'px';
      };

      const mouseUpHandler = function () {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        resizer.classList.remove('resizing');
      };

      resizer.addEventListener('mousedown', mouseDownHandler);
    });
  });
});

// === REDIMENSIONAMENTO COMPLETO DE BARRAS LATERAIS E REORDENAÇÃO DE BOTÕES E DOCK ===
document.addEventListener('DOMContentLoaded', () => {
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const innerLeftPanel = document.getElementById('inner-left-panel');
  const dockMiniList = document.getElementById('dock-mini-icons-list');
  const resizerLeft = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');

  // 1. Restaurar larguras expandidas personalizadas salvas pelo colaborador
  const savedLeftW = parseInt(localStorage.getItem('chef_left_expanded_width'), 10) || 290;
  document.documentElement.style.setProperty('--left-expanded-width', savedLeftW + 'px');
  if (leftPanel) leftPanel.style.setProperty('--left-expanded-width', savedLeftW + 'px');

  const savedRightW = parseInt(localStorage.getItem('chef_right_expanded_width'), 10) || 320;
  document.documentElement.style.setProperty('--right-expanded-width', savedRightW + 'px');
  if (rightPanel) rightPanel.style.setProperty('--right-expanded-width', savedRightW + 'px');

  // Helper universal de redimensionamento da largura expandida (Mouse e Touch)
  const setupSidebarResizer = (resizer, panel, isLeft) => {
    if (!resizer || !panel) return;

    const startResize = (clientX) => {
      const startX = clientX;
      const currentWidthStr = getComputedStyle(document.documentElement)
        .getPropertyValue(isLeft ? '--left-expanded-width' : '--right-expanded-width')
        .trim();
      const startW = parseInt(currentWidthStr, 10) || (isLeft ? 290 : 320);

      resizer.classList.add('dragging');
      panel.classList.add('expanded'); // mantem expandido enquanto ajusta o tamanho
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (moveEv) => {
        const currentX = moveEv.touches ? moveEv.touches[0].clientX : moveEv.clientX;
        const delta = currentX - startX;
        const newW = isLeft
          ? Math.max(220, Math.min(700, startW + delta))
          : Math.max(240, Math.min(700, startW - delta));

        const varName = isLeft ? '--left-expanded-width' : '--right-expanded-width';
        document.documentElement.style.setProperty(varName, newW + 'px');
        panel.style.setProperty(varName, newW + 'px');
        localStorage.setItem(isLeft ? 'chef_left_expanded_width' : 'chef_right_expanded_width', newW);
      };

      const onEnd = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        resizer.classList.remove('dragging');
        panel.classList.remove('expanded');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (typeof window.showToast === 'function') {
          const finalW = localStorage.getItem(isLeft ? 'chef_left_expanded_width' : 'chef_right_expanded_width');
          window.showToast(`📐 Largura expandida ajustada para ${finalW}px`, 'info');
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    };

    resizer.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startResize(e.clientX);
    });

    resizer.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        startResize(e.touches[0].clientX);
      }
    }, { passive: true });
  };

  setupSidebarResizer(resizerLeft, leftPanel, true);
  setupSidebarResizer(resizerRight, rightPanel, false);

  // 2. Reordenação dos Botões Mini na Barra Recolhida (Dock Mini)
  if (dockMiniList) {
    // Restaurar ordem salva do dock mini
    try {
      const savedMiniOrder = JSON.parse(localStorage.getItem('chef_dock_mini_order'));
      if (Array.isArray(savedMiniOrder) && savedMiniOrder.length > 0) {
        savedMiniOrder.forEach(miniId => {
          const btn = dockMiniList.querySelector(`[data-mini-id="${miniId}"]`);
          if (btn) dockMiniList.appendChild(btn);
        });
      }
    } catch(e) {}

    // Inicializar Sortable no Dock Mini
    if (typeof Sortable !== 'undefined') {
      Sortable.create(dockMiniList, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        forceFallback: true,
        fallbackTolerance: 3,
        onEnd: () => {
          const miniOrder = Array.from(dockMiniList.querySelectorAll('.dock-mini-btn'))
            .map(b => b.getAttribute('data-mini-id'))
            .filter(Boolean);
          localStorage.setItem('chef_dock_mini_order', JSON.stringify(miniOrder));
        }
      });
    }
  }

  // 3. Reordenação dos Grupos e Botões do Painel Interno (#inner-left-panel)
  const targetInnerPanel = innerLeftPanel || leftPanel;
  if (targetInnerPanel) {
    // Adicionar botão de Reset de Ordem se não existir
    if (!document.getElementById('btn-reset-order-actions')) {
      const resetWrapper = document.createElement('div');
      resetWrapper.id = 'wrapper-reset-order-actions';
      resetWrapper.style.cssText = 'padding: 14px 0 8px; text-align: center; margin-top: auto; flex-shrink: 0;';
      resetWrapper.innerHTML = `
        <button id="btn-reset-order-actions" onclick="window.resetarOrdemAcoes()" title="Restaurar a ordem padrão dos botões" style="background: var(--bg-secondary); border: 1.5px dashed var(--border-color); color: var(--text-secondary); font-size: 11.5px; padding: 8px 14px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-weight: 700; transition: all 0.2s;">
          <i class="ph-bold ph-arrow-counter-clockwise"></i> Restaurar Ordem dos Botões
        </button>`;
      targetInnerPanel.appendChild(resetWrapper);
    }

    // Identificar e preparar cabeçalhos para arraste
    targetInnerPanel.querySelectorAll('.action-group').forEach((grp, idx) => {
      if (!grp.getAttribute('data-group-id')) {
        grp.setAttribute('data-group-id', 'grp-' + idx);
      }
      const title = grp.querySelector('.group-title');
      if (title && !title.querySelector('.ph-dots-six-vertical')) {
        title.style.cursor = 'grab';
        title.style.display = 'flex';
        title.style.justifyContent = 'space-between';
        title.style.alignItems = 'center';
        title.innerHTML += '<i class="ph ph-dots-six-vertical" style="color:#fc4b15; font-size:16px;" title="Arrastar grupo"></i>';
      }
    });

    // Aplicar ordem de grupos salva anteriormente
    try {
      const savedGroupOrder = JSON.parse(localStorage.getItem('chef_left_actions_group_order'));
      if (Array.isArray(savedGroupOrder) && savedGroupOrder.length > 0) {
        const resetWrapper = document.getElementById('wrapper-reset-order-actions');
        savedGroupOrder.forEach(grpId => {
          const el = targetInnerPanel.querySelector(`[data-group-id="${grpId}"]`);
          if (el && resetWrapper) targetInnerPanel.insertBefore(el, resetWrapper);
          else if (el) targetInnerPanel.appendChild(el);
        });
      }
    } catch(err){}

    // Sortable nos Grupos e Botões
    if (typeof Sortable !== 'undefined') {
      Sortable.create(targetInnerPanel, {
        animation: 250,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        draggable: '.action-group',
        handle: '.group-title',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        swapThreshold: 0.65,
        direction: 'vertical',
        forceFallback: true,
        fallbackTolerance: 3,
        scroll: true,
        scrollSensitivity: 100,
        scrollSpeed: 20,
        onEnd: () => {
          const order = Array.from(targetInnerPanel.querySelectorAll('.action-group'))
            .map(el => el.getAttribute('data-group-id'))
            .filter(Boolean);
          localStorage.setItem('chef_left_actions_group_order', JSON.stringify(order));
        }
      });

      // Reordenação Independente de Qualquer Botão entre/dentro dos Grupos
      targetInnerPanel.querySelectorAll('.btn-grid-2, .action-group').forEach((container, containerIdx) => {
        container.querySelectorAll('.btn-action').forEach((btn, btnIdx) => {
          if (!btn.getAttribute('data-btn-id')) {
            btn.setAttribute('data-btn-id', btn.id || ('btn-' + containerIdx + '-' + btnIdx));
          }
          btn.setAttribute('draggable', 'true');
        });

        // Restaurar ordem salva dos botões
        const groupKey = 'chef_btn_order_' + (container.id || containerIdx);
        try {
          const savedBtns = JSON.parse(localStorage.getItem(groupKey));
          if (Array.isArray(savedBtns)) {
            savedBtns.forEach(btnId => {
              const b = container.querySelector(`[data-btn-id="${btnId}"]`);
              if (b) container.appendChild(b);
            });
          }
        } catch(e){}

        Sortable.create(container, {
          group: 'btn-actions-nested',
          animation: 200,
          draggable: '.btn-action',
          ghostClass: 'sortable-ghost',
          dragClass: 'sortable-drag',
          forceFallback: true,
          fallbackTolerance: 3,
          scroll: true,
          scrollSensitivity: 80,
          scrollSpeed: 15,
          onEnd: () => {
            const btns = Array.from(container.querySelectorAll('.btn-action'))
              .map(b => b.getAttribute('data-btn-id'))
              .filter(Boolean);
            localStorage.setItem(groupKey, JSON.stringify(btns));
          }
        });
      });
    }
  }
});

window.resetarOrdemAcoes = function() {
  localStorage.removeItem('chef_left_actions_group_order');
  localStorage.removeItem('chef_dock_mini_order');
  localStorage.removeItem('chef_left_expanded_width');
  localStorage.removeItem('chef_right_expanded_width');
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('chef_btn_order_')) localStorage.removeItem(k);
  });
  location.reload();
};

// ═════════════════════════════════════════════════════════════════════
// CONTROLADOR DE PAINÉIS AUTO-RECOLHÍVEIS (MOUSE HOVER & TOUCH)
// ═════════════════════════════════════════════════════════════════════
window.toggleLeftPanel = function(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('left-panel');
  if (!panel) return;
  panel.classList.toggle('expanded');
};

window.toggleRightPanel = function(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('right-panel');
  if (!panel) return;
  panel.classList.toggle('expanded');
};

window.togglePinLeftPanel = function(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('left-panel');
  const btn = document.getElementById('btn-pin-left-panel');
  const icon = document.getElementById('icon-pin-left-panel');
  if (!panel) return;

  const isPinned = panel.classList.toggle('pinned');
  if (btn) btn.classList.toggle('pinned', isPinned);
  if (icon) icon.className = isPinned ? 'ph-bold ph-push-pin-slash' : 'ph ph-push-pin';
  localStorage.setItem('chef_left_panel_pinned', isPinned ? '1' : '0');

  if (typeof window.showToast === 'function') {
    window.showToast(isPinned ? '📌 Painel Ações fixado aberto' : '🔄 Painel Ações em modo auto-recolhível', 'info');
  }
};

window.togglePinRightPanel = function(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('right-panel');
  const btn = document.getElementById('btn-pin-right-panel');
  const icon = document.getElementById('icon-pin-right-panel');
  if (!panel) return;

  const isPinned = panel.classList.toggle('pinned');
  if (btn) btn.classList.toggle('pinned', isPinned);
  if (icon) icon.className = isPinned ? 'ph-bold ph-push-pin-slash' : 'ph ph-push-pin';
  localStorage.setItem('chef_right_panel_pinned', isPinned ? '1' : '0');

  if (typeof window.showToast === 'function') {
    window.showToast(isPinned ? '📌 Painel Resumo fixado aberto' : '🔄 Painel Resumo em modo auto-recolhível', 'info');
  }
};

// Inicialização e restauração do estado de fixação
document.addEventListener('DOMContentLoaded', () => {
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const btnPinLeft = document.getElementById('btn-pin-left-panel');
  const iconPinLeft = document.getElementById('icon-pin-left-panel');
  const btnPinRight = document.getElementById('btn-pin-right-panel');
  const iconPinRight = document.getElementById('icon-pin-right-panel');

  if (leftPanel && localStorage.getItem('chef_left_panel_pinned') === '1') {
    leftPanel.classList.add('pinned');
    if (btnPinLeft) btnPinLeft.classList.add('pinned');
    if (iconPinLeft) iconPinLeft.className = 'ph-bold ph-push-pin-slash';
  }

  if (rightPanel && localStorage.getItem('chef_right_panel_pinned') === '1') {
    rightPanel.classList.add('pinned');
    if (btnPinRight) btnPinRight.classList.add('pinned');
    if (iconPinRight) iconPinRight.className = 'ph-bold ph-push-pin-slash';
  }

  // Fechar painéis ao tocar/clicar fora no workspace em telas touch
  document.addEventListener('click', (ev) => {
    if (leftPanel && !leftPanel.contains(ev.target) && leftPanel.classList.contains('expanded')) {
      leftPanel.classList.remove('expanded');
    }
    if (rightPanel && !rightPanel.contains(ev.target) && rightPanel.classList.contains('expanded')) {
      rightPanel.classList.remove('expanded');
    }
  });
});





