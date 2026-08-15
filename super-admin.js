/**
 * super-admin.js — Painel de Super Admin do Chef Cozinha (Modo Local)
 * Gerencia restaurantes, usuários, clientes, servidor, logs, configurações e terminal.
 */

var localToken = '';
var restaurantesData = [];
var usuariosData = [];
var clientesData = [];
var isLocalMode = false;

/* ═══ INACTIVITY TIMEOUT ═══ */
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
let inactivityTimer = null;
const INACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'wheel'];
let _inactivityHandlers = [];

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(logout, INACTIVITY_TIMEOUT_MS);
}

function startInactivityMonitor() {
  stopInactivityMonitor();
  INACTIVITY_EVENTS.forEach(function(ev) {
    var handler = resetInactivityTimer;
    window.addEventListener(ev, handler);
    _inactivityHandlers.push({ ev: ev, handler: handler });
  });
  resetInactivityTimer();
}

function stopInactivityMonitor() {
  clearTimeout(inactivityTimer);
  for (var i = 0; i < _inactivityHandlers.length; i++) {
    window.removeEventListener(_inactivityHandlers[i].ev, _inactivityHandlers[i].handler);
  }
  _inactivityHandlers = [];
}

/* ═══ TOAST ═══ */
function showToast(text, type) {
  var t = document.getElementById('toast');
  var icon = document.getElementById('toast-icon');
  var txt = document.getElementById('toast-text');
  if (!t) return;
  txt.textContent = text;
  var icons = { info: 'fa-circle-info', success: 'fa-circle-check', danger: 'fa-circle-xmark', warning: 'fa-triangle-exclamation' };
  icon.className = 'fa-solid ' + (icons[type] || icons.info);
  t.className = 'toast active toast-' + (type || 'info');
  setTimeout(function() { t.className = 'toast'; }, 4000);
}

/* ═══ AUTH ═══ */
function authHeaders() {
  return { 'Content-Type': 'application/json', 'x-super-admin-token': localToken };
}

function apiGet(url, cb) {
  var x = new XMLHttpRequest();
  x.open('GET', url, true);
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try { cb(null, JSON.parse(x.responseText)); }
      catch(e) { cb(e, null); }
    }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(null);
}

function apiPost(url, data, cb) {
  var x = new XMLHttpRequest();
  x.open('POST', url, true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try { cb(null, JSON.parse(x.responseText)); }
      catch(e) { cb(e, null); }
    }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(JSON.stringify(data));
}

function apiPut(url, data, cb) {
  var x = new XMLHttpRequest();
  x.open('PUT', url, true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try { cb(null, JSON.parse(x.responseText)); }
      catch(e) { cb(e, null); }
    }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(JSON.stringify(data));
}

function apiDelete(url, cb) {
  var x = new XMLHttpRequest();
  x.open('DELETE', url, true);
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try { cb(null, JSON.parse(x.responseText)); }
      catch(e) { cb(e, null); }
    }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(null);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ═══ LOGIN ═══ */
function loginLocal() {
  var senha = document.getElementById('local-senha').value.trim();
  if (!senha) { showToast('Informe a senha de administrador!', 'warning'); return; }

  var x = new XMLHttpRequest();
  x.open('POST', '/api/super/login-local', true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try {
        var data = JSON.parse(x.responseText);
        if (data.ok) {
          localToken = data.token;
          localStorage.setItem('chef_super_admin_local_token', data.token);
          entrarNoPainel();
          showToast('Acesso liberado!', 'success');
        } else {
          showToast(data.erro || 'Erro ao realizar login.', 'danger');
        }
      } catch(e) {
        showToast('Falha na conexão com o servidor.', 'danger');
      }
    }
  };
  x.send(JSON.stringify({ senha: senha }));
}

function entrarNoPainel() {
  isLocalMode = true;
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'grid';
  document.body.style.alignItems = 'stretch';
  switchTab('sec-dash');
  carregarDashboard();
  startInactivityMonitor();
}

function logout() {
  stopInactivityMonitor();
  localStorage.removeItem('chef_super_admin_local_token');
  localToken = '';
  isLocalMode = false;
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('admin-panel').style.display = 'none';
  document.body.style.alignItems = 'center';
}

/* ═══ CLIENTES ═══ */
function carregarClientes() {
  var tbody = document.getElementById('clientes-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Carregando clientes...</td></tr>';
  
  apiGet('/api/super/clientes', function(err, data) {
    if (err || !data || !data.ok) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444;">Erro ao carregar clientes.</td></tr>';
      return;
    }
    clientesData = data.clientes || [];
    renderClientes();
    popularFiltroRestaurantesClientes();
  });
}

function renderClientes() {
  var search = (document.getElementById('clientes-search').value || '').toLowerCase();
  var filterRest = document.getElementById('clientes-filter-rest').value;
  var filtered = [];
  for (var i = 0; i < clientesData.length; i++) {
    var c = clientesData[i];
    if (search && c.nome.toLowerCase().indexOf(search) === -1 && (c.telefone || '').indexOf(search) === -1) continue;
    if (filterRest && String(c.restaurante_id) !== filterRest) continue;
    filtered.push(c);
  }
  var tbody = document.getElementById('clientes-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum cliente encontrado.</td></tr>';
    return;
  }
  var html = '';
  for (var j = 0; j < filtered.length; j++) {
    var c2 = filtered[j];
    html += '<tr>' +
      '<td><div style="font-weight:600;color:white;">' + esc(c2.nome) + '</div></td>' +
      '<td>' + esc(c2.telefone || '—') + '</td>' +
      '<td><small>' + esc(c2.restaurante_nome || '—') + '</small></td>' +
      '<td style="text-align:center;"><span class="badge badge-plano">' + (c2.pontos || 0) + '</span></td>' +
      '<td>R$ ' + formatMoney(c2.total_gasto || 0) + '</td>' +
      '<td style="text-align:center;">' + (c2.total_pedidos || 0) + '</td>' +
      '<td><button class="btn-row-action edit-action" onclick="abrirPerfilCliente(' + c2.id + ',' + c2.restaurante_id + ')" title="Ver perfil completo"><i class="fa-solid fa-user"></i></button></td>' +
      '</tr>';
  }
  tbody.innerHTML = html;
}

function popularFiltroRestaurantesClientes() {
  var select = document.getElementById('clientes-filter-rest');
  if (!select) return;
  var currentVal = select.value;
  var seen = {};
  select.innerHTML = '<option value="">Todos os Restaurantes</option>';
  for (var i = 0; i < clientesData.length; i++) {
    var c = clientesData[i];
    if (!seen[c.restaurante_id]) {
      seen[c.restaurante_id] = true;
      var opt = document.createElement('option');
      opt.value = c.restaurante_id;
      opt.textContent = c.restaurante_nome || 'Restaurante #' + c.restaurante_id;
      select.appendChild(opt);
    }
  }
  select.value = currentVal;
}

function abrirPerfilCliente(clienteId, restauranteId) {
  var body = document.getElementById('perfil-cliente-body');
  body.innerHTML = '<div style="text-align:center;padding:30px;color:#888;">Carregando perfil...</div>';
  document.getElementById('modal-perfil-cliente').classList.add('active');
  
  apiGet('/api/super/clientes/' + clienteId + '?restaurante_id=' + restauranteId, function(err, data) {
    if (err || !data || !data.ok) {
      body.innerHTML = '<div style="text-align:center;padding:30px;color:#ef4444;">Erro ao carregar perfil do cliente.</div>';
      return;
    }
    var c = data.cliente;
    var html = '';
    
    // Card de informações pessoais
    html += '<div class="stats-grid" style="margin-bottom:1.5rem;">';
    html += '<div class="stat-card active-card"><div class="stat-icon"><i class="fa-solid fa-user"></i></div><div class="stat-meta"><span>Nome</span><h3>' + esc(c.nome) + '</h3></div></div>';
    html += '<div class="stat-card trial-card"><div class="stat-icon"><i class="fa-solid fa-phone"></i></div><div class="stat-meta"><span>Telefone</span><h3 style="font-size:1.1rem;">' + esc(c.telefone || '—') + '</h3></div></div>';
    html += '<div class="stat-card blocked-card"><div class="stat-icon"><i class="fa-solid fa-location-dot"></i></div><div class="stat-meta"><span>Endereço</span><h3 style="font-size:1.1rem;">' + esc(c.endereco || '—') + '</h3></div></div>';
    html += '<div class="stat-card expired-card"><div class="stat-icon"><i class="fa-solid fa-cake-candles"></i></div><div class="stat-meta"><span>Data Nasc.</span><h3 style="font-size:1.1rem;">' + (c.data_nascimento || '—') + '</h3></div></div>';
    html += '<div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-star" style="color:#f59e0b;"></i></div><div class="stat-meta"><span>Pontos Fidelidade</span><h3>' + (c.pontos || 0) + '</h3></div></div>';
    html += '<div class="stat-card active-card"><div class="stat-icon"><i class="fa-solid fa-coins" style="color:#10b981;"></i></div><div class="stat-meta"><span>Total Gasto</span><h3>R$ ' + formatMoney(c.total_gasto || 0) + '</h3></div></div>';
    html += '<div class="stat-card trial-card"><div class="stat-icon"><i class="fa-solid fa-receipt" style="color:#3b82f6;"></i></div><div class="stat-meta"><span>Total Pedidos</span><h3>' + (c.total_pedidos || 0) + '</h3></div></div>';
    html += '<div class="stat-card expired-card"><div class="stat-icon"><i class="fa-solid fa-clock"></i></div><div class="stat-meta"><span>Última Visita</span><h3 style="font-size:1rem;">' + (c.ultima_visita ? new Date(c.ultima_visita).toLocaleDateString('pt-BR') : '—') + '</h3></div></div>';
    html += '</div>';
    
    // Observação
    if (c.observacao) {
      html += '<div class="info-banner" style="margin-bottom:1rem;"><i class="fa-solid fa-note-sticky"></i><div class="info-banner-content"><p>' + esc(c.observacao) + '</p></div></div>';
    }
    
    // Histórico de pedidos
    html += '<h4 style="margin-bottom:0.8rem;"><i class="fa-solid fa-clock-rotate-left"></i> Últimos Pedidos</h4>';
    if (!c.pedidos || c.pedidos.length === 0) {
      html += '<p style="color:var(--text-muted);text-align:center;padding:20px;">Nenhum pedido encontrado.</p>';
    } else {
      html += '<div style="overflow-x:auto;max-height:300px;overflow-y:auto;"><table class="custom-table"><thead><tr>' +
        '<th>#</th><th>Produto</th><th>Qtd</th><th>Total</th><th>Status</th><th>Mesa</th><th>Data</th>' +
        '</tr></thead><tbody>';
      for (var i = 0; i < Math.min(c.pedidos.length, 50); i++) {
        var p = c.pedidos[i];
        var statusColors = { 'Finalizado': '#22c55e', 'Pago': '#22c55e', 'Entregue': '#3b82f6', 'Em preparo': '#f59e0b', 'Cancelado': '#ef4444' };
        var sc = statusColors[p.status] || '#888';
        html += '<tr>' +
          '<td><small>#' + p.id + '</small></td>' +
          '<td>' + esc(p.productName || '—') + '</td>' +
          '<td style="text-align:center;">' + (p.quantity || 0) + '</td>' +
          '<td>R$ ' + (parseFloat(String(p.total).replace(',', '.')) || 0).toFixed(2).replace('.', ',') + '</td>' +
          '<td style="color:' + sc + ';">' + esc(p.status) + '</td>' +
          '<td>' + esc(p.localName || '—') + '</td>' +
          '<td><small>' + (p.createdAt ? new Date(p.createdAt).toLocaleString('pt-BR') : '—') + '</small></td>' +
          '</tr>';
      }
      html += '</tbody></table></div>';
    }
    
    body.innerHTML = html;
  });
}

