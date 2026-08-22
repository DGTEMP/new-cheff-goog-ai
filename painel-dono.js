// painel-dono.js - Owner Mobile Dashboard Logic (v2 - 60+ Acessível)

// (Segurança) Escapa valor para conteúdo HTML.
function escHtml(v) {
  return (v === null || v === undefined) ? '' : String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 1. Auth check
const token = localStorage.getItem('chef_token');
const loggedUser = localStorage.getItem('logged_user');

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
  if (data && data.restaurante_id) localStorage.setItem('restaurante_id', data.restaurante_id);
  if (data && data.token) localStorage.setItem('chef_token', data.token);
  socket.disconnect();
  socket.io.opts.query = { token: data.token, restaurante_id: String(data.restaurante_id) };
  socket.connect();
});

// ─── Cache DOM elements ───────────────────────────────────────
const loader           = document.getElementById('loader');
const faturamentoEl    = document.getElementById('kpi-faturamento');
const mesasEl          = document.getElementById('kpi-mesas');
const ticketEl         = document.getElementById('kpi-ticket');
const equipeEl         = document.getElementById('kpi-equipe');
const goalPercentEl    = document.getElementById('goal-percent');
const goalLabelEl      = document.getElementById('goal-target-label');
const progressFillEl   = document.getElementById('kpi-progress-fill');
const headerTimeEl     = document.getElementById('header-time');
const caixaBadgeEl     = document.getElementById('caixa-badge');
const caixaBadgeTxtEl  = document.getElementById('caixa-badge-txt');

const cashierControlTitle    = document.getElementById('cashier-control-title');
const cashierControlSubtitle = document.getElementById('cashier-control-subtitle');
const cashierToggleBtn       = document.getElementById('cashier-toggle-btn');
const cashierBtnText         = document.getElementById('cashier-btn-text');
const cashierBtnIcon         = document.getElementById('cashier-btn-icon');

const metaInput    = document.getElementById('meta-input');
const notifInput   = document.getElementById('notif-input');
const rankingList  = document.getElementById('ranking-list');
const activityFeed = document.getElementById('activity-feed');

// ─── Helpers ─────────────────────────────────────────────────
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function setLoader(show) {
  if (show) loader.classList.remove('hidden');
  else loader.classList.add('hidden');
}

// ─── Toast ───────────────────────────────────────────────────
function showToast(text, iconClass = 'ph-info', type = '') {
  const toast     = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  const toastIcon = document.getElementById('toast-icon');

  toastText.innerText = text;
  toastIcon.className = `ph-bold ${iconClass}`;
  toast.className = `toast show ${type}`;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4500);
}

// ─── Modal helpers ───────────────────────────────────────────
window.fecharModal = function(id) {
  document.getElementById(id).classList.add('hidden');
};

function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

