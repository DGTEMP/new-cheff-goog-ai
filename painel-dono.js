// painel-dono.js - Owner Mobile Dashboard Logic

// (Segurança) Escapa valor para conteúdo HTML.
function escHtml(v) {
  return (v === null || v === undefined) ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 1. Auth check
const token = localStorage.getItem('chef_token');
const loggedUser = localStorage.getItem('logged_user');
const userCargo = localStorage.getItem('cargoLogado');

if (!token) {
  alert('Faça login primeiro para acessar esta página.');
  window.location.href = '/login.html';
}

// Global meta target
let metaVendas = parseFloat(localStorage.getItem('meta_dono_vendas')) || 5000;

// Initialize socket
const socket = (typeof io === 'function') ? io({
  query: {
    token: token,
    restaurante_id: localStorage.getItem('restaurante_id') || '1'
  }
}) : { on: () => {}, emit: () => {}, disconnect: () => {}, connect: () => {} };

socket.on('tenant_atualizado', (data) => {
  if (data && data.restaurante_id) {
    localStorage.setItem('restaurante_id', data.restaurante_id);
  }
  if (data && data.token) {
    localStorage.setItem('chef_token', data.token);
  }
  socket.disconnect();
  socket.io.opts.query = { token: data.token, restaurante_id: String(data.restaurante_id) };
  socket.connect();
});

// Cache DOM elements
const loader = document.getElementById('loader');
const faturamentoEl = document.getElementById('kpi-faturamento');
const mesasEl = document.getElementById('kpi-mesas');
const ticketEl = document.getElementById('kpi-ticket');
const equipeEl = document.getElementById('kpi-equipe');
const goalPercentEl = document.getElementById('goal-percent');
const goalLabelEl = document.getElementById('goal-target-label');
const progressFillEl = document.getElementById('kpi-progress-fill');
const headerTimeEl = document.getElementById('header-time');
const caixaBadgeEl = document.getElementById('caixa-badge');

const cashierControlTitle = document.getElementById('cashier-control-title');
const cashierControlSubtitle = document.getElementById('cashier-control-subtitle');
const cashierToggleBtn = document.getElementById('cashier-toggle-btn');
const cashierBtnText = document.getElementById('cashier-btn-text');

const metaInput = document.getElementById('meta-input');
const notifInput = document.getElementById('notif-input');
const rankingList = document.getElementById('ranking-list');
const activityFeed = document.getElementById('activity-feed');

const accordionBtn = document.getElementById('accordion-btn');
const accordionPanel = document.getElementById('accordion-panel');
const accordionChevron = document.getElementById('accordion-chevron');

// Helper - Formatar moeda
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// Show/Hide Loader
function setLoader(show) {
  if (show) loader.classList.remove('hidden');
  else loader.classList.add('hidden');
}

// Toast Notification
function showToast(text, iconClass = 'ph-info') {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  const toastIcon = toast.querySelector('i');
  
  toastText.innerText = text;
  toastIcon.className = `ph-bold ${iconClass}`;
  
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// Time clock in header
function startClock() {
  const update = () => {
    const d = new Date();
    headerTimeEl.innerText = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  update();
  setInterval(update, 60000);
}

// Socket listener para atualização em tempo real
socket.on('atualizacao_caixa', () => {
  if(window.periodoAtual === 'hoje') {
    console.log('[Painel Dono] Recebido sinal de atualização em tempo real (atualizacao_caixa)!');
    carregarMetricas();
  }
});
socket.on('financeiro_atualizado', () => {
  if(window.periodoAtual === 'hoje') {
    carregarMetricas();
  }
});

// Load on start
window.onload = () => {
  startClock();
  carregarMetricas();
  // ... resto da inicialização
};

// Global period state
window.periodoAtual = 'hoje';
window.dataInicioCustom = '';
window.dataFimCustom = '';

// Fetch stats from custom Owner API
async function carregarMetricas() {
  setLoader(true);
  try {
    let url = `/api/dono/dashboard?periodo=${window.periodoAtual}`;
    if (window.periodoAtual === 'custom' && window.dataInicioCustom && window.dataFimCustom) {
      url += `&data_inicio=${window.dataInicioCustom}&data_fim=${window.dataFimCustom}`;
    }

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 403 || res.status === 401) {
      alert('Sessão expirada ou sem permissão de administrador.');
      window.location.href = '/login.html';
      return;
    }

    const result = await res.json();
    if (result.success && result.data) {
      const data = result.data;

      // Update period labels
      const rotuloEl = document.getElementById('periodo-rotulo-exibicao');
      if (rotuloEl) rotuloEl.innerText = data.rotuloPeriodo || 'Hoje';

      const titleFat = document.getElementById('kpi-title-faturamento');
      if (titleFat) titleFat.innerText = `Faturamento (${data.rotuloPeriodo || 'Hoje'})`;

      const subPed = document.getElementById('kpi-sub-total-pedidos');
      if (subPed) subPed.innerText = `${data.totalPedidos || 0} pedidos finalizados`;

      // Update KPIs
      faturamentoEl.innerText = formatCurrency(data.faturamentoHoje);
      mesasEl.innerText = data.mesasAtivas;
      ticketEl.innerText = formatCurrency(data.ticketMedio);
      equipeEl.innerText = data.colaboradoresAtivos;

      // Update goal target labels & input value
      metaInput.value = metaVendas;
      goalLabelEl.innerText = `Meta: ${formatCurrency(metaVendas)}`;

      // Calculate progress
      const percent = metaVendas > 0 ? Math.min(100, Math.round((data.faturamentoHoje / metaVendas) * 100)) : 0;
      goalPercentEl.innerText = `${percent}% atingido`;
      progressFillEl.style.width = `${percent}%`;

      // Update Cashier State cards
      const isOpen = data.caixaStatus === 'Aberto';
      caixaBadgeEl.innerText = data.caixaStatus;
      caixaBadgeEl.className = `status-badge ${isOpen ? 'open' : 'closed'}`;

      if (isOpen) {
        cashierControlTitle.innerText = 'Caixa está Aberto';
        cashierControlSubtitle.innerText = `Fundo de troco: ${formatCurrency(data.caixaSaldo)}`;
        cashierToggleBtn.style.background = '#f43f5e';
        cashierBtnText.innerText = 'Fechar';
        cashierToggleBtn.onclick = fecharCaixaFluxo;
      } else {
        cashierControlTitle.innerText = 'Caixa está Fechado';
        cashierControlSubtitle.innerText = 'Inicie o caixa para aceitar vendas.';
        cashierToggleBtn.style.background = 'var(--accent-green)';
        cashierBtnText.innerText = 'Abrir';
        cashierToggleBtn.onclick = abrirCaixaFluxo;
      }

      // Update product ranking list
      if (data.topProdutos && data.topProdutos.length > 0) {
        rankingList.innerHTML = data.topProdutos.map((p, idx) => `
          <div class="accordion-item">
            <span class="label">${idx + 1}º ${escHtml(p.productEmoji || '🍽️')} ${escHtml(p.productName)}</span>
            <span class="val">${p.quantidade}x (${formatCurrency(p.total)})</span>
          </div>
        `).join('');
      } else {
        rankingList.innerHTML = `<div style="text-align:center;color:var(--text-sub);padding:10px;">Nenhuma venda realizada (${escHtml(data.rotuloPeriodo)}).</div>`;
      }
    }
  } catch (error) {
    console.error('Erro ao carregar métricas:', error);
    showToast('Erro de conexão ao atualizar métricas', 'ph-wifi-high-slash');
  } finally {
    setLoader(false);
  }
}

// Period Filters handlers
window.selecionarPeriodoDono = function (periodo, btnEl) {
  window.periodoAtual = periodo;
  document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  const cust = document.getElementById('container-datas-custom');
  if (cust) cust.style.display = 'none';
  carregarMetricas();
};

window.togglePeriodoCustomDono = function (btnEl) {
  document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  const container = document.getElementById('container-datas-custom');
  if (container) container.style.display = container.style.display === 'none' ? 'grid' : 'none';
};

window.aplicarDatasCustomDono = function () {
  const ini = document.getElementById('dono-data-inicio').value;
  const fim = document.getElementById('dono-data-fim').value;
  if (!ini || !fim) {
    return alert('Selecione a data inicial e final.');
  }
  window.periodoAtual = 'custom';
  window.dataInicioCustom = ini;
  window.dataFimCustom = fim;
  carregarMetricas();
};

// Remote Cashier Navigation
window.comandarNavegacaoCaixaFinanceiro = function () {
  if (!confirm('Deseja enviar o computador do caixa para a tela Financeiro agora?')) return;
  socket.emit('comando_navegar_caixa', {
    destino: 'financeiro.html',
    solicitadoPor: loggedUser || 'Dono'
  });
  showToast('Comando de navegação enviado ao caixa!', 'ph-paper-plane');
  adicionarAoFeed('aviso', 'Você solicitou a abertura da tela Financeiro no caixa.');
};

// RH Management Modal handlers
window.carregarFuncionariosRhDono = async function () {
  const select = document.getElementById('select-rh-funcionario');
  if (!select) return;
  try {
    const res = await fetch('/api/funcionarios', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const funcs = await res.json();
    if (Array.isArray(funcs) && funcs.length > 0) {
      select.innerHTML = funcs.map(f => `<option value="${f.id}">${escHtml(f.nome)} (${escHtml(f.cargo || 'Colaborador')})</option>`).join('');
    } else {
      select.innerHTML = `<option value="">Nenhum funcionário encontrado</option>`;
    }
  } catch (e) {
    select.innerHTML = `<option value="">Erro ao carregar funcionários</option>`;
  }
};

window.abrirModalRhDono = function () {
  window.carregarFuncionariosRhDono();
  document.getElementById('modal-rh-dono').classList.remove('hidden');
};

window.alternarAbaRhDono = function (aba) {
  document.getElementById('tab-rh-btn-pagamento').className = `btn-periodo ${aba === 'pagamento' ? 'active' : ''}`;
  document.getElementById('tab-rh-btn-falta').className = `btn-periodo ${aba === 'falta' ? 'active' : ''}`;
  document.getElementById('tab-rh-btn-folga').className = `btn-periodo ${aba === 'folga' ? 'active' : ''}`;

  document.getElementById('aba-rh-pagamento').style.display = aba === 'pagamento' ? 'block' : 'none';
  document.getElementById('aba-rh-falta').style.display = aba === 'falta' ? 'block' : 'none';
  document.getElementById('aba-rh-folga').style.display = aba === 'folga' ? 'block' : 'none';
};

window.salvarPagamentoDono = function () {
  const funcId = document.getElementById('select-rh-funcionario').value;
  const val = parseFloat(document.getElementById('rh-pagamento-valor').value);
  const forma = document.getElementById('rh-pagamento-forma').value;
  const obs = document.getElementById('rh-pagamento-obs').value;

  if (!funcId || isNaN(val) || val <= 0) {
    return alert('Selecione o colaborador e informe um valor de pagamento válido.');
  }

  socket.emit('dono_registrar_pagamento', {
    funcionario_id: funcId,
    valor: val,
    forma_pagamento: forma,
    observacao: obs,
    operador: loggedUser || 'Dono'
  });

  document.getElementById('modal-rh-dono').classList.add('hidden');
  document.getElementById('rh-pagamento-valor').value = '';
};

window.salvarAbonoFaltaDono = function () {
  const funcId = document.getElementById('select-rh-funcionario').value;
  const dataFalta = document.getElementById('rh-falta-data').value;
  const justif = document.getElementById('rh-falta-justificativa').value;
  const remun = document.getElementById('rh-falta-remunerada').checked;

  if (!funcId || !dataFalta || !justif) {
    return alert('Preencha a data da falta e a justificativa.');
  }

  socket.emit('dono_abonar_falta', {
    funcionario_id: funcId,
    data_falta: dataFalta,
    justificativa: justif,
    remunerado: remun,
    operador: loggedUser || 'Dono'
  });

  document.getElementById('modal-rh-dono').classList.add('hidden');
  document.getElementById('rh-falta-data').value = '';
  document.getElementById('rh-falta-justificativa').value = '';
};

window.salvarFolgaDono = function () {
  const funcId = document.getElementById('select-rh-funcionario').value;
  const ini = document.getElementById('rh-folga-inicio').value;
  const fim = document.getElementById('rh-folga-fim').value;
  const tipo = document.getElementById('rh-folga-tipo').value;
  const obs = document.getElementById('rh-folga-obs').value;

  if (!funcId || !ini) {
    return alert('Selecione o colaborador e a data inicial da folga.');
  }

  socket.emit('dono_conceder_folga', {
    funcionario_id: funcId,
    data_inicio: ini,
    data_fim: fim || ini,
    tipo_folga: tipo,
    observacao: obs,
    operador: loggedUser || 'Dono'
  });

  document.getElementById('modal-rh-dono').classList.add('hidden');
  document.getElementById('rh-folga-inicio').value = '';
};

// Save Daily Goal
window.salvarMeta = function() {
  const val = parseFloat(metaInput.value);
  if (isNaN(val) || val <= 0) {
    showToast('Insira um valor de meta válido.', 'ph-warning');
    return;
  }
  metaVendas = val;
  localStorage.setItem('meta_dono_vendas', val);
  carregarMetricas();
  showToast('Meta diária salva com sucesso!', 'ph-check-circle');
};

// Send notification message to all staff
window.notificarEquipe = function() {
  const text = notifInput.value.trim();
  if (!text) {
    showToast('Insira um aviso para enviar.', 'ph-warning');
    return;
  }
  
  socket.emit('enviar_notificacao_equipe', { texto: text });
  notifInput.value = '';
  showToast('Aviso enviado para a equipe!', 'ph-paper-plane');
  
  // Add to local feed
  adicionarAoFeed('aviso', `Você enviou um aviso: "${text}"`);
};

// Add card item to Live Feed
function adicionarAoFeed(tipo, texto) {
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  let icon = 'ph-info';
  let colorClass = 'blue';
  
  if (tipo === 'venda') {
    icon = 'ph-currency-dollar';
    colorClass = 'green';
  } else if (tipo === 'aviso') {
    icon = 'ph-megaphone';
    colorClass = 'purple';
  } else if (tipo === 'ponto') {
    icon = 'ph-user-check';
    colorClass = 'blue';
  }
  
  // Remove default empty state text
  if (activityFeed.innerText.includes('Aguardando atividades')) {
    activityFeed.innerHTML = '';
  }
  
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `
    <div class="feed-icon ${colorClass}">
      <i class="ph-fill ${icon}"></i>
    </div>
    <div class="feed-body">
      <div class="feed-text">${texto}</div>
      <div class="feed-time">${now}</div>
    </div>
  `;
  
  activityFeed.prepend(item);
  
  // Keep only latest 15 elements
  while (activityFeed.children.length > 15) {
    activityFeed.lastChild.remove();
  }
}

// Cashier controls flow - Close Caixa
function fecharCaixaFluxo() {
  const valor = prompt('Digite o saldo final em dinheiro para fechar o caixa (ex: 350.50):');
  if (valor === null) return;
  
  const saldo = parseFloat(valor);
  if (isNaN(saldo) || saldo < 0) {
    alert('Valor de fechamento inválido.');
    return;
  }
  
  if (!confirm('Deseja realmente encerrar o caixa com saldo final de R$ ' + saldo.toFixed(2).replace('.', ',') + '?')) return;
  
  setLoader(true);
  socket.emit('fechar_caixa', {
    operador: loggedUser || 'Dono',
    saldo_final: saldo
  });
}

// Cashier controls flow - Open Caixa
function abrirCaixaFluxo() {
  const valor = prompt('Digite o valor do fundo de troco para abrir o caixa (ex: 200.00):');
  if (valor === null) return;
  
  const fundo = parseFloat(valor);
  if (isNaN(fundo) || fundo < 0) {
    alert('Valor de fundo inválido.');
    return;
  }
  
  if (!confirm('Deseja abrir o caixa com fundo de troco de R$ ' + fundo.toFixed(2).replace('.', ',') + '?')) return;
  
  setLoader(true);
  socket.emit('abrir_caixa', {
    operador: loggedUser || 'Dono',
    fundo_troco: fundo
  });
}

// Logout panel
window.efetuarLogout = function() {
  if (confirm('Deseja sair do painel do dono?')) {
    localStorage.removeItem('chef_token');
    localStorage.removeItem('chef_credentials');
    window.location.href = '/login.html';
  }
};

// Accordion toggle behavior
accordionBtn.addEventListener('click', () => {
  const isOpen = accordionPanel.classList.toggle('open');
  if (isOpen) {
    accordionChevron.className = 'ph-bold ph-caret-up';
  } else {
    accordionChevron.className = 'ph-bold ph-caret-down';
  }
});

// Socket listeners setup
socket.on('connect', () => {
  adicionarAoFeed('feed', 'Painel do Dono conectado ao servidor principal');
});

socket.on('estado_caixa', (turno) => {
  showToast(`Status do caixa alterado para: ${turno.status}`, 'ph-lock-open');
  carregarMetricas();
});

socket.on('caixa_aberto_sucesso', () => {
  showToast('Caixa aberto com sucesso!', 'ph-check');
  carregarMetricas();
});

socket.on('erro_caixa', (msg) => {
  setLoader(false);
  alert(`Erro ao abrir caixa: ${msg}`);
});

socket.on('erro_fechar_caixa', (data) => {
  setLoader(false);
  alert(`Erro ao fechar caixa: ${data.msg}`);
});

// Real-time metrics triggers
socket.on('pedido_novo', (pedido) => {
  carregarMetricas();
  adicionarAoFeed('venda', `Novo pedido recebido de ${pedido.userName} (${pedido.localName}): ${pedido.productName}`);
});

socket.on('pedido_adicionado', (pedido) => {
  carregarMetricas();
  adicionarAoFeed('venda', `Item adicionado: ${pedido.quantity}x ${pedido.productName} na ${pedido.localName}`);
});

socket.on('status_atualizado', (pedido) => {
  carregarMetricas();
  adicionarAoFeed('venda', `Pedido de ${pedido.productName} na ${pedido.localName} mudou para: ${pedido.status}`);
});

socket.on('atualizacao_caixa', () => {
  carregarMetricas();
});

socket.on('rh_update', () => {
  carregarMetricas();
  adicionarAoFeed('ponto', 'Informações de RH / Colaboradores atualizadas!');
});

socket.on('alerta_desconto_financeiro', (data) => {
  carregarMetricas();
  if (data && data.valor) {
    adicionarAoFeed('venda', `⚠️ Desconto de R$ ${parseFloat(data.valor).toFixed(2)} por ${data.operador} em ${data.localName}`);
  }
});

socket.on('dono_acao_concluida', (data) => {
  showToast(data.mensagem || 'Ação registrada com sucesso!', 'ph-check-circle');
  carregarMetricas();
});

// Start initialization
startClock();
carregarMetricas();