/* ═══ LOGIN MODE TOGGLE ═══ */
function setLoginMode(mode) {
  var tabLocal = document.getElementById('tab-local');
  var tabCloud = document.getElementById('tab-cloud');
  var loginLocal = document.getElementById('login-local');
  var loginCloud = document.getElementById('login-cloud');

  if (mode === 'local') {
    if (tabLocal) tabLocal.classList.add('active');
    if (tabCloud) tabCloud.classList.remove('active');
    if (loginLocal) loginLocal.style.display = 'block';
    if (loginCloud) loginCloud.style.display = 'none';
  } else {
    if (tabCloud) tabCloud.classList.add('active');
    if (tabLocal) tabLocal.classList.remove('active');
    if (loginLocal) loginLocal.style.display = 'none';
    if (loginCloud) loginCloud.style.display = 'block';
  }
}
window.setLoginMode = setLoginMode;

/* ═══ NAVEGAÇÃO ═══ */
function switchTab(targetId) {
  var items = document.querySelectorAll('.menu-item');
  var sections = document.querySelectorAll('.content-section');
  var titles = {
    'sec-dash': ['Dashboard', 'Visão geral do ecossistema Chef Cozinha'],
    'sec-bi': ['BI / Franquias', 'Comparativo de desempenho entre restaurantes'],
    'sec-restaurantes': ['Restaurantes', 'Gerencie todos os restaurantes da plataforma'],
    'sec-usuarios': ['Usuários', 'Gerencie todos os usuários do sistema'],
    'sec-servidor': ['Servidor', 'Status, backup e manutenção do servidor'],
    'sec-mensagens': ['Mensagens', 'Envie atualizações e avisos para todos os restaurantes'],
    'sec-logs': ['Logs do Sistema', 'Auditoria e logs de requisições API'],
    'sec-config': ['Configurações', 'Configurações globais da plataforma'],
    'sec-licencas': ['Licenças & Telemetria', 'Chaves de ativação e telemetria dos estabelecimentos'],
    'sec-recuperar-acesso': ['Recuperar Acesso', 'Redefina email e senha de clientes'],
    'sec-clientes': ['Clientes', 'Perfil completo de todos os clientes da plataforma'],
    'sec-suporte': ['Equipe de Suporte', 'Funcionários que prestam suporte aos restaurantes'],
    'sec-terminal': ['Terminal', 'Execute comandos no servidor local']
  };

  for (var i = 0; i < items.length; i++) {
    items[i].className = items[i].getAttribute('data-target') === targetId ? 'menu-item active' : 'menu-item';
  }
  for (var j = 0; j < sections.length; j++) {
    sections[j].className = sections[j].id === targetId ? 'content-section active' : 'content-section';
  }

  var t = titles[targetId] || ['', ''];
  document.getElementById('panel-title').textContent = t[0];
  document.getElementById('panel-subtitle').textContent = t[1];

  if (targetId === 'sec-dash') carregarDashboard();
  else if (targetId === 'sec-bi') carregarBiFranquias();
  else if (targetId === 'sec-restaurantes') carregarRestaurantes();
  else if (targetId === 'sec-usuarios') carregarUsuarios();
  else if (targetId === 'sec-servidor') { carregarServidor(); carregarCerts(); }
  else if (targetId === 'sec-mensagens') carregarMensagens();
  else if (targetId === 'sec-logs') carregarLogs(0);
  else if (targetId === 'sec-config') carregarConfig();
  else if (targetId === 'sec-licencas') carregarLicencas();
   else if (targetId === 'sec-clientes') carregarClientes();
   else if (targetId === 'sec-suporte') carregarSuporte();
   else if (targetId === 'sec-terminal') { resetInactivityTimer(); }
}

/* ═══ DASHBOARD ═══ */
function carregarDashboard() {
  apiGet('/api/super/dashboard-stats', function(err, data) {
    if (err || !data || !data.ok) return;
    var s = data.stats;
    setText('stat-ativas', s.ativas || 0);
    setText('stat-trials', s.trials || 0);
    setText('stat-expiradas', s.expiradas || 0);
    setText('stat-bloqueadas', s.bloqueadas || 0);

    var vendasEl = document.getElementById('stat-vendas-locais');
    var usersEl = document.getElementById('stat-usuarios-locais');
    if (vendasEl) {
      vendasEl.textContent = 'R$ ' + formatMoney(s.totalSales || 0);
      document.getElementById('card-local-sales').style.display = '';
    }
    if (usersEl) {
      usersEl.textContent = s.usuarios || 0;
      document.getElementById('card-local-users').style.display = '';
    }
  });

  apiGet('/api/super/restaurantes', function(err, data) {
    if (err || !data || !data.ok) return;
    var tbody = document.getElementById('recent-installations-table');
    if (!tbody) return;
    var tbodyEl = tbody.querySelector('tbody') || tbody;
    var rows = (data.clients || []).slice(0, 6);
    if (rows.length === 0) {
      tbodyEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Nenhum restaurante registrado.</td></tr>';
      return;
    }
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      html += '<tr>';
      html += '<td><div style="font-weight:600;color:white;">' + esc(r.restaurante) + '</div><small style="color:var(--text-muted);">ID: ' + r.id + '</small></td>';
      html += '<td><span class="badge badge-' + r.status + '">' + r.status + '</span></td>';
      html += '<td><small>' + esc(r.ip || 'Local') + '</small></td>';
      html += '<td><small style="font-family:monospace;">' + esc(r.versao || '--') + '</small></td>';
      html += '<td><small>' + (r.ultimaVer ? new Date(r.ultimaVer).toLocaleDateString('pt-BR') : '--') + '</small></td>';
      html += '</tr>';
    }
    tbodyEl.innerHTML = html;
  });
}

/* ═══ BI / FRANQUIAS ═══ */
function carregarBiFranquias() {
  var sel = document.getElementById('bi-periodo');
  var dias = (sel && sel.value) || '30';
  apiGet('/api/super/bi-franquias?dias=' + dias, function(err, data) {
    if (err || !data || !data.ok) {
      showToast('Erro ao carregar BI', 'danger');
      setText('bi-total-vendas', '--');
      setText('bi-total-pedidos', '--');
      setText('bi-ticket-medio', '--');
      setText('bi-qtd-rest', '--');
      var tbody = document.getElementById('bi-ranking-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum dado disponível.</td></tr>';
      return;
    }
    setText('bi-total-vendas', 'R$ ' + formatMoney(data.total_vendas || 0));
    setText('bi-total-pedidos', data.total_pedidos || 0);
    setText('bi-ticket-medio', 'R$ ' + formatMoney(data.ticket_medio_geral || 0));
    setText('bi-qtd-rest', data.qtd_restaurantes || 0);

    var ranking = data.ranking || [];
    var tbody = document.getElementById('bi-ranking-tbody');
    if (!tbody) return;
    if (ranking.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Sem vendas no período selecionado.</td></tr>';
      return;
    }
    var html = '';
    var max = ranking[0] ? ranking[0].total_vendas : 0;
    for (var i = 0; i < ranking.length; i++) {
      var r = ranking[i];
      var pct = max > 0 ? Math.round((r.total_vendas / max) * 100) : 0;
      var pctGeral = data.total_vendas > 0 ? ((r.total_vendas / data.total_vendas) * 100).toFixed(1) : '0.0';
      html += '<tr>';
      html += '<td><strong>' + (i + 1) + '</strong></td>';
      html += '<td><div style="font-weight:600;color:white;">' + esc(r.nome) + '</div><small style="color:var(--text-muted);">ID: ' + r.id + '</small></td>';
      html += '<td style="font-weight:700;color:#4ade80;">R$ ' + formatMoney(r.total_vendas) + '</td>';
      html += '<td>' + r.pedidos + '</td>';
      html += '<td>R$ ' + formatMoney(r.ticket_medio) + '</td>';
      html += '<td>';
      html += '<div style="background:rgba(255,255,255,.08);border-radius:6px;height:10px;overflow:hidden;">';
      html += '<div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#4ade80,#22d3ee);"></div>';
      html += '</div>';
      html += '<small style="color:var(--text-muted);">' + pctGeral + '% do total</small>';
      html += '</td>';
      html += '<td><button class="btn-action" style="padding:.4rem .7rem;font-size:11px;" onclick="toggleBiDetalhe(' + escJs(r.id) + ')"><i class="fa-solid fa-chart-simple"></i> Detalhes</button></td>';
      html += '</tr>';

      html += '<tr id="bi-detalhe-' + r.id + '" style="display:none;background:rgba(255,255,255,.03);">';
      html += '<td colspan="7" style="padding:1rem;">';
      html += '<div style="display:flex;flex-wrap:wrap;gap:2rem;">';

      html += '<div style="flex:1;min-width:260px;">';
      html += '<h4 style="font-family:\'Outfit\',sans-serif;margin-bottom:.6rem;color:#22d3ee;">Vendas por dia</h4>';
      var maxDia = 1;
      for (var d = 0; d < r.vendas_por_dia.length; d++) if (parseFloat(r.vendas_por_dia[d].total) > maxDia) maxDia = parseFloat(r.vendas_por_dia[d].total);
      var diasHtml = '';
      for (var d2 = 0; d2 < r.vendas_por_dia.length; d2++) {
        var vd = r.vendas_por_dia[d2];
        var p = maxDia > 0 ? Math.round((parseFloat(vd.total) / maxDia) * 100) : 0;
        var label = vd.dia ? vd.dia.slice(5) : '';
        diasHtml += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem;">';
        diasHtml += '<small style="width:50px;color:var(--text-muted);">' + esc(label) + '</small>';
        diasHtml += '<div style="flex:1;background:rgba(255,255,255,.08);border-radius:4px;height:8px;overflow:hidden;">';
        diasHtml += '<div style="width:' + Math.max(2, p) + '%;height:100%;background:linear-gradient(90deg,#22d3ee,#818cf8);"></div>';
        diasHtml += '</div>';
        diasHtml += '<small style="width:80px;text-align:right;color:white;">R$ ' + formatMoney(parseFloat(vd.total)) + '</small>';
        diasHtml += '</div>';
      }
      html += diasHtml || '<small style="color:var(--text-muted);">Sem dados</small>';
      html += '</div>';

      html += '<div style="flex:1;min-width:220px;">';
      html += '<h4 style="font-family:\'Outfit\',sans-serif;margin-bottom:.6rem;color:#22d3ee;">Top Produtos</h4>';
      var topHtml = '';
      for (var t = 0; t < r.top_produtos.length; t++) {
        var tp = r.top_produtos[t];
        topHtml += '<div style="display:flex;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid rgba(255,255,255,.05);">';
        topHtml += '<small style="color:white;">' + esc(tp.nome) + ' <span style="color:var(--text-muted);">×' + tp.qtd + '</span></small>';
        topHtml += '<small style="color:#4ade80;">R$ ' + formatMoney(parseFloat(tp.total)) + '</small>';
        topHtml += '</div>';
      }
      html += topHtml || '<small style="color:var(--text-muted);">Sem dados</small>';
      html += '</div>';

      html += '<div style="flex:1;min-width:180px;">';
      html += '<h4 style="font-family:\'Outfit\',sans-serif;margin-bottom:.6rem;color:#22d3ee;">Por Setor</h4>';
      var setHtml = '';
      for (var s = 0; s < r.setores.length; s++) {
        var st = r.setores[s];
        setHtml += '<div style="display:flex;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid rgba(255,255,255,.05);">';
        setHtml += '<small style="color:white;">' + esc(st.setor || 'Geral') + '</small>';
        setHtml += '<small style="color:#4ade80;">R$ ' + formatMoney(parseFloat(st.total)) + '</small>';
        setHtml += '</div>';
      }
      html += setHtml || '<small style="color:var(--text-muted);">Sem dados</small>';
      html += '</div>';

      html += '</div>';
      html += '</td>';
      html += '</tr>';
    }
    tbody.innerHTML = html;
  });
}

function toggleBiDetalhe(id) {
  var tr = document.getElementById('bi-detalhe-' + id);
  if (tr) tr.style.display = tr.style.display === 'none' ? 'table-row' : 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  var sel = document.getElementById('bi-periodo');
  if (sel) sel.addEventListener('change', carregarBiFranquias);
  var btn = document.getElementById('btn-bi-atualizar');
  if (btn) btn.addEventListener('click', carregarBiFranquias);
});

/* ═══ RESTAURANTES ═══ */
function carregarRestaurantes() {
  apiGet('/api/super/restaurantes', function(err, data) {
    if (err || !data || !data.ok) {
      showToast('Erro ao carregar restaurantes', 'danger');
      return;
    }
    restaurantesData = data.clients || [];
    renderRestaurantes();
    popularAlvosTerminal();
  });
}