// Fechar modal ao clicar no overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// ─── Clock ───────────────────────────────────────────────────
function startClock() {
  const update = () => {
    const d = new Date();
    if (headerTimeEl) headerTimeEl.innerText = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  update();
  setInterval(update, 60000);
}

// ─── Global period state ──────────────────────────────────────
window.periodoAtual    = 'hoje';
window.dataInicioCustom = '';
window.dataFimCustom   = '';

// ─── Carregar métricas via API ────────────────────────────────
async function carregarMetricas() {
  setLoader(true);
  try {
    let url = `/api/dono/dashboard?periodo=${window.periodoAtual}`;
    if (window.periodoAtual === 'custom' && window.dataInicioCustom && window.dataFimCustom) {
      url += `&data_inicio=${window.dataInicioCustom}&data_fim=${window.dataFimCustom}`;
    }

    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

    if (res.status === 403 || res.status === 401) {
      alert('Sessão expirada ou sem permissão de administrador.');
      window.location.href = '/login.html';
      return;
    }

    const result = await res.json();
    if (result.success && result.data) {
      const data = result.data;

      // Period label
      const rotuloEl = document.getElementById('periodo-rotulo-exibicao');
      if (rotuloEl) rotuloEl.innerText = data.rotuloPeriodo || 'Hoje';

      const titleFat = document.getElementById('kpi-title-faturamento');
      if (titleFat) titleFat.innerText = `💰 Faturamento (${data.rotuloPeriodo || 'Hoje'})`;

      const subPed = document.getElementById('kpi-sub-total-pedidos');
      if (subPed) subPed.innerText = `${data.totalPedidos || 0} pedidos finalizados`;

      // KPIs
      if (faturamentoEl) faturamentoEl.innerText = formatCurrency(data.faturamentoHoje);
      if (mesasEl)       mesasEl.innerText = data.mesasAtivas || '0';
      if (ticketEl)      ticketEl.innerText = formatCurrency(data.ticketMedio);
      if (equipeEl)      equipeEl.innerText = data.colaboradoresAtivos || '0';

      // Meta
      if (metaInput) metaInput.value = metaVendas;
      if (goalLabelEl) goalLabelEl.innerText = `Meta: ${formatCurrency(metaVendas)}`;

      const percent = metaVendas > 0
        ? Math.min(100, Math.round((data.faturamentoHoje / metaVendas) * 100))
        : 0;
      if (goalPercentEl)  goalPercentEl.innerText = `${percent}% da meta`;
      if (progressFillEl) progressFillEl.style.width = `${percent}%`;

      // Caixa status
      const isOpen = data.caixaStatus === 'Aberto';

      if (caixaBadgeEl) {
        caixaBadgeEl.className = `status-pill ${isOpen ? 'open' : 'closed'}`;
        caixaBadgeEl.innerHTML = `<span class="dot"></span><span id="caixa-badge-txt">${escHtml(data.caixaStatus)}</span>`;
      }

      if (cashierControlTitle)    cashierControlTitle.innerText  = isOpen ? 'Caixa está Aberto ✅' : 'Caixa está Fechado 🔒';
      if (cashierControlSubtitle) cashierControlSubtitle.innerText = isOpen
        ? `Fundo de troco: ${formatCurrency(data.caixaSaldo)}`
        : 'Toque em "Abrir" para iniciar as vendas.';

      if (cashierToggleBtn) {
        if (isOpen) {
          cashierToggleBtn.className = 'btn-caixa close';
          if (cashierBtnText) cashierBtnText.innerText = 'Fechar';
          if (cashierBtnIcon) cashierBtnIcon.className = 'ph-bold ph-lock';
          cashierToggleBtn.onclick = fecharCaixaFluxo;
        } else {
          cashierToggleBtn.className = 'btn-caixa open';
          if (cashierBtnText) cashierBtnText.innerText = 'Abrir';
          if (cashierBtnIcon) cashierBtnIcon.className = 'ph-bold ph-lock-open';
          cashierToggleBtn.onclick = abrirCaixaFluxo;
        }
      }

      // Ranking de produtos
      if (rankingList) {
        if (data.topProdutos && data.topProdutos.length > 0) {
          rankingList.innerHTML = data.topProdutos.map((p, idx) => `
            <div class="ranking-item">
              <span class="ranking-pos">${idx + 1}º</span>
              <span class="rk-name">${escHtml(p.productEmoji || '🍽️')} ${escHtml(p.productName)}</span>
              <span class="rk-val">${p.quantidade}x</span>
            </div>
          `).join('');
        } else {
          rankingList.innerHTML = `<div style="text-align:center;color:var(--text-sub);padding:24px;font-size:var(--fs-md);">Nenhuma venda (${escHtml(data.rotuloPeriodo || 'período')}).</div>`;
        }
      }
    }
  } catch (error) {
    console.error('Erro ao carregar métricas:', error);
    showToast('Erro de conexão ao atualizar métricas', 'ph-wifi-slash', 'error');
  } finally {
    setLoader(false);
  }
}

// ─── Period Filters ───────────────────────────────────────────
window.selecionarPeriodoDono = function(periodo, btnEl) {
  window.periodoAtual = periodo;
  document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  const cust = document.getElementById('container-datas-custom');
  if (cust) cust.style.display = 'none';
  carregarMetricas();
};

window.togglePeriodoCustomDono = function(btnEl) {
  document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  const container = document.getElementById('container-datas-custom');
  if (container) container.style.display = container.style.display === 'none' ? 'flex' : 'none';
};

window.aplicarDatasCustomDono = function() {
  const ini = document.getElementById('dono-data-inicio').value;
  const fim = document.getElementById('dono-data-fim').value;
  if (!ini || !fim) return showToast('Selecione a data inicial e final.', 'ph-warning');
  window.periodoAtual    = 'custom';
  window.dataInicioCustom = ini;
  window.dataFimCustom   = fim;
  carregarMetricas();
};

// ─── Controle Remoto — Navegação ─────────────────────────────
window.comandarNavegacao = function(destino) {
  socket.emit('comando_navegar_caixa', {
    destino: destino,
    solicitadoPor: loggedUser || 'Dono'
  });
  showToast(`Enviando caixa para ${destino}...`, 'ph-paper-plane');
  adicionarAoFeed('aviso', `Você direcionou o caixa para: ${destino}`);
};

// ─── Caixa Abrir / Fechar — com modais ───────────────────────
function abrirCaixaFluxo() {
  const input = document.getElementById('fundo-troco-input');
  if (input) input.value = '';
  abrirModal('modal-abrir-caixa');
}

function fecharCaixaFluxo() {
  const input = document.getElementById('saldo-final-input');
  if (input) input.value = '';
  abrirModal('modal-fechar-caixa');
}

window.confirmarAbrirCaixa = function() {
  const input = document.getElementById('fundo-troco-input');
  const fundo = parseFloat(input ? input.value : '');
  if (isNaN(fundo) || fundo < 0) {
    showToast('Digite um valor válido para o fundo de troco.', 'ph-warning', 'error');
    return;
  }
  fecharModal('modal-abrir-caixa');
  setLoader(true);
  socket.emit('abrir_caixa', {
    operador: loggedUser || 'Dono',
    fundo_troco: fundo
  });
};

window.confirmarFecharCaixa = function() {
  const input = document.getElementById('saldo-final-input');
  const saldo = parseFloat(input ? input.value : '');
  if (isNaN(saldo) || saldo < 0) {
    showToast('Digite o valor total encontrado no caixa.', 'ph-warning', 'error');
    return;
  }
  fecharModal('modal-fechar-caixa');
  setLoader(true);
  socket.emit('fechar_caixa', {
    operador: loggedUser || 'Dono',
    saldo_final: saldo
  });
};

// ─── RH: Gerenciar equipe ─────────────────────────────────────
window.carregarFuncionariosRhDono = async function() {
  const select = document.getElementById('select-rh-funcionario');
  if (!select) return;
  try {
    const res  = await fetch('/api/funcionarios', { headers: { 'Authorization': `Bearer ${token}` } });
    const funcs = await res.json();
    if (Array.isArray(funcs) && funcs.length > 0) {
      select.innerHTML = funcs.map(f =>
        `<option value="${f.id}">${escHtml(f.nome)} (${escHtml(f.cargo || 'Colaborador')})</option>`
      ).join('');
    } else {
      select.innerHTML = `<option value="">Nenhum funcionário encontrado</option>`;
    }
  } catch (e) {
    select.innerHTML = `<option value="">Erro ao carregar</option>`;
  }
};

window.abrirModalRhDono = function() {
  window.carregarFuncionariosRhDono();
  alternarAbaRhDono('pagamento');
  abrirModal('modal-rh-dono');
};

window.alternarAbaRhDono = function(aba) {
  ['pagamento', 'falta', 'folga'].forEach(a => {
    const btn = document.getElementById(`tab-rh-btn-${a}`);
    const panel = document.getElementById(`aba-rh-${a}`);
    if (btn) btn.className = `rh-tab ${a === aba ? 'active' : ''}`;
    if (panel) panel.style.display = a === aba ? 'block' : 'none';
  });
};

window.salvarPagamentoDono = function() {
  const funcId = document.getElementById('select-rh-funcionario').value;
  const val    = parseFloat(document.getElementById('rh-pagamento-valor').value);
  const forma  = document.getElementById('rh-pagamento-forma').value;
  const obs    = document.getElementById('rh-pagamento-obs').value;

  if (!funcId || isNaN(val) || val <= 0) {
    showToast('Selecione o colaborador e informe um valor válido.', 'ph-warning', 'error');
    return;
  }

  socket.emit('dono_registrar_pagamento', {
    funcionario_id: funcId, valor: val,
    forma_pagamento: forma, observacao: obs,
    operador: loggedUser || 'Dono'
  });

  fecharModal('modal-rh-dono');
  document.getElementById('rh-pagamento-valor').value = '';
  showToast('Pagamento enviado, aguarde confirmação...', 'ph-hourglass');
};

window.salvarAbonoFaltaDono = function() {
  const funcId    = document.getElementById('select-rh-funcionario').value;
  const dataFalta = document.getElementById('rh-falta-data').value;
  const justif    = document.getElementById('rh-falta-justificativa').value;
  const remun     = document.getElementById('rh-falta-remunerada').checked;

  if (!funcId || !dataFalta || !justif) {
    showToast('Preencha a data da falta e o motivo.', 'ph-warning', 'error');
    return;
  }

  socket.emit('dono_abonar_falta', {
    funcionario_id: funcId, data_falta: dataFalta,
    justificativa: justif, remunerado: remun,
    operador: loggedUser || 'Dono'
  });

  fecharModal('modal-rh-dono');
  document.getElementById('rh-falta-data').value = '';
  document.getElementById('rh-falta-justificativa').value = '';
  showToast('Falta enviada, aguarde confirmação...', 'ph-hourglass');
};

window.salvarFolgaDono = function() {
  const funcId = document.getElementById('select-rh-funcionario').value;
  const ini    = document.getElementById('rh-folga-inicio').value;
  const fim    = document.getElementById('rh-folga-fim').value;
  const tipo   = document.getElementById('rh-folga-tipo').value;
  const obs    = document.getElementById('rh-folga-obs').value;

  if (!funcId || !ini) {
    showToast('Selecione o colaborador e a data da folga.', 'ph-warning', 'error');
    return;
  }

  socket.emit('dono_conceder_folga', {
    funcionario_id: funcId, data_inicio: ini,
    data_fim: fim || ini, tipo_folga: tipo,
    observacao: obs, operador: loggedUser || 'Dono'
  });

  fecharModal('modal-rh-dono');
  document.getElementById('rh-folga-inicio').value = '';
  showToast('Folga enviada, aguarde confirmação...', 'ph-hourglass');
};

// ─── Meta de vendas ───────────────────────────────────────────
window.salvarMeta = function() {
  const val = parseFloat(metaInput.value);
  if (isNaN(val) || val <= 0) {
    showToast('Insira um valor de meta válido.', 'ph-warning', 'error');
    return;
  }
  metaVendas = val;
  localStorage.setItem('meta_dono_vendas', val);
  carregarMetricas();
  showToast('Meta diária salva com sucesso!', 'ph-check-circle', 'success');
};

// ─── Enviar aviso para equipe ─────────────────────────────────
window.notificarEquipe = function() {
  const text = notifInput.value.trim();
  if (!text) {
    showToast('Digite o aviso antes de enviar.', 'ph-warning', 'error');
    return;
  }
  socket.emit('enviar_notificacao_equipe', { texto: text });
  notifInput.value = '';
  showToast('Aviso enviado para a equipe!', 'ph-paper-plane', 'success');
  adicionarAoFeed('aviso', `Você enviou: "${text}"`);
};

// ─── Feed de Atividade ────────────────────────────────────────
function adicionarAoFeed(tipo, texto) {
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let icon = 'ph-info', colorClass = 'blue';
  if (tipo === 'venda')  { icon = 'ph-currency-dollar'; colorClass = 'green'; }
  else if (tipo === 'aviso') { icon = 'ph-megaphone';   colorClass = 'purple'; }
  else if (tipo === 'ponto') { icon = 'ph-user-check';  colorClass = 'blue'; }

  if (activityFeed && activityFeed.innerText.includes('Aguardando atividades')) {
    activityFeed.innerHTML = '';
  }

  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `
    <div class="feed-icon ${colorClass}">
      <i class="ph-fill ${icon}"></i>
    </div>
    <div>
      <div class="feed-text">${texto}</div>
      <div class="feed-time">${now}</div>
    </div>
  `;

  if (activityFeed) activityFeed.prepend(item);
  while (activityFeed && activityFeed.children.length > 15) activityFeed.lastChild.remove();
}

// ─── Ranking accordion ───────────────────────────────────────
window.toggleRanking = function() {
  const body    = document.getElementById('ranking-body');
  const chevron = document.getElementById('ranking-chevron');
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (chevron) chevron.classList.toggle('open', isOpen);
};

// ─── Logout ───────────────────────────────────────────────────
window.efetuarLogout = function() {
  if (confirm('Deseja sair do painel do dono?')) {
    localStorage.removeItem('chef_token');
    localStorage.removeItem('chef_credentials');
    window.location.href = '/login.html';
  }
};

// ─── Socket listeners ────────────────────────────────────────
socket.on('connect', () => {
  adicionarAoFeed('feed', 'Painel do Dono conectado ao servidor');
});

socket.on('estado_caixa', () => carregarMetricas());
socket.on('caixa_aberto_sucesso', () => {
  showToast('✅ Caixa aberto com sucesso!', 'ph-lock-open', 'success');
  carregarMetricas();
});
socket.on('erro_caixa', (msg) => {
  setLoader(false);
  showToast(`Erro ao abrir caixa: ${msg}`, 'ph-warning', 'error');
});
socket.on('erro_fechar_caixa', (data) => {
  setLoader(false);
  showToast(`Erro ao fechar caixa: ${data && data.msg || data}`, 'ph-warning', 'error');
});
socket.on('atualizacao_caixa', () => {
  if (window.periodoAtual === 'hoje') carregarMetricas();
});
socket.on('financeiro_atualizado', () => {
  if (window.periodoAtual === 'hoje') carregarMetricas();
});
socket.on('pedido_novo', (pedido) => {
  carregarMetricas();
  adicionarAoFeed('venda', `Novo pedido de ${pedido.userName} (${pedido.localName}): ${pedido.productName}`);
});
socket.on('pedido_adicionado', (pedido) => {
  carregarMetricas();
  adicionarAoFeed('venda', `${pedido.quantity}x ${pedido.productName} na ${pedido.localName}`);
});
socket.on('status_atualizado', (pedido) => {
  carregarMetricas();
  adicionarAoFeed('venda', `${pedido.productName} (${pedido.localName}) → ${pedido.status}`);
});
socket.on('rh_update', () => {
  carregarMetricas();
  adicionarAoFeed('ponto', 'Informações de colaboradores atualizadas!');
});
socket.on('alerta_desconto_financeiro', (data) => {
  carregarMetricas();
  if (data && data.valor) {
    adicionarAoFeed('venda', `⚠️ Desconto R$${parseFloat(data.valor).toFixed(2)} por ${data.operador} em ${data.localName}`);
  }
});

// Confirmações de ações do dono
socket.on('dono_acao_concluida', (data) => {
  showToast(data.mensagem || 'Ação registrada com sucesso!', 'ph-check-circle', 'success');
  carregarMetricas();
  adicionarAoFeed('aviso', data.mensagem || 'Ação registrada com sucesso!');
});
socket.on('dono_acao_erro', (data) => {
  showToast(data.mensagem || 'Erro ao executar ação.', 'ph-warning', 'error');
});

// ─── Alta Demanda: "Uau, seu negócio está bombando!" ─────────────
let _modalDemandaAberto = false;

function mostrarCelebracaoDemanda(data) {
  if (_modalDemandaAberto) return;
  _modalDemandaAberto = true;
  const ppm = (data && data.pedidos_por_minuto) || '';
  const overlay = document.createElement('div');
  overlay.id = 'modal-demanda-alta';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,20,0.75);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.innerHTML = `
    <div style="background:linear-gradient(160deg,#1e1b4b,#312e81);border:1px solid rgba(250,204,21,0.4);border-radius:24px;max-width:420px;width:100%;padding:2rem;text-align:center;color:#fff;font-family:inherit;box-shadow:0 25px 80px rgba(0,0,0,0.6);">
      <div style="font-size:3.5rem;line-height:1;margin-bottom:0.5rem;">🎉</div>
      <h2 style="font-size:1.5rem;font-weight:800;margin:0 0 0.35rem;background:linear-gradient(90deg,#facc15,#fb923c);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">Uau, seu negócio está bombando!</h2>
      <p style="font-size:0.85rem;color:#c7d2fe;margin:0 0 1.25rem;">
        ${ppm ? `Detectamos <strong style="color:#fff;">${ppm} pedidos por minuto</strong> por aqui. ` : ''}Você está tendo algum evento específico hoje?
      </p>
      <div style="display:flex;flex-direction:column;gap:0.6rem;">
        <button id="btn-evento-sim" style="background:linear-gradient(90deg,#f59e0b,#f97316);border:none;border-radius:12px;padding:0.8rem;color:#fff;font-weight:700;font-size:0.9rem;cursor:pointer;">🎉 Sim, é um evento!</button>
        <input id="input-evento-desc" type="text" placeholder="Ex.: Festa, show, happy hour..." maxlength="200"
          style="display:none;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:0.65rem 0.8rem;color:#fff;font-size:0.85rem;">
        <input id="input-evento-horas" type="number" min="1" max="72" value="4" placeholder="Duração (horas)"
          style="display:none;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:0.65rem 0.8rem;color:#fff;font-size:0.85rem;">
        <button id="btn-evento-confirmar" style="display:none;background:var(--primary,#6366f1);border:none;border-radius:12px;padding:0.8rem;color:#fff;font-weight:700;font-size:0.9rem;cursor:pointer;">Confirmar evento</button>
        <button id="btn-evento-nao" style="background:transparent;border:1px solid rgba(255,255,255,0.25);border-radius:12px;padding:0.7rem;color:#c7d2fe;font-size:0.85rem;cursor:pointer;">Não, só movimento mesmo 😄</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const inputDesc = overlay.querySelector('#input-evento-desc');
  const inputHoras = overlay.querySelector('#input-evento-horas');
  const btnConfirmar = overlay.querySelector('#btn-evento-confirmar');
  const btnSim = overlay.querySelector('#btn-evento-sim');
  const btnNao = overlay.querySelector('#btn-evento-nao');

  btnSim.addEventListener('click', () => {
    btnSim.style.display = 'none';
    inputDesc.style.display = 'block';
    inputHoras.style.display = 'block';
    btnConfirmar.style.display = 'block';
    inputDesc.focus();
  });

  btnConfirmar.addEventListener('click', async () => {
    const descricao = inputDesc.value.trim();
    const duracao_horas = parseFloat(inputHoras.value) || 4;
    btnConfirmar.disabled = true;
    try {
      await fetch('/api/evento-pico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('chef_token') || '') },
        body: JSON.stringify({ descricao, duracao_horas })
      });
      adicionarAoFeed('aviso', '🎉 Evento declarado! Sistema otimizado para o pico.');
    } catch (e) { }
    fechar();
  });

  btnNao.addEventListener('click', () => fechar());
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) fechar(); });

  function fechar() {
    _modalDemandaAberto = false;
    overlay.remove();
  }
}

socket.on('demanda_alta', (data) => {
  mostrarCelebracaoDemanda(data);
});

// ─── Inicialização ────────────────────────────────────────────
window.onload = () => {
  startClock();
  carregarMetricas();
  carregarFuncionalidades();
};
startClock();
carregarMetricas();

// ─── Funcionalidades (Feature Toggles) ────────────────────────
const FEATURE_DEFS = [
  { key: 'feature_venda_sem_estoque',      label: 'Vender sem Estoque',       desc: 'Vender com estoque zerado',  icon: 'ph-package',         color: '#ef4444' },
  { key: 'feature_toggle_produto_rapido',  label: 'Toggle Produto Rápido',   desc: 'Ativar/desativar na lista',  icon: 'ph-toggle-right',    color: '#3b82f6' },
  { key: 'feature_alterar_valores_pdv',    label: 'Alterar Valores PDV',     desc: 'Mudar preço no carrinho',    icon: 'ph-currency-dollar', color: '#f59e0b' },
  { key: 'feature_clientes_ativos',        label: 'Clientes Ativos Hoje',    desc: 'Ranking de clientes',        icon: 'ph-users-three',     color: '#8b5cf6' },
  { key: 'feature_produto_mais_vendido',   label: 'Mais Vendido',            desc: 'Produto campeão do dia',     icon: 'ph-trophy',          color: '#10b981' },
  { key: 'feature_maior_lucro',            label: 'Maior Lucro',             desc: 'Produto mais lucrativo',     icon: 'ph-chart-line-up',   color: '#06b6d4' },
  { key: 'feature_impressao_digital',      label: 'Impressão Digital',       desc: 'Pedidos na fila digital',    icon: 'ph-monitor',         color: '#22c55e' },
  { key: 'feature_impressao_termica',      label: 'Impressão Térmica',       desc: 'Imprimir na termica',        icon: 'ph-printer',         color: '#ec4899' },
  { key: 'feature_produtos_lote',          label: 'Produtos em Lote',        desc: 'Gestão em massa',            icon: 'ph-stack',           color: '#a855f7' }
];

async function carregarFuncionalidades() {
  try {
    const res = await fetch('/api/config', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const cfgs = await res.json();
    const grid = document.getElementById('features-grid-dono');
    if (!grid) return;

    grid.innerHTML = FEATURE_DEFS.map(f => {
      const val = cfgs[f.key] === 'true' || cfgs[f.key] === true;
      return `
        <div class="feature-card ${val ? 'active' : ''}" id="fc-${f.key}">
          <div class="feature-icon" style="background:${f.color}15;">
            <i class="ph ${f.icon}" style="color:${f.color};"></i>
          </div>
          <div class="feature-info">
            <div class="feature-name">${f.label}</div>
            <div class="feature-desc">${f.desc}</div>
          </div>
          <label class="feature-toggle">
            <input type="checkbox" ${val ? 'checked' : ''} onchange="window.toggleFeatureDono('${f.key}', this.checked)">
            <span class="track"></span>
            <span class="thumb"></span>
          </label>
        </div>`;
    }).join('');
  } catch (e) {
    console.error('Erro ao carregar funcionalidades:', e);
  }
}

window.toggleFeatureDono = async function(key, value) {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: String(value) })
    });
    const card = document.getElementById('fc-' + key);
    if (card) card.classList.toggle('active', value);
    showToast(`${value ? 'Funcionalidade ativada' : 'Funcionalidade desativada'}`, 'ph-check-circle', 'success');
  } catch (e) {
    showToast('Erro ao salvar funcionalidade', 'ph-warning', 'error');
  }
};


// ── Reportar Problema → Suporte ─────────────────────────────
let _relatoPrioridade = 'media';

window.abrirModalRelato = function() {
  var m = document.getElementById('modal-relato');
  if (!m) return;
  m.style.display = 'flex';
  var fb = document.getElementById('relato-feedback');
  if (fb) fb.style.display = 'none';
};

window.fecharModalRelato = function() {
  var m = document.getElementById('modal-relato');
  if (m) m.style.display = 'none';
};

window.selecionarPrioridade = function(pri, btn) {
  _relatoPrioridade = pri;
  document.querySelectorAll('.relato-pri').forEach(function(b) { b.classList.remove('ativa'); });
  if (btn) btn.classList.add('ativa');
};

window.enviarRelato = async function() {
  var titulo = document.getElementById('relato-titulo');
  var descricao = document.getElementById('relato-descricao');
  var categoria = document.getElementById('relato-categoria');
  var feedback = document.getElementById('relato-feedback');
  var botao = document.getElementById('btn-enviar-relato');
  if (!titulo || !descricao || !botao) return;

  var mostrarFeedback = function(msg, tipo) {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.className = 'relato-feedback ' + tipo;
    feedback.style.display = 'block';
  };

  if (!titulo.value.trim() || !descricao.value.trim()) {
    mostrarFeedback('Preencha o título e a descrição do problema.', 'erro');
    return;
  }

  botao.disabled = true;
  try {
    const res = await fetch('/api/dono/reportar-problema', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: titulo.value.trim(), descricao: descricao.value.trim(), categoria: categoria ? categoria.value : 'outro', prioridade: _relatoPrioridade })
    });
    const data = await res.json();
    if (data && data.ok) {
      mostrarFeedback(data.mensagem || 'Relato enviado com sucesso!', 'sucesso');
      titulo.value = '';
      descricao.value = '';
      setTimeout(function() { fecharModalRelato(); }, 2200);
      showToast('Relato enviado ao suporte', 'ph-lifebuoy', 'success');
    } else {
      mostrarFeedback((data && data.erro) || 'Não foi possível enviar o relato.', 'erro');
    }
  } catch (e) {
    mostrarFeedback('Erro de conexão. Tente novamente.', 'erro');
  }
  botao.disabled = false;
};