function renderRestaurantes() {
  var search = (document.getElementById('rest-search').value || '').toLowerCase();
  var filter = document.getElementById('rest-filter-status').value;
  var filtered = [];
  for (var i = 0; i < restaurantesData.length; i++) {
    var r = restaurantesData[i];
    if (search && r.restaurante.toLowerCase().indexOf(search) === -1 && String(r.id).indexOf(search) === -1) continue;
    if (filter && r.status !== filter) continue;
    filtered.push(r);
  }
  var tbody = document.getElementById('restaurantes-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum restaurante encontrado.</td></tr>';
    return;
  }
  var html = '';
  for (var j = 0; j < filtered.length; j++) {
    var r2 = filtered[j];
    html += '<tr>';
    html += '<td><small style="font-family:monospace;">#' + r2.id + '</small></td>';
    html += '<td><div style="font-weight:600;color:white;">' + esc(r2.restaurante) + '</div>' + (r2.login_mode === 'single' ? '<div><span class="badge badge-plano" style="background:#7c3aed;color:#fff;">login único</span></div>' : '') + '</td>';
    html += '<td><span class="badge badge-plano">' + esc(r2.plano) + '</span></td>';
    html += '<td><span class="badge badge-' + r2.status + '">' + r2.status + '</span></td>';
    html += '<td style="text-align:center;">';
    html += '<button class="btn-row-action" onclick="verEquipe(' + r2.id + ',' + escJs(r2.restaurante) + ')" title="Ver equipe" style="color:#3b82f6;font-size:0.85rem;gap:4px;">';
    html += '<i class="fa-solid fa-users"></i> <span>' + (r2.total_funcionarios || 0) + '</span>';
    html += '</button></td>';
    html += '<td><small>' + (r2.ultimaVer ? new Date(r2.ultimaVer).toLocaleDateString('pt-BR') : '--') + '</small></td>';
    html += '<td>';
    html += '<div class="row-actions">';
    html += '<button class="btn-row-action edit-action" onclick="editarRestaurante(' + r2.id + ')" title="Editar"><i class="fa-regular fa-pen-to-square"></i></button>';
    html += '<button class="btn-row-action block-action" onclick="toggleBloquearRest(' + r2.id + ',' + escJs(r2.status) + ')" title="' + (r2.status === 'bloqueado' ? 'Reativar' : 'Bloquear') + '"><i class="fa-solid ' + (r2.status === 'bloqueado' ? 'fa-unlock' : 'fa-ban') + '"></i></button>';
    html += '<button class="btn-row-action delete-action" onclick="excluirRestaurante(' + r2.id + ',' + escJs(r2.restaurante) + ')" title="Excluir"><i class="fa-regular fa-trash-can"></i></button>';
    html += '</div></td></tr>';
  }
  tbody.innerHTML = html;
}

function editarRestaurante(id) {
  var r = null;
  for (var i = 0; i < restaurantesData.length; i++) {
    if (String(restaurantesData[i].id) === String(id)) { r = restaurantesData[i]; break; }
  }
  if (!r) return;
  document.getElementById('edit-id').value = r.id;
  document.getElementById('edit-restaurante').value = r.restaurante;
  document.getElementById('edit-status').value = r.status;
  document.getElementById('edit-plano').value = (r.plano || '').toLowerCase();
  document.getElementById('edit-loginmode').value = (r.login_mode || 'multi');
  document.getElementById('modal-edit-client').classList.add('active');
}

function toggleBloquearRest(id, status) {
  var novoStatus = status === 'bloqueado' ? 'ativo' : 'bloqueado';
  var msg = status === 'bloqueado' ? 'Reativar este restaurante?' : 'Bloquear este restaurante?';
  if (!confirm(msg)) return;
  apiPost('/api/super/atualizar-restaurante', { id: id, fields: { status: novoStatus } }, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro: ' + (data ? data.erro : 'desconhecido'), 'danger'); return; }
    showToast('Restaurante atualizado!', 'success');
    carregarRestaurantes();
  });
}

function excluirRestaurante(id, nome) {
  if (!confirm('Excluir o restaurante "' + nome + '"? Todos os dados serão removidos!')) return;
  apiDelete('/api/super/restaurante/' + id, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao excluir', 'danger'); return; }
    showToast('Restaurante excluído.', 'success');
    carregarRestaurantes();
  });
}

function criarRestauranteCompleto() {
  var nome = document.getElementById('new-rest-nome').value.trim();
  if (!nome) { showToast('Informe o nome do restaurante!', 'warning'); return; }
  
  var licenca = document.getElementById('new-rest-licenca').value;
  var ativo = document.getElementById('new-rest-ativo').value === '1';
  var email = document.getElementById('new-rest-email').value.trim();
  var senha = document.getElementById('new-rest-senha').value;
  var adminNome = document.getElementById('new-rest-admin-nome').value.trim();
  var telefone = document.getElementById('new-rest-telefone').value.trim();
  var endereco = document.getElementById('new-rest-endereco').value.trim();
  var cnpj = document.getElementById('new-rest-cnpj').value.trim();
  
  if (email && (!senha || senha.length < 4)) { showToast('Senha do admin deve ter no mínimo 4 caracteres!', 'warning'); return; }
  
  // Configurações iniciais
  var config_iniciais = {};
  var taxaEntrega = parseFloat(document.getElementById('new-rest-taxa-entrega').value);
  if (!isNaN(taxaEntrega)) config_iniciais.taxa_entrega = taxaEntrega;
  var whatsapp = document.getElementById('new-rest-whatsapp').value.trim();
  if (whatsapp) config_iniciais.whatsapp = whatsapp;
  var abertura = document.getElementById('new-rest-abertura').value;
  var fechamento = document.getElementById('new-rest-fechamento').value;
  if (abertura) config_iniciais.horario_abertura = abertura;
  if (fechamento) config_iniciais.horario_fechamento = fechamento;
  var observacoes = document.getElementById('new-rest-observacoes').value.trim();
  if (observacoes) config_iniciais.observacoes = observacoes;
  
  // Equipe inicial
  var funcionarios_iniciais = [];
  var rows = document.querySelectorAll('.initial-team-row');
  for (var i = 0; i < rows.length; i++) {
    var nomeF = rows[i].querySelector('.team-nome').value.trim();
    if (nomeF) {
      funcionarios_iniciais.push({
        nome: nomeF,
        cargo: rows[i].querySelector('.team-cargo').value.trim() || 'Garçom',
        valor_hora: parseFloat(rows[i].querySelector('.team-valor').value) || 0
      });
    }
  }
  
  var payload = {
    nome: nome,
    licenca: licenca,
    ativo: ativo,
    email: email || undefined,
    senha: senha || undefined,
    admin_nome: adminNome || undefined,
    telefone: telefone || undefined,
    endereco: endereco || undefined,
    cnpj: cnpj || undefined,
    config_iniciais: Object.keys(config_iniciais).length > 0 ? config_iniciais : undefined,
    funcionarios_iniciais: funcionarios_iniciais.length > 0 ? funcionarios_iniciais : undefined
  };
  
  apiPost('/api/super/criar-restaurante-completo', payload, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro: ' + (data ? data.erro : 'desconhecido'), 'danger'); return; }
    var msg = 'Restaurante criado com sucesso!';
    if (data.alertas && data.alertas.length > 0) msg += ' (' + data.alertas.join('; ') + ')';
    showToast(msg, 'success');
    document.getElementById('modal-novo-rest').classList.remove('active');
    // Limpar campos
    document.getElementById('new-rest-nome').value = '';
    document.getElementById('new-rest-cnpj').value = '';
    document.getElementById('new-rest-telefone').value = '';
    document.getElementById('new-rest-endereco').value = '';
    document.getElementById('new-rest-email').value = '';
    document.getElementById('new-rest-senha').value = '';
    document.getElementById('new-rest-admin-nome').value = '';
    document.getElementById('new-rest-taxa-entrega').value = '0';
    document.getElementById('new-rest-whatsapp').value = '';
    document.getElementById('new-rest-observacoes').value = '';
    document.getElementById('new-rest-abertura').value = '08:00';
    document.getElementById('new-rest-fechamento').value = '22:00';
    // Reset team list
    var teamContainer = document.getElementById('initial-team-list');
    teamContainer.innerHTML = '<div class="initial-team-row" style="display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:end;">' +
      '<div style="flex:2;"><input type="text" class="team-nome" placeholder="Nome" style="width:100%;padding:0.5rem 0.7rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:0.85rem;"></div>' +
      '<div style="flex:1;"><input type="text" class="team-cargo" placeholder="Cargo" value="Garçom" style="width:100%;padding:0.5rem 0.7rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:0.85rem;"></div>' +
      '<div style="flex:1;"><input type="number" class="team-valor" placeholder="Valor hora" value="0" step="0.50" style="width:100%;padding:0.5rem 0.7rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:0.85rem;"></div>' +
      '<button class="btn-row-action remove-team-row" style="flex-shrink:0;" title="Remover"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>';
    // Reset wizard to step 1
    mostrarPassoWizard(1);
    carregarRestaurantes();
  });
}

// Wizard navigation
var _wizardStep = 1;
var _wizardTotal = 4;

function mostrarPassoWizard(passo) {
  _wizardStep = passo;
  // Update step indicators
  var steps = document.querySelectorAll('.wizard-step');
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    var stepNum = parseInt(s.getAttribute('data-step'));
    if (stepNum === passo) {
      s.style.background = 'rgba(252,75,21,0.15)';
      s.style.color = '#fc4b15';
      s.style.fontWeight = '600';
    } else {
      s.style.background = 'transparent';
      s.style.color = '#888';
      s.style.fontWeight = '400';
    }
  }
  // Show/hide panels
  var panels = document.querySelectorAll('.wizard-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].style.display = parseInt(panels[j].getAttribute('data-step')) === passo ? 'block' : 'none';
  }
  // Buttons
  document.getElementById('btn-wizard-prev').style.display = passo > 1 ? 'inline-flex' : 'none';
  if (passo < _wizardTotal) {
    document.getElementById('btn-wizard-next').style.display = 'inline-flex';
    document.getElementById('btn-criar-restaurante-completo').style.display = 'none';
  } else {
    document.getElementById('btn-wizard-next').style.display = 'none';
    document.getElementById('btn-criar-restaurante-completo').style.display = 'inline-flex';
  }
}

function proximoPassoWizard() {
  if (_wizardStep < _wizardTotal) mostrarPassoWizard(_wizardStep + 1);
}

function passoAnteriorWizard() {
  if (_wizardStep > 1) mostrarPassoWizard(_wizardStep - 1);
}

/* ═══ EQUIPE / FUNCIONÁRIOS ═══ */
function verEquipe(restauranteId, restauranteNome) {
  var body = document.getElementById('equipe-body');
  body.innerHTML = '<div style="text-align:center;padding:30px;color:#888;">Carregando equipe de <strong>' + esc(restauranteNome) + '</strong>...</div>';
  document.getElementById('modal-equipe').classList.add('active');
  
  // Carrega funcionários e métricas em paralelo
  var funcsData = [];
  var metricasData = [];
  var loaded = 0;
  
  function finalizar() {
    if (loaded < 2) return;
    var html = '<div style="margin-bottom:1rem;color:var(--text-muted);font-size:0.85rem;"><strong style="color:white;">' + esc(restauranteNome) + '</strong> — ' + funcsData.length + ' funcionário(s)</div>';
    
    // Tabela de funcionários
    html += '<h4 style="margin-bottom:0.6rem;"><i class="fa-solid fa-users"></i> Colaboradores</h4>';
    if (funcsData.length === 0) {
      html += '<p style="color:#888;text-align:center;padding:10px;">Nenhum funcionário cadastrado.</p>';
    } else {
      html += '<div style="overflow-x:auto;max-height:250px;overflow-y:auto;margin-bottom:1.5rem;"><table class="custom-table"><thead><tr>' +
        '<th>Nome</th><th>Cargo</th><th>Status</th><th>Valor Hora</th><th>CPF</th><th>Telefone</th>' +
        '</tr></thead><tbody>';
      for (var i = 0; i < funcsData.length; i++) {
        var f = funcsData[i];
        var statusColor = f.status === 'Ativo' ? '#22c55e' : (f.status === 'Pendente' ? '#f59e0b' : '#ef4444');
        html += '<tr>' +
          '<td style="font-weight:600;color:white;">' + esc(f.nome) + '</td>' +
          '<td>' + esc(f.cargo || '—') + '</td>' +
          '<td style="color:' + statusColor + ';">' + esc(f.status) + '</td>' +
          '<td>R$ ' + (f.valor_hora || 0).toFixed(2).replace('.', ',') + '</td>' +
          '<td>' + esc(f.cpf || '—') + '</td>' +
          '<td>' + esc(f.telefone || '—') + '</td>' +
          '</tr>';
      }
      html += '</tbody></table></div>';
    }
    
    // Métricas de desempenho
    html += '<h4 style="margin-bottom:0.6rem;"><i class="fa-solid fa-chart-simple"></i> Métricas de Desempenho</h4>';
    if (metricasData.length === 0) {
      html += '<p style="color:#888;text-align:center;padding:10px;">Nenhum dado de desempenho disponível.</p>';
    } else {
      html += '<div style="overflow-x:auto;max-height:300px;overflow-y:auto;"><table class="custom-table"><thead><tr>' +
        '<th>Garçom</th><th>Total Pedidos</th><th>Entregues</th><th>Em Andamento</th><th>Eficiência</th><th>Tempo Médio</th><th>Total Gasto</th><th>Hoje</th>' +
        '</tr></thead><tbody>';
      for (var j = 0; j < metricasData.length; j++) {
        var m = metricasData[j];
        var ef = m.taxaEficiencia;
        var efColor = ef >= 80 ? '#22c55e' : ef >= 50 ? '#f59e0b' : '#ef4444';
        var tempo = m.tempoMedioEntrega !== null ? m.tempoMedioEntrega + ' min' : '—';
        html += '<tr>' +
          '<td style="font-weight:600;color:white;">' + esc(m.nome) + '</td>' +
          '<td style="text-align:center;">' + m.total + '</td>' +
          '<td style="text-align:center;color:#22c55e;font-weight:bold;">' + m.entregues + '</td>' +
          '<td style="text-align:center;color:#f59e0b;">' + m.emAndamento + '</td>' +
          '<td style="text-align:center;color:' + efColor + ';font-weight:bold;">' + ef + '%</td>' +
          '<td style="text-align:center;">' + tempo + '</td>' +
          '<td style="text-align:center;">R$ ' + m.totalGasto.toFixed(2).replace('.', ',') + '</td>' +
          '<td style="text-align:center;">' + m.pedidosHoje + '</td>' +
          '</tr>';
      }
      html += '</tbody></table></div>';
    }
    
    body.innerHTML = html;
  }
  
  apiGet('/api/super/restaurantes/' + restauranteId + '/funcionarios', function(err, data) {
    loaded++;
    if (!err && data && data.ok) funcsData = data.funcionarios || [];
    finalizar();
  });
  
  apiGet('/api/super/metricas/garcons?restaurante_id=' + restauranteId, function(err, data) {
    loaded++;
    if (!err && data && data.ok) metricasData = data.metricas || [];
    finalizar();
  });
}

/* ═══ USUÁRIOS ═══ */
function carregarUsuarios() {
  var x = new XMLHttpRequest();
  x.open('GET', '/api/super/usuarios', true);
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try {
        var data = JSON.parse(x.responseText);
        if (data.ok) {
          usuariosData = data.usuarios || [];
          renderUsuarios();
        } else {
          showToast('Erro ao carregar usuários', 'danger');
        }
      } catch(e) { showToast('Erro de conexão', 'danger'); }
    }
  };
  x.send(null);
}

function renderUsuarios() {
  var search = (document.getElementById('user-search').value || '').toLowerCase();
  var filter = document.getElementById('user-filter-role').value;
  var filtered = [];
  for (var i = 0; i < usuariosData.length; i++) {
    var u = usuariosData[i];
    if (search && u.username.toLowerCase().indexOf(search) === -1) continue;
    if (filter && u.role !== filter) continue;
    filtered.push(u);
  }
  var tbody = document.getElementById('usuarios-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum usuário encontrado.</td></tr>';
    return;
  }
  var html = '';
  for (var j = 0; j < filtered.length; j++) {
    var u2 = filtered[j];
    var badgeClass = u2.ativo ? 'badge-ativo' : 'badge-bloqueado';
    var badgeText = u2.ativo ? 'Ativo' : 'Inativo';
    html += '<tr>';
    html += '<td><small style="font-family:monospace;">#' + u2.id + '</small></td>';
    html += '<td><div style="font-weight:600;color:white;">' + esc(u2.username) + '</div></td>';
    html += '<td><small>ID ' + u2.restaurante_id + '</small></td>';
    html += '<td><span class="badge badge-plano">' + esc(u2.role) + '</span></td>';
    html += '<td><span class="badge ' + badgeClass + '">' + badgeText + '</span></td>';
    html += '<td><small>' + (u2.data_cadastro ? new Date(u2.data_cadastro).toLocaleDateString('pt-BR') : '--') + '</small></td>';
    html += '<td><div class="row-actions">';
    html += '<button class="btn-row-action edit-action" onclick="resetarUsuario(' + u2.id + ')" title="Redefinir senha"><i class="fa-solid fa-key"></i></button>';
    if (u2.ativo) {
      html += '<button class="btn-row-action block-action" onclick="desativarUsuario(' + u2.id + ',' + escJs(u2.username) + ')" title="Desativar"><i class="fa-solid fa-ban"></i></button>';
    }
    html += '</div></td></tr>';
  }
  tbody.innerHTML = html;
}

function resetarUsuario(id) {
  var novaSenha = prompt('Nova senha para o usuário #' + id + ':');
  if (!novaSenha || novaSenha.length < 4) { showToast('Senha muito curta.', 'warning'); return; }
  apiPost('/api/super/reset-credenciais', { userId: id, novaSenha: novaSenha }, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro: ' + (data ? data.erro : 'desconhecido'), 'danger'); return; }
    showToast('Senha redefinida com sucesso!', 'success');
    carregarUsuarios();
  });
}

function desativarUsuario(id, username) {
  if (!confirm('Desativar o acesso do usuário "' + username + '"?')) return;
  apiDelete('/api/super/usuario/' + id, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao desativar', 'danger'); return; }
    showToast('Usuário desativado.', 'success');
    carregarUsuarios();
  });
}

function criarUsuarioNovo() {
  var email = document.getElementById('new-user-email').value.trim();
  var senha = document.getElementById('new-user-senha').value;
  var restId = document.getElementById('new-user-rest-id').value;
  if (!email || !senha) { showToast('Preencha email e senha!', 'warning'); return; }
  apiPost('/api/super/criar-usuario', { email: email, senha: senha, restauranteId: parseInt(restId) || 1 }, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro: ' + (data ? data.erro : 'desconhecido'), 'danger'); return; }
    showToast('Usuário criado com sucesso!', 'success');
    document.getElementById('modal-novo-user').classList.remove('active');
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-senha').value = '';
    carregarUsuarios();
  });
}

/* ═══ MENSAGENS / BROADCAST ═══ */
function enviarMensagem() {
  var titulo = (document.getElementById('msg-titulo').value || '').trim();
  var corpo = (document.getElementById('msg-corpo').value || '').trim();
  var tipo = document.getElementById('msg-tipo').value;
  if (!titulo || !corpo) { showToast('Preencha título e mensagem.', 'error'); return; }
  if (!confirm('Enviar esta mensagem para TODOS os restaurantes ativos?')) return;
  apiPost('/api/super/mensagens', { titulo: titulo, corpo: corpo, tipo: tipo }, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao enviar: ' + (data ? data.erro : err), 'error'); return; }
    showToast('Mensagem enviada para todos os restaurantes!', 'success');
    document.getElementById('msg-titulo').value = '';
    document.getElementById('msg-corpo').value = '';
    document.getElementById('msg-tipo').value = 'aviso';
    carregarMensagens();
  });
}

function carregarMensagens() {
  apiGet('/api/super/mensagens', function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao carregar mensagens.', 'error'); return; }
    var tbody = document.getElementById('mensagens-table-body');
    if (!tbody) return;
    var msgs = data.mensagens || [];
    var totalR = data.totalRestaurantes || 0;
    if (!msgs.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Nenhuma mensagem enviada ainda.</td></tr>';
      return;
    }
    var tipoLabels = { aviso: 'Aviso', atualizacao: 'Atualização', manutencao: 'Manutenção', urgente: 'Urgente' };
    var tipoCores = { aviso: '#3b82f6', atualizacao: '#10b981', manutencao: '#f59e0b', urgente: '#ef4444' };
    var html = '';
    msgs.forEach(function(m) {
      var lidas = m.lidas || 0;
      var cor = tipoCores[m.tipo] || '#6b7280';
      var tipoLabel = tipoLabels[m.tipo] || m.tipo;
      var dataFormatada = m.criado_em ? new Date(m.criado_em).toLocaleString('pt-BR') : '-';
      var msgCurta = (m.corpo || '').length > 80 ? m.corpo.substring(0, 80) + '...' : (m.corpo || '');
      html += '<tr>';
      html += '<td>' + m.id + '</td>';
      html += '<td><span style="display:inline-block;padding:0.2rem 0.6rem;border-radius:100px;font-size:0.78rem;font-weight:600;background:' + cor + '22;color:' + cor + ';">' + tipoLabel + '</span></td>';
      html += '<td><strong>' + escapeHtml(m.titulo || '') + '</strong></td>';
      html += '<td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + escapeHtml(m.corpo || '') + '">' + escapeHtml(msgCurta) + '</td>';
      html += '<td style="white-space:nowrap;">' + dataFormatada + '</td>';
      html += '<td>' + lidas + '/' + totalR + '</td>';
      html += '<td><div style="display:flex;gap:0.4rem;">';
      html += '<button class="btn-row-action" title="Reenviar" onclick="reenviarMensagem(' + m.id + ')"><i class="fa-solid fa-rotate-right"></i></button>';
      html += '<button class="btn-row-action" style="color:var(--danger);" title="Deletar" onclick="deletarMensagem(' + m.id + ')"><i class="fa-solid fa-trash"></i></button>';
      html += '</div></td></tr>';
    });
    tbody.innerHTML = html;
  });
}

function reenviarMensagem(id) {
  if (!confirm('Reenviar esta mensagem para todos os restaurantes?')) return;
  apiPost('/api/super/mensagens/' + id + '/reenviar', {}, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao reenviar.', 'error'); return; }
    showToast('Mensagem reenviada com sucesso!', 'success');
  });
}

function deletarMensagem(id) {
  if (!confirm('Tem certeza que deseja deletar esta mensagem?')) return;
  apiDelete('/api/super/mensagens/' + id, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao deletar.', 'error'); return; }
    showToast('Mensagem deletada.', 'success');
    carregarMensagens();
  });
}

/* ═══ SERVIDOR ═══ */
function carregarServidor() {
  apiGet('/api/super/server-status', function(err, data) {
    if (err || !data || !data.ok) {
      showToast('Erro ao carregar status do servidor', 'danger');
      return;
    }
    var s = data.status;
    var uptimeMin = Math.floor(s.uptime / 60);
    var uptimeHrs = Math.floor(uptimeMin / 60);
    var uptimeDias = Math.floor(uptimeHrs / 24);
    var uptimeTxt = '';
    if (uptimeDias > 0) uptimeTxt = uptimeDias + 'd ' + (uptimeHrs % 24) + 'h';
    else if (uptimeHrs > 0) uptimeTxt = uptimeHrs + 'h ' + (uptimeMin % 60) + 'min';
    else uptimeTxt = uptimeMin + ' min';

    setText('srv-uptime', uptimeTxt);
    setText('srv-memoria', formatBytes(s.memoria.heapUsed));
    setText('srv-bancos', s.disco.arquivos_banco + ' arquivos');
    setText('srv-disco', formatBytes(s.disco.tamanho_total));

    var extra = 'Node.js ' + s.node + ' | PID ' + s.pid + ' | ' + s.plataforma;
    extra += ' | RSS: ' + formatBytes(s.memoria.rss);
    extra += ' | Heap Total: ' + formatBytes(s.memoria.heapTotal);
    setText('srv-info-extra', extra);
  });
}

function criarBackup() {
  if (!confirm('Criar backup de todos os bancos de dados?')) return;
  apiPost('/api/super/backup', {}, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao criar backup', 'danger'); return; }
    showToast('Backup criado! ' + (data.arquivos ? data.arquivos.length + ' arquivos' : ''), 'success');
  });
}

/* ═══ CERTIFICADOS SSL (.pfx) ═══ */
function carregarCerts() {
  apiGet('/api/super/certs', function(err, data) {
    var statusEl = document.getElementById('cert-status');
    var tbody = document.getElementById('cert-tbody');
    if (err || !data || !data.ok) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444;">Não foi possível carregar os certificados.</span>';
      return;
    }
    var isHttps = data.isHttps;
    var ativo = data.ativo;
    if (statusEl) {
      var modo = isHttps ? '<span style="color:#34d399; font-weight:700;">HTTPS ativo</span>' : '<span style="color:#f59e0b; font-weight:700;">HTTP (sem certificado)</span>';
      var certInfo = ativo ? ' | Certificado ativo: <b>' + escapeHtml(ativo) + '</b>' : '';
      var reiniciar = data.reiniciarNecessario ? ' | <span style="color:#f59e0b;">Reinicie o servidor para aplicar o certificado</span>' : '';
      statusEl.innerHTML = 'Protocolo: ' + modo + certInfo + reiniciar;
    }
    if (!tbody) return;
    if (!data.certs || data.certs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Nenhum certificado na pasta certs/. Envie um .pfx acima.</td></tr>';
      return;
    }
    tbody.innerHTML = data.certs.map(function(c) {
      var size = c.size >= 1048576 ? (c.size / 1048576).toFixed(1) + ' MB' : (c.size / 1024).toFixed(1) + ' KB';
      var isAtivo = ativo === c.file;
      var statusHtml = isAtivo
        ? '<span style="color:#34d399; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Ativo</span>'
        : '<span style="color:var(--text-muted);">Inativo</span>';
      var acoes = '';
      if (!isAtivo) {
        acoes += '<button class="btn-row-action" style="color:#34d399;" onclick="ativarCertificado(\'' + c.file.replace(/'/g, '') + '\')"><i class="fa-solid fa-play"></i> Ativar</button>';
      }
      acoes += '<button class="btn-row-action" style="color:#ef4444;" onclick="removerCertificado(\'' + c.file.replace(/'/g, '') + '\')"><i class="fa-solid fa-trash"></i></button>';
      return '<tr>' +
        '<td style="font-weight:600;color:var(--text-primary);">' + escapeHtml(c.file) + '</td>' +
        '<td>' + size + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td><div class="row-actions">' + acoes + '</div></td>' +
        '</tr>';
    }).join('');
  });
}

function enviarCertificado() {
  var input = document.getElementById('cert-file-input');
  var pass = document.getElementById('cert-pass-input');
  if (!input || !input.files || input.files.length === 0) {
    showToast('Selecione um arquivo .pfx/.p12', 'warning');
    return;
  }
  var file = input.files[0];
  if (!/\.(pfx|p12)$/i.test(file.name)) {
    showToast('Apenas arquivos .pfx ou .p12', 'warning');
    return;
  }
  var fd = new FormData();
  fd.append('cert', file);
  if (pass && pass.value.trim()) fd.append('passphrase', pass.value.trim());
  var x = new XMLHttpRequest();
  x.open('POST', '/api/super/certs/upload', true);
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      var data = {};
      try { data = JSON.parse(x.responseText); } catch (e) { }
      if (data.ok) {
        showToast('Certificado enviado!', 'success');
        input.value = '';
        if (pass) pass.value = '';
        carregarCerts();
      } else {
        showToast(data.erro || 'Erro ao enviar certificado.', 'danger');
      }
    }
  };
  x.onerror = function() { showToast('Falha de conexão com o servidor.', 'danger'); };
  x.send(fd);
}

function ativarCertificado(file) {
  var pass = document.getElementById('cert-pass-input');
  var passphrase = (pass && pass.value && pass.value.trim()) ? pass.value.trim() : '';
  if (!confirm('Ativar o certificado ' + file + '? A troca é aplicada ao vivo se o servidor já estiver HTTPS.')) return;
  apiPost('/api/super/certs/ativar', { file: file, passphrase: passphrase }, function(err, data) {
    if (err || !data || !data.ok) {
      showToast((data && data.erro) || 'Erro ao ativar certificado.', 'danger');
      return;
    }
    if (data.applied) {
      showToast('Certificado ativado ao vivo!', 'success');
    } else {
      showToast('Certificado ativado. Reinicie o servidor para aplicar (servidor em HTTP).', 'warning');
    }
    if (pass) pass.value = '';
    carregarCerts();
  });
}

function removerCertificado(file) {
  if (!confirm('Remover o certificado ' + file + '?')) return;
  apiDelete('/api/super/certs/' + encodeURIComponent(file), function(err, data) {
    if (err || !data || !data.ok) {
      showToast((data && data.erro) || 'Erro ao remover certificado.', 'danger');
      return;
    }
    showToast('Certificado removido.', 'success');
    carregarCerts();
  });
}

/* ═══ LOGS ═══ */
var logsPage = 0;
var logsPerPage = 50;

function carregarLogs(page) {
  logsPage = page || 0;
  var search = (document.getElementById('logs-search-input').value || '').trim();
  var tipo = document.getElementById('logs-tipo-filter').value || 'api';
  var url = '/api/super/logs-sistema?tipo=' + tipo + '&limit=' + logsPerPage + '&offset=' + (logsPage * logsPerPage);
  if (search) url += '&search=' + encodeURIComponent(search);

  apiGet(url, function(err, data) {
    if (err || !data || !data.ok) return;
    var thead = document.getElementById('logs-table-header');
    var tbody = document.getElementById('logs-table-body');
    if (tipo === 'api') {
      thead.innerHTML = '<th>ID</th><th>Data/Hora</th><th>Operador</th><th>IP</th><th>Endpoint</th><th>Status</th><th>Detalhes</th>';
    } else {
      thead.innerHTML = '<th>ID</th><th>Data/Hora</th><th>Operador</th><th>Ação</th><th>Detalhes</th><th>Motivo</th><th>IP</th>';
    }
    var rows = data.rows || [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum log encontrado.</td></tr>';
    } else {
      var html = '';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        html += '<tr>';
        html += '<td><small>#' + r.id + '</small></td>';
        html += '<td><small>' + (r.data_hora || r.criado_em || '--') + '</small></td>';
        html += '<td><small>' + esc(r.operador || '--') + '</small></td>';
        if (tipo === 'api') {
          html += '<td><small>' + esc(r.ip || '--') + '</small></td>';
          html += '<td><small style="font-family:monospace;">' + esc(r.endpoint || '--') + '</small></td>';
          html += '<td><small>' + (r.status_code || '--') + '</small></td>';
          html += '<td><small>' + esc(r.detalhes || '--') + '</small></td>';
        } else {
          html += '<td><small>' + esc(r.acao || '--') + '</small></td>';
          html += '<td><small>' + esc(r.detalhes || '--') + '</small></td>';
          html += '<td><small>' + esc(r.motivo || '--') + '</small></td>';
          html += '<td><small>' + esc(r.ip || '--') + '</small></td>';
        }
        html += '</tr>';
      }
      tbody.innerHTML = html;
    }
    var total = data.total || 0;
    var start = logsPage * logsPerPage + 1;
    var end = Math.min((logsPage + 1) * logsPerPage, total);
    setText('logs-pagination-info', 'Mostrando ' + start + '-' + end + ' de ' + total);
  });
}

/* ═══ CONFIGURAÇÕES ═══ */
function carregarConfig() {
  apiGet('/api/super/config-global', function(err, data) {
    if (err || !data || !data.ok) return;
    var c = data.configs || {};
    document.getElementById('cfg-update-ver').value = c.updateVer || '';
    document.getElementById('cfg-update-url').value = c.updateUrl || '';
    document.getElementById('cfg-update-msg').value = c.updateMsg || '';
    document.getElementById('cfg-whatsapp').value = c.whatsappSuporte || '';
    document.getElementById('cfg-email-suporte').value = c.emailSuporte || '';
  });
}

function salvarConfig() {
  var payload = {
    updateVer: document.getElementById('cfg-update-ver').value.trim(),
    updateUrl: document.getElementById('cfg-update-url').value.trim(),
    updateMsg: document.getElementById('cfg-update-msg').value.trim(),
    whatsappSuporte: document.getElementById('cfg-whatsapp').value.trim(),
    emailSuporte: document.getElementById('cfg-email-suporte').value.trim()
  };
  apiPost('/api/super/config-global', payload, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao salvar configurações', 'danger'); return; }
    showToast('Configurações salvas com sucesso!', 'success');
  });
}

/* ═══ RECUPERAR ACESSO (existente) ═══ */
var recoveryUsersData = [];

function carregarUsuariosRecovery() {
  var x = new XMLHttpRequest();
  x.open('GET', '/api/super/usuarios', true);
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try {
        var data = JSON.parse(x.responseText);
        if (data.ok) {
          recoveryUsersData = data.usuarios || [];
          renderRecoveryTable(recoveryUsersData);
          popularSelectRecovery(recoveryUsersData);
          showToast(recoveryUsersData.length + ' usuário(s) carregado(s)!', 'success');
        }
      } catch(e) { showToast('Falha ao carregar.', 'danger'); }
    }
  };
  x.send(null);
}

function renderRecoveryTable(users) {
  var search = (document.getElementById('recovery-search-input').value || '').toLowerCase();
  var filtered = [];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (search && u.username.toLowerCase().indexOf(search) === -1 && String(u.restaurante_id).indexOf(search) === -1) continue;
    filtered.push(u);
  }
  var tbody = document.getElementById('recovery-users-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty-state"><i class="fa-solid fa-user-slash"></i><span>Nenhum usuário encontrado.</span></td></tr>';
    return;
  }
  var html = '';
  for (var j = 0; j < filtered.length; j++) {
    var u2 = filtered[j];
    var badge = u2.ativo ? 'badge-ativo' : 'badge-bloqueado';
    var text = u2.ativo ? 'Ativo' : 'Inativo';
    html += '<tr>';
    html += '<td><code style="font-size:0.8rem;opacity:0.7;">#' + u2.id + '</code></td>';
    html += '<td><div style="font-weight:600;color:white;font-size:0.88rem;">' + esc(u2.username) + '</div></td>';
    html += '<td><span style="color:var(--text-muted);font-size:0.82rem;">ID ' + u2.restaurante_id + '</span></td>';
    html += '<td><span class="badge badge-plano">' + u2.role + '</span></td>';
    html += '<td><span class="badge ' + badge + '">' + text + '</span></td>';
    html += '<td><div class="row-actions">';
    html += '<button class="btn-row-action select-action" onclick="selecionarUsuarioRecovery(' + u2.id + ')" title="Selecionar"><i class="fa-solid fa-pen-to-square"></i></button>';
    if (u2.ativo) {
      html += '<button class="btn-row-action deactivate-action" onclick="desativarUsuarioRecovery(' + u2.id + ',' + escJs(u2.username) + ')" title="Desativar"><i class="fa-solid fa-ban"></i></button>';
    }
    html += '</div></td></tr>';
  }
  tbody.innerHTML = html;
}

function popularSelectRecovery(users) {
  var sel = document.getElementById('reset-usuario-select');
  sel.innerHTML = '<option value="">-- Selecione um usuario --</option>';
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (!u.ativo) continue;
    var opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = '#' + u.id + ' -- ' + u.username + ' (Rest. ' + u.restaurante_id + ')';
    sel.appendChild(opt);
  }
}

function selecionarUsuarioRecovery(id) {
  document.getElementById('reset-usuario-select').value = id;
  document.getElementById('reset-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function desativarUsuarioRecovery(id, username) {
  if (!confirm('Desativar "' + username + '"?')) return;
  apiDelete('/api/super/usuario/' + id, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro', 'danger'); return; }
    showToast('Usuário desativado.', 'success');
    carregarUsuariosRecovery();
  });
}

function resetarCredenciais() {
  var userId = document.getElementById('reset-usuario-select').value;
  var novoEmail = document.getElementById('reset-novo-email').value.trim();
  var novaSenha = document.getElementById('reset-nova-senha').value;
  if (!userId) { showToast('Selecione um usuário!', 'warning'); return; }
  if (!novoEmail && !novaSenha) { showToast('Informe email e/ou senha!', 'warning'); return; }
  apiPost('/api/super/reset-credenciais', { userId: parseInt(userId), novoEmail: novoEmail || undefined, novaSenha: novaSenha || undefined }, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro: ' + (data ? data.erro : 'desconhecido'), 'danger'); return; }
    showToast('Credenciais redefinidas!', 'success');
    document.getElementById('reset-novo-email').value = '';
    document.getElementById('reset-nova-senha').value = '';
    carregarUsuariosRecovery();
  });
}

/* ═══ HELPERS ═══ */
function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// (Segurança) Escapa valor para string JS dentro de atributo HTML (aspas como entidade).
function escJs(v) {
  if (v === null || v === undefined) v = '';
  return JSON.stringify(String(v)).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatMoney(val) {
  return val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* ═══ TERMINAL ═══ */
var _cmdHistory = [];
var _cmdHistoryIndex = -1;

function popularAlvosTerminal() {
  var select = document.getElementById('exec-target');
  if (!select) return;
  select.innerHTML = '<option value="">Todas as instalações (local)</option>';
  for (var i = 0; i < restaurantesData.length; i++) {
    var r = restaurantesData[i];
    var opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = '#' + r.id + ' — ' + r.restaurante;
    select.appendChild(opt);
  }
}

function executarComando() {
  var input = document.getElementById('exec-input');
  var output = document.getElementById('exec-output');
  var comando = (input.value || '').trim();
  if (!comando) { showToast('Digite um comando!', 'warning'); return; }
  
  // Confirmar
  if (!confirm('Tem certeza que deseja executar:\n\n' + comando + '\n\nEsta operação será registrada nos logs de auditoria.')) return;
  
  var target = document.getElementById('exec-target').value;
  
  output.textContent = '$ ' + comando + '\n\nExecutando...';
  
  // Adicionar ao histórico
  _cmdHistory.push(comando);
  _cmdHistoryIndex = _cmdHistory.length;
  
  apiPost('/api/super/exec', { command: comando, restaurante_id: target ? parseInt(target) : null }, function(err, data) {
    if (err) {
      output.textContent = '$ ' + comando + '\n\nErro de rede: ' + err.message;
      return;
    }
    var texto = '$ ' + comando + '\n\n';
    if (data.stdout) texto += data.stdout + '\n';
    if (data.stderr) texto += '\x1b[91m' + data.stderr + '\x1b[0m\n';
    texto += '\nExit code: ' + data.exitCode + (data.ok ? '' : ' (erro)');
    output.textContent = texto;
    output.scrollTop = output.scrollHeight;
  });
}

function limparOutput() {
  document.getElementById('exec-output').textContent = 'Output limpo.';
}

/* ═══ EQUIPE DE SUPORTE ═══ */
var suporteData = [];

function carregarSuporte() {
  var tbody = document.getElementById('suporte-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">Carregando equipe de suporte...</td></tr>';
  apiGet('/api/super/equipe', function(err, data) {
    if (err || !data || !data.ok) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ef4444;">Erro ao carregar equipe.</td></tr>';
      return;
    }
    suporteData = data.equipe || [];
    renderSuporte();
  });
}

function renderSuporte() {
  var tbody = document.getElementById('suporte-tbody');
  if (!tbody) return;
  var search = (document.getElementById('suporte-search').value || '').toLowerCase();
  var filter = document.getElementById('suporte-filter-status').value;
  var filtered = [];
  for (var i = 0; i < suporteData.length; i++) {
    var s = suporteData[i];
    if (search && s.nome.toLowerCase().indexOf(search) === -1 && (s.email || '').toLowerCase().indexOf(search) === -1) continue;
    if (filter && s.status !== filter) continue;
    filtered.push(s);
  }
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">Nenhum membro encontrado.</td></tr>';
    return;
  }
  var html = '';
  for (var j = 0; j < filtered.length; j++) {
    var s2 = filtered[j];
    var statusColors = { disponivel: '#22c55e', ocupado: '#f59e0b', offline: '#ef4444' };
    var statusLabels = { disponivel: 'Disponível', ocupado: 'Ocupado', offline: 'Offline' };
    var sc = statusColors[s2.status] || '#888';
    var sl = statusLabels[s2.status] || s2.status;
    html += '<tr>' +
      '<td style="padding:10px 12px;font-weight:600;color:white;">' + esc(s2.nome) + '</td>' +
      '<td style="padding:10px 12px;">' + esc(s2.email) + '</td>' +
      '<td style="padding:10px 12px;text-align:center;">' + esc(s2.telefone || '—') + '</td>' +
      '<td style="padding:10px 12px;text-align:center;">' + esc(s2.cargo) + '</td>' +
      '<td style="padding:10px 12px;text-align:center;">' + esc(s2.especialidade) + '</td>' +
      '<td style="padding:10px 12px;text-align:center;color:' + sc + ';font-weight:bold;">' + sl + '</td>' +
      '<td style="padding:10px 12px;text-align:center;"><small>' + (s2.data_cadastro ? new Date(s2.data_cadastro).toLocaleDateString('pt-BR') : '—') + '</small></td>' +
      '<td style="padding:10px 12px;text-align:center;"><div class="row-actions">' +
      '<button class="btn-row-action edit-action" onclick="editarSuporte(' + s2.id + ')" title="Editar"><i class="fa-regular fa-pen-to-square"></i></button>' +
      '<button class="btn-row-action block-action" onclick="atribuirRestaurantes(' + s2.id + ',' + escJs(s2.nome) + ')" title="Atribuir restaurantes"><i class="fa-solid fa-link"></i></button>' +
      '<button class="btn-row-action delete-action" onclick="excluirSuporte(' + s2.id + ',' + escJs(s2.nome) + ')" title="Remover"><i class="fa-regular fa-trash-can"></i></button>' +
      '</div></td></tr>';
  }
  tbody.innerHTML = html;
}

function abrirModalSuporte(membro) {
  document.getElementById('modal-suporte-title').textContent = membro ? 'Editar Membro' : 'Novo Membro da Equipe';
  document.getElementById('suporte-edit-id').value = membro ? membro.id : '';
  document.getElementById('suporte-nome').value = membro ? membro.nome : '';
  document.getElementById('suporte-email').value = membro ? membro.email : '';
  document.getElementById('suporte-telefone').value = membro ? (membro.telefone || '') : '';
  document.getElementById('suporte-senha').value = '';
  document.getElementById('suporte-cargo').value = membro ? (membro.cargo || 'Suporte N1') : 'Suporte N1';
  document.getElementById('suporte-especialidade').value = membro ? (membro.especialidade || 'Remoto') : 'Remoto';
  // Status field only visible when editing
  document.getElementById('suporte-status-group').style.display = membro ? 'block' : 'none';
  document.getElementById('suporte-status').value = membro ? (membro.status || 'disponivel') : 'disponivel';
  document.getElementById('modal-suporte').classList.add('active');
}

function editarSuporte(id) {
  for (var i = 0; i < suporteData.length; i++) {
    if (suporteData[i].id === id) { abrirModalSuporte(suporteData[i]); return; }
  }
  showToast('Membro não encontrado.', 'warning');
}

function salvarSuporte() {
  var id = document.getElementById('suporte-edit-id').value;
  var nome = document.getElementById('suporte-nome').value.trim();
  var email = document.getElementById('suporte-email').value.trim();
  var telefone = document.getElementById('suporte-telefone').value.trim();
  var senha = document.getElementById('suporte-senha').value;
  var cargo = document.getElementById('suporte-cargo').value;
  var especialidade = document.getElementById('suporte-especialidade').value;
  if (!nome || !email) { showToast('Nome e email são obrigatórios!', 'warning'); return; }
  if (!id && (!senha || senha.length < 4)) { showToast('Senha deve ter no mínimo 4 caracteres!', 'warning'); return; }
  
  var payload = { nome: nome, email: email, telefone: telefone, cargo: cargo, especialidade: especialidade };
  if (senha) payload.senha = senha;
  
  if (id) {
    payload.status = document.getElementById('suporte-status').value;
    apiPut('/api/super/equipe/' + id, payload, function(err, data) {
      if (err || !data || !data.ok) { showToast('Erro ao atualizar: ' + (data ? data.erro : err), 'danger'); return; }
      showToast('Membro atualizado!', 'success');
      document.getElementById('modal-suporte').classList.remove('active');
      carregarSuporte();
    });
  } else {
    apiPost('/api/super/equipe', payload, function(err, data) {
      if (err || !data || !data.ok) { showToast('Erro ao criar: ' + (data ? data.erro : err), 'danger'); return; }
      showToast('Membro cadastrado!', 'success');
      document.getElementById('modal-suporte').classList.remove('active');
      carregarSuporte();
    });
  }
}

function excluirSuporte(id, nome) {
  if (!confirm('Remover "' + nome + '" da equipe de suporte?')) return;
  apiDelete('/api/super/equipe/' + id, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao remover', 'danger'); return; }
    showToast('Membro removido.', 'success');
    carregarSuporte();
  });
}

// Atribuição de restaurantes
var _suporteRestId = null;

function atribuirRestaurantes(id, nome) {
  _suporteRestId = id;
  document.getElementById('modal-suporte-rest-title').textContent = 'Restaurantes — ' + nome;
  document.getElementById('suporte-rest-id').value = id;
  document.getElementById('suporte-rest-info').textContent = 'Selecione os restaurantes que ' + nome + ' atenderá.';
  document.getElementById('modal-suporte-restaurantes').classList.add('active');
  carregarAtribuicoes();
}

function carregarAtribuicoes() {
  var list = document.getElementById('suporte-rest-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">Carregando...</div>';
  
  // Carrega restaurantes e atribuições atuais
  apiGet('/api/super/restaurantes', function(err, dataRest) {
    if (err || !dataRest || !dataRest.ok) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Erro ao carregar restaurantes.</div>';
      return;
    }
    var restaurantes = dataRest.clients || [];
    if (_suporteRestId) {
      apiGet('/api/super/equipe/' + _suporteRestId + '/restaurantes', function(err, dataAttr) {
        if (err || !dataAttr || !dataAttr.ok) {
          list.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Erro ao carregar atribuições.</div>';
          return;
        }
        var atribuicoes = dataAttr.atribuicoes || [];
        renderAtribuicoes(restaurantes, atribuicoes);
      });
    } else {
      renderAtribuicoes(restaurantes, []);
    }
  });
}

function renderAtribuicoes(restaurantes, atribuicoes) {
  var list = document.getElementById('suporte-rest-list');
  if (!list) return;
  var search = (document.getElementById('suporte-rest-search').value || '').toLowerCase();
  var attrMap = {};
  for (var i = 0; i < atribuicoes.length; i++) {
    attrMap[atribuicoes[i].restaurante_id] = atribuicoes[i];
  }
  var html = '';
  for (var j = 0; j < restaurantes.length; j++) {
    var r = restaurantes[j];
    if (search && r.restaurante.toLowerCase().indexOf(search) === -1) continue;
    var isAssigned = !!attrMap[r.id];
    html += '<label style="display:flex;align-items:center;gap:0.8rem;padding:0.6rem 0.8rem;border-radius:6px;cursor:pointer;' +
      (isAssigned ? 'background:rgba(34,197,94,0.1);' : '') + '" ' +
      'onmouseover="this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.background=\'' + (isAssigned ? 'rgba(34,197,94,0.1)' : 'transparent') + '\'">' +
      '<input type="checkbox" class="suporte-rest-check" value="' + r.id + '" ' + (isAssigned ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:#22c55e;">' +
      '<span style="color:white;font-weight:500;">' + esc(r.restaurante) + '</span>' +
      '<span style="color:#888;font-size:0.8rem;margin-left:auto;">#' + r.id + '</span>' +
      '</label>';
  }
  if (!html) html = '<div style="text-align:center;padding:20px;color:#888;">Nenhum restaurante encontrado.</div>';
  list.innerHTML = html;
}

function salvarAtribuicoes() {
  var id = _suporteRestId;
  if (!id) { showToast('Erro: ID não definido.', 'danger'); return; }
  var checks = document.querySelectorAll('.suporte-rest-check');
  var selected = [];
  for (var i = 0; i < checks.length; i++) {
    if (checks[i].checked) selected.push(parseInt(checks[i].value));
  }
  apiPost('/api/super/equipe/' + id + '/restaurantes', { restaurante_ids: selected }, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao salvar: ' + (data ? data.erro : err), 'danger'); return; }
    showToast('Atribuições salvas!', 'success');
    document.getElementById('modal-suporte-restaurantes').classList.remove('active');
    carregarSuporte();
  });
}

/* ═══ INICIALIZAÇÃO ═══ */
document.addEventListener('DOMContentLoaded', function() {
  var savedToken = localStorage.getItem('chef_super_admin_local_token');
  if (savedToken) {
    localToken = savedToken;
    entrarNoPainel();
    return;
  }

  /* Login */
  var btnLogin = document.getElementById('btn-entrar-local');
  if (btnLogin) btnLogin.addEventListener('click', loginLocal);

  /* Logout */
  var btnSair = document.getElementById('btn-sair');
  if (btnSair) btnSair.addEventListener('click', logout);

  /* Sidebar nav */
  var menuItems = document.querySelectorAll('.menu-item');
  for (var i = 0; i < menuItems.length; i++) {
    menuItems[i].addEventListener('click', function() {
      switchTab(this.getAttribute('data-target'));
    });
  }

  /* Refresh / Sync */
  var btnRefresh = document.getElementById('btn-refresh-data');
  if (btnRefresh) btnRefresh.addEventListener('click', function() { switchTab('sec-dash'); });

  /* Restaurantes */
  var btnNovoRest = document.getElementById('btn-novo-restaurante');
  if (btnNovoRest) btnNovoRest.addEventListener('click', function() { document.getElementById('modal-novo-rest').classList.add('active'); mostrarPassoWizard(1); });
  var btnCriarRest = document.getElementById('btn-criar-restaurante-completo');
  if (btnCriarRest) btnCriarRest.addEventListener('click', criarRestauranteCompleto);
  var btnWizardNext = document.getElementById('btn-wizard-next');
  if (btnWizardNext) btnWizardNext.addEventListener('click', proximoPassoWizard);
  var btnWizardPrev = document.getElementById('btn-wizard-prev');
  if (btnWizardPrev) btnWizardPrev.addEventListener('click', passoAnteriorWizard);
  // Add team row
  var btnAddTeam = document.getElementById('btn-add-team-row');
  if (btnAddTeam) btnAddTeam.addEventListener('click', function() {
    var container = document.getElementById('initial-team-list');
    var row = document.createElement('div');
    row.className = 'initial-team-row';
    row.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:end;';
    row.innerHTML = '<div style="flex:2;"><input type="text" class="team-nome" placeholder="Nome" style="width:100%;padding:0.5rem 0.7rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:0.85rem;"></div>' +
      '<div style="flex:1;"><input type="text" class="team-cargo" placeholder="Cargo" value="Garçom" style="width:100%;padding:0.5rem 0.7rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:0.85rem;"></div>' +
      '<div style="flex:1;"><input type="number" class="team-valor" placeholder="Valor hora" value="0" step="0.50" style="width:100%;padding:0.5rem 0.7rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:0.85rem;"></div>' +
      '<button class="btn-row-action remove-team-row" style="flex-shrink:0;" title="Remover"><i class="fa-solid fa-xmark"></i></button>';
    container.appendChild(row);
    row.querySelector('.remove-team-row').addEventListener('click', function() { row.remove(); });
  });
  // Delegate remove-team-row clicks (for initial row)
  document.addEventListener('click', function(e) {
    if (e.target.closest('.remove-team-row')) {
      var row = e.target.closest('.initial-team-row');
      if (row) row.remove();
    }
  });

  /* Usuários */
  var btnNovoUser = document.getElementById('btn-novo-usuario');
  if (btnNovoUser) btnNovoUser.addEventListener('click', function() { document.getElementById('modal-novo-user').classList.add('active'); });
  var btnCriarUser = document.getElementById('btn-criar-usuario-novo');
  if (btnCriarUser) btnCriarUser.addEventListener('click', criarUsuarioNovo);
  var userSearch = document.getElementById('user-search');
  if (userSearch) userSearch.addEventListener('input', renderUsuarios);
  var userFilter = document.getElementById('user-filter-role');
  if (userFilter) userFilter.addEventListener('change', renderUsuarios);

  /* Equipe de Suporte */
  var btnNovoSuporte = document.getElementById('btn-novo-suporte');
  if (btnNovoSuporte) btnNovoSuporte.addEventListener('click', function() { abrirModalSuporte(null); });
  var btnSalvarSuporte = document.getElementById('btn-salvar-suporte');
  if (btnSalvarSuporte) btnSalvarSuporte.addEventListener('click', salvarSuporte);
  var suporteSearch = document.getElementById('suporte-search');
  if (suporteSearch) suporteSearch.addEventListener('input', renderSuporte);
  var suporteFilter = document.getElementById('suporte-filter-status');
  if (suporteFilter) suporteFilter.addEventListener('change', renderSuporte);
  var suporteRestSearch = document.getElementById('suporte-rest-search');
  if (suporteRestSearch) suporteRestSearch.addEventListener('input', function() {
    apiGet('/api/super/restaurantes', function(err, data) {
      if (!err && data && data.ok && _suporteRestId) {
        apiGet('/api/super/equipe/' + _suporteRestId + '/restaurantes', function(err2, data2) {
          renderAtribuicoes((data.clients || []), (data2 && data2.ok ? data2.atribuicoes || [] : []));
        });
      }
    });
  });
  var btnSalvarAtrib = document.getElementById('btn-salvar-atribuicoes');
  if (btnSalvarAtrib) btnSalvarAtrib.addEventListener('click', salvarAtribuicoes);

  /* Servidor */
  var btnRefreshServer = document.getElementById('btn-refresh-server');
  if (btnRefreshServer) btnRefreshServer.addEventListener('click', carregarServidor);
  var btnBackup = document.getElementById('btn-backup');
  if (btnBackup) btnBackup.addEventListener('click', criarBackup);

  /* Logs */
  var btnRefreshLogs = document.getElementById('btn-refresh-logs');
  if (btnRefreshLogs) btnRefreshLogs.addEventListener('click', function() { carregarLogs(0); });
  var logsSearch = document.getElementById('logs-search-input');
  if (logsSearch) logsSearch.addEventListener('input', function() { carregarLogs(0); });
  var logsTipo = document.getElementById('logs-tipo-filter');
  if (logsTipo) logsTipo.addEventListener('change', function() { carregarLogs(0); });
  var btnLogsPrev = document.getElementById('btn-logs-prev');
  if (btnLogsPrev) btnLogsPrev.addEventListener('click', function() { if (logsPage > 0) carregarLogs(logsPage - 1); });
  var btnLogsNext = document.getElementById('btn-logs-next');
  if (btnLogsNext) btnLogsNext.addEventListener('click', function() { carregarLogs(logsPage + 1); });

  /* Mensagens */
  var btnEnviarMsg = document.getElementById('btn-enviar-msg');
  if (btnEnviarMsg) btnEnviarMsg.addEventListener('click', enviarMensagem);
  var btnLimparMsg = document.getElementById('btn-limpar-msg');
  if (btnLimparMsg) btnLimparMsg.addEventListener('click', function() {
    document.getElementById('msg-titulo').value = '';
    document.getElementById('msg-corpo').value = '';
    document.getElementById('msg-tipo').value = 'aviso';
  });
  var btnRefreshMsg = document.getElementById('btn-refresh-mensagens');
  if (btnRefreshMsg) btnRefreshMsg.addEventListener('click', carregarMensagens);

  /* Config */
  var btnSaveConfig = document.getElementById('btn-save-config');
  if (btnSaveConfig) btnSaveConfig.addEventListener('click', salvarConfig);

  /* Recuperar Acesso */
  var btnLoadUsers = document.getElementById('btn-load-users');
  if (btnLoadUsers) btnLoadUsers.addEventListener('click', carregarUsuariosRecovery);
  var btnRefreshUsuarios = document.getElementById('btn-refresh-usuarios');
  if (btnRefreshUsuarios) btnRefreshUsuarios.addEventListener('click', carregarUsuariosRecovery);
  var btnResetCreds = document.getElementById('btn-reset-credenciais');
  if (btnResetCreds) btnResetCreds.addEventListener('click', resetarCredenciais);
  var recoverySearch = document.getElementById('recovery-search-input');
  if (recoverySearch) recoverySearch.addEventListener('input', function() { renderRecoveryTable(recoveryUsersData); });
  var resetSelect = document.getElementById('reset-usuario-select');
  if (resetSelect) resetSelect.addEventListener('change', function() {
    var preview = document.getElementById('selected-user-preview');
    if (!this.value) { if (preview) preview.style.display = 'none'; return; }
    var user = null;
    for (var i = 0; i < recoveryUsersData.length; i++) {
      if (String(recoveryUsersData[i].id) === this.value) { user = recoveryUsersData[i]; break; }
    }
    if (user && preview) {
      document.getElementById('preview-email').textContent = user.username;
      document.getElementById('preview-meta').textContent = 'Restaurante ID ' + user.restaurante_id + ' | ' + user.role;
      document.getElementById('preview-badge').textContent = user.ativo ? 'Ativo' : 'Inativo';
      document.getElementById('preview-badge').className = 'badge ' + (user.ativo ? 'badge-ativo' : 'badge-bloqueado');
      preview.style.display = 'flex';
    }
  });

  /* Modal close */
  var modalCloses = document.querySelectorAll('.modal-close');
  for (var m = 0; m < modalCloses.length; m++) {
    modalCloses[m].addEventListener('click', function() {
      var overlay = this.closest('.modal-overlay');
      if (overlay) overlay.classList.remove('active');
    });
  }

  /* Edit modal save */
  var btnSaveEdit = document.getElementById('btn-save-edit');
  if (btnSaveEdit) btnSaveEdit.addEventListener('click', function() {
    var id = document.getElementById('edit-id').value;
    var fields = {
      restaurante: document.getElementById('edit-restaurante').value.trim(),
      status: document.getElementById('edit-status').value,
      plano: document.getElementById('edit-plano').value,
      login_mode: document.getElementById('edit-loginmode').value
    };
    if (!fields.restaurante) { showToast('Nome obrigatório!', 'warning'); return; }
    apiPost('/api/super/atualizar-restaurante', { id: parseInt(id), fields: fields }, function(err, data) {
      if (err || !data || !data.ok) { showToast('Erro ao salvar', 'danger'); return; }
      showToast('Restaurante atualizado!', 'success');
      document.getElementById('modal-edit-client').classList.remove('active');
      carregarRestaurantes();
    });
  });

  /* Login tabs */
  var tabLocal = document.getElementById('tab-local');
  var tabCloud = document.getElementById('tab-cloud');
  if (tabLocal) tabLocal.addEventListener('click', function() {
    setLoginMode('local');
  });
  if (tabCloud) tabCloud.addEventListener('click', function() {
    setLoginMode('cloud');
  });

  /* Login cloud */
  var btnEntrar = document.getElementById('btn-entrar');
  if (btnEntrar) btnEntrar.addEventListener('click', function() {
    showToast('Modo cloud indisponível. Use o login local.', 'warning');
  });

  /* Header - Nova Licença (redireciona para criar restaurante) */
  var btnHeaderNewKey = document.getElementById('btn-header-new-key');
  if (btnHeaderNewKey) btnHeaderNewKey.addEventListener('click', function() {
    switchTab('sec-restaurantes');
  });

  /* Toggle senha recovery */
  var toggleSenha = document.getElementById('toggle-nova-senha');
  if (toggleSenha) toggleSenha.addEventListener('click', function() {
    var input = document.getElementById('reset-nova-senha');
    if (!input) return;
    var isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    toggleSenha.querySelector('i').className = isText ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
  });

  /* Força de senha recovery */
  var inputNovaSenha = document.getElementById('reset-nova-senha');
  if (inputNovaSenha) inputNovaSenha.addEventListener('input', function() {
    var val = this.value;
    var strengthEl = document.getElementById('senha-strength');
    var barEl = document.getElementById('strength-bar');
    var labelEl = document.getElementById('strength-label');
    if (!val) { if (strengthEl) strengthEl.style.display = 'none'; return; }
    if (strengthEl) strengthEl.style.display = 'flex';
    var score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^a-zA-Z0-9]/.test(val)) score++;
    var configs = [
      { label: 'Muito fraca', color: '#ef4444', width: '15%' },
      { label: 'Fraca', color: '#ef4444', width: '30%' },
      { label: 'Razoável', color: '#f59e0b', width: '55%' },
      { label: 'Boa', color: '#10b981', width: '75%' },
      { label: 'Forte', color: '#10b981', width: '90%' },
      { label: 'Excelente', color: '#3b82f6', width: '100%' }
    ];
    var cfg = configs[Math.min(score, 5)];
    if (barEl) { barEl.style.setProperty('--strength-width', cfg.width); barEl.style.setProperty('--strength-color', cfg.color); }
    if (labelEl) { labelEl.textContent = cfg.label; labelEl.style.color = cfg.color; }
  });

  /* Criar usuário (recuperação antiga) */
  var btnCriarUsuarioOld = document.getElementById('btn-criar-usuario');
  if (btnCriarUsuarioOld) btnCriarUsuarioOld.addEventListener('click', function() {
    var email = document.getElementById('novo-user-email').value.trim();
    var senha = document.getElementById('novo-user-senha').value;
    var restId = document.getElementById('novo-user-restaurante-id').value;
    if (!email || !senha) { showToast('Preencha email e senha!', 'warning'); return; }
    apiPost('/api/super/criar-usuario', { email: email, senha: senha, restauranteId: parseInt(restId) || 1 }, function(err, data) {
      if (err || !data || !data.ok) { showToast('Erro: ' + (data ? data.erro : 'desconhecido'), 'danger'); return; }
      showToast('Usuário criado com sucesso!', 'success');
      document.getElementById('novo-user-email').value = '';
      document.getElementById('novo-user-senha').value = '';
      carregarUsuariosRecovery();
    });
  });

  /* Enter no input de senha do login */
  var inputSenhaLogin = document.getElementById('local-senha');
  if (inputSenhaLogin) inputSenhaLogin.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') loginLocal();
  });

  /* Enter na senha admin recovery */
  var inputAdminSenha = document.getElementById('recovery-admin-senha');
  if (inputAdminSenha) inputAdminSenha.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') carregarUsuariosRecovery();
  });

  /* ═══ CLIENTES ═══ */
  var btnRefreshClientes = document.getElementById('btn-refresh-clientes');
  if (btnRefreshClientes) btnRefreshClientes.addEventListener('click', carregarClientes);
  var clientesSearch = document.getElementById('clientes-search');
  if (clientesSearch) clientesSearch.addEventListener('input', renderClientes);
  var clientesFilterRest = document.getElementById('clientes-filter-rest');
  if (clientesFilterRest) clientesFilterRest.addEventListener('change', renderClientes);

  /* ═══ TERMINAL ═══ */
  var btnExec = document.getElementById('btn-exec');
  if (btnExec) btnExec.addEventListener('click', executarComando);
  var execInput = document.getElementById('exec-input');
  if (execInput) execInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') executarComando();
    if (e.key === 'ArrowUp') {
      if (_cmdHistoryIndex > 0) {
        _cmdHistoryIndex--;
        this.value = _cmdHistory[_cmdHistoryIndex];
      }
      e.preventDefault();
    }
    if (e.key === 'ArrowDown') {
      if (_cmdHistoryIndex < _cmdHistory.length - 1) {
        _cmdHistoryIndex++;
        this.value = _cmdHistory[_cmdHistoryIndex];
      } else {
        _cmdHistoryIndex = _cmdHistory.length;
        this.value = '';
      }
      e.preventDefault();
    }
  });
  var btnClearOutput = document.getElementById('btn-clear-output');
  if (btnClearOutput) btnClearOutput.addEventListener('click', limparOutput);
  var btnRefreshTargets = document.getElementById('btn-refresh-targets');
  if (btnRefreshTargets) btnRefreshTargets.addEventListener('click', popularAlvosTerminal);

  /* Quick commands */
  var quickBtns = document.querySelectorAll('#quick-commands .quick-cmd');
  for (var qi = 0; qi < quickBtns.length; qi++) {
    quickBtns[qi].addEventListener('click', function(e) {
      var cmd = this.getAttribute('data-cmd');
      if (!cmd) return;
      var input = document.getElementById('exec-input');
      if (!input) return;
      if (e.altKey) {
        // Alt+Click: executa direto
        input.value = cmd;
        executarComando();
      } else {
        // Click normal: preenche o input
        input.value = cmd;
        input.focus();
      }
    });
  }

  /* ═══ LICENÇAS & TELEMETRIA ═══ */
  window.carregarLicencas = function() {
    carregarChaves();
    carregarTelemetria();
  };

  function carregarChaves() {
    apiGet('/api/super/licencas', function(err, data) {
      var tbody = document.getElementById('licencas-tbody');
      if (!tbody) return;
      if (err || !data || !data.ok) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:20px;">Erro ao carregar chaves.</td></tr>';
        return;
      }
      var lic = data.licencas || [];
      if (lic.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma chave gerada ainda.</td></tr>';
        return;
      }
      var html = '';
      for (var i = 0; i < lic.length; i++) {
        var l = lic[i];
        var stColor = l.status === 'usada' ? '#22c55e' : l.status === 'revogada' ? '#ef4444' : l.status === 'expirada' ? '#f59e0b' : '#3b82f6';
        var stLabel = l.status === 'usada' ? 'Usada' : l.status === 'revogada' ? 'Revogada' : l.status === 'expirada' ? 'Expirada' : 'Disponível';
        html += '<tr>' +
          '<td style="font-family:monospace;font-weight:700;color:#60a5fa;">' + escapeHtml(l.chave) + '</td>' +
          '<td>' + escapeHtml(l.restaurante_nome) + '</td>' +
          '<td>' + escapeHtml((l.plano || 'premium').toUpperCase()) + '</td>' +
          '<td>' + escapeHtml(l.validade || '—') + (l.dias ? ' (' + l.dias + 'd)' : '') + '</td>' +
          '<td style="color:' + stColor + ';font-weight:600;">' + stLabel + '</td>' +
          '<td>' + escapeHtml(l.usada_por || '—') + '</td>' +
          '<td>' + escapeHtml(l.usada_em || '—') + '</td>' +
          '<td>' +
            '<button class="btn-row-action" onclick="copiarChaveTxt(' + escJs(l.chave) + ')" title="Copiar"><i class="fa-solid fa-copy"></i></button>' +
            (l.status !== 'revogada' ? '<button class="btn-row-action danger-action" onclick="revogarChave(' + l.id + ')" title="Revogar"><i class="fa-solid fa-ban"></i></button>' : '') +
          '</td>' +
        '</tr>';
      }
      tbody.innerHTML = html;
    });
  }

  window.gerarChave = function() {
    var nome = document.getElementById('lic-restaurante-nome').value.trim();
    var plano = document.getElementById('lic-plano').value;
    var dias = parseInt(document.getElementById('lic-dias').value) || 365;
    var maxDisp = parseInt(document.getElementById('lic-maxdisp').value) || 0;
    var obs = document.getElementById('lic-obs').value.trim();
    apiPost('/api/super/licencas/gerar', { restaurante_nome: nome, plano: plano, dias: dias, max_dispositivos: maxDisp, obs: obs }, function(err, data) {
      if (err || !data || !data.ok) { showToast(data && data.erro ? data.erro : 'Erro ao gerar chave', 'danger'); return; }
      var box = document.getElementById('lic-result');
      var keyEl = document.getElementById('lic-result-key');
      if (box && keyEl) {
        keyEl.innerText = data.licenca.chave;
        box.style.display = 'block';
      }
      showToast('Chave gerada com sucesso!', 'success');
      carregarChaves();
    });
  };

  window.copiarChave = function(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    navigator.clipboard.writeText(el.innerText.trim()).then(function() {
      showToast('Chave copiada!', 'success');
    });
  };

  window.copiarChaveTxt = function(chave) {
    navigator.clipboard.writeText(chave).then(function() {
      showToast('Chave copiada!', 'success');
    });
  };

  window.revogarChave = function(id) {
    if (!confirm('Revogar esta chave? A ativação feita com ela será bloqueada na próxima validação.')) return;
    apiPost('/api/super/licencas/' + id + '/revogar', {}, function(err, data) {
      if (err || !data || !data.ok) { showToast('Erro ao revogar', 'danger'); return; }
      showToast('Chave revogada.', 'success');
      carregarChaves();
    });
  };

  window.carregarTelemetria = function() {
    apiGet('/api/super/telemetria', function(err, data) {
      var tbody = document.getElementById('telemetria-tbody');
      var cards = document.getElementById('telemetria-cards');
      if (!tbody || !cards) return;
      if (err || !data || !data.ok) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#ef4444;padding:20px;">Erro ao carregar telemetria.</td></tr>';
        return;
      }
      var rows = data.telemetria || [];
      var lucroTotal = 0, online = 0, vendasHoje = 0, funcTotal = 0;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        lucroTotal += parseFloat(r.lucro || 0);
        if (r.online == 1) online++;
        vendasHoje += parseFloat(r.vendas_hoje || 0);
        funcTotal += parseInt(r.funcionarios_ativos || 0);
      }
      cards.innerHTML = statCard('Estabelecimentos', rows.length, '#3b82f6') + statCard('Online agora', online, '#22c55e') + statCard('Vendas hoje', 'R$ ' + vendasHoje.toFixed(2).replace('.', ','), '#f59e0b') + statCard('Lucro est. total', 'R$ ' + lucroTotal.toFixed(2).replace('.', ','), '#22c55e') + statCard('Funcionários', funcTotal, '#a78bfa');
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:20px;">Sem telemetria ainda. As instalações enviam dados automaticamente.</td></tr>';
        return;
      }
      var html = '';
      for (var j = 0; j < rows.length; j++) {
        var t = rows[j];
        var statusCell = t.online == 1 ? '<span style="color:#22c55e;font-weight:600;">● Online</span>' : '<span style="color:#ef4444;">● Offline</span>';
        var lucro = parseFloat(t.lucro || 0);
        var lucroColor = lucro >= 0 ? '#22c55e' : '#ef4444';
        var tempoUso = t.tempo_uso_min > 60 ? Math.round(t.tempo_uso_min / 60) + 'h' : (t.tempo_uso_min || 0) + 'min';
        html += '<tr>' +
          '<td style="font-weight:600;color:white;">' + escapeHtml(t.nome_restaurante || t.rest_nome || '—') +
            (t.admin_login ? '<br><span style="font-size:11px;color:var(--text-muted);">' + escapeHtml(t.admin_login) + '</span>' : '') +
            (t.chave_ativacao ? '<br><span style="font-size:11px;color:#f59e0b;">' + escapeHtml(t.chave_ativacao) + '</span>' : '') +
          '</td>' +
          '<td>' + statusCell + '<br><span style="font-size:11px;color:var(--text-muted);">' + escapeHtml(t.ultima_atividade || '—') + '</span></td>' +
          '<td>R$ ' + parseFloat(t.vendas_hoje || 0).toFixed(2).replace('.', ',') + '</td>' +
          '<td>R$ ' + parseFloat(t.vendas_total || 0).toFixed(2).replace('.', ',') + '</td>' +
          '<td>' + (t.pedidos_total || 0) + '</td>' +
          '<td>' + (t.funcionarios_ativos || 0) + '</td>' +
          '<td>' + (t.produtos_total || 0) + '</td>' +
          '<td>' + (t.mesas_total || 0) + '</td>' +
          '<td>' + (t.dispositivos || 0) + '</td>' +
          '<td>' + tempoUso + '</td>' +
          '<td style="color:' + lucroColor + ';font-weight:600;">R$ ' + lucro.toFixed(2).replace('.', ',') + '</td>' +
          '<td>' + (t.disco_mb || 0) + ' MB</td>' +
        '</tr>';
      }
      tbody.innerHTML = html;
    });
  };

  function statCard(label, value, color) {
    return '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:12px;text-align:center;">' +
      '<div style="font-size:1.25rem;font-weight:700;color:' + color + ';">' + value + '</div>' +
      '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">' + label + '</div></div>';
  }

});

