var suporteToken = localStorage.getItem('chef_suporte_token');
var suporteUser = null;
var _produtosCache = [];
var _categoriasCache = [];
var _restauranteAtual = null;
var _restaurantesCache = [];

function esc(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// (Segurança) Escapa valor para string JS dentro de atributo HTML (aspas como entidade).
function escJs(v) {
  if (v === null || v === undefined) v = '';
  return JSON.stringify(String(v)).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function showToast(msg, type) {
  type = type || 'success';
  var c = document.getElementById('toast-container');
  var t = document.createElement('div'); t.className = 'toast toast-' + type; t.textContent = msg;
  c.appendChild(t);
  setTimeout(function() { t.remove(); }, 4000);
}

function apiGet(url, cb) {
  var x = new XMLHttpRequest();
  x.open('GET', url, true);
  x.setRequestHeader('x-suporte-token', suporteToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) { try { cb(null, JSON.parse(x.responseText)); } catch(e) { cb(e, null); } }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(null);
}
function apiPost(url, data, cb) {
  var x = new XMLHttpRequest();
  x.open('POST', url, true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.setRequestHeader('x-suporte-token', suporteToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) { try { cb(null, JSON.parse(x.responseText)); } catch(e) { cb(e, null); } }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(JSON.stringify(data));
}
function apiPut(url, data, cb) {
  var x = new XMLHttpRequest();
  x.open('PUT', url, true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.setRequestHeader('x-suporte-token', suporteToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) { try { cb(null, JSON.parse(x.responseText)); } catch(e) { cb(e, null); } }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(JSON.stringify(data));
}
function apiDelete(url, cb) {
  var x = new XMLHttpRequest();
  x.open('DELETE', url, true);
  x.setRequestHeader('x-suporte-token', suporteToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) { try { cb(null, JSON.parse(x.responseText)); } catch(e) { cb(e, null); } }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(null);
}

/* ═══ LOGIN ═══ */
function loginSuporte() {
  var email = document.getElementById('login-email').value.trim();
  var senha = document.getElementById('login-senha').value;
  var errEl = document.getElementById('login-error');
  if (!email || !senha) { errEl.textContent = 'Preencha email e senha.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  var x = new XMLHttpRequest();
  x.open('POST', '/api/suporte/login', true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try {
        var data = JSON.parse(x.responseText);
        if (data.ok) {
          suporteToken = data.token;
          suporteUser = data.usuario;
          localStorage.setItem('chef_suporte_token', suporteToken);
          entrarPainel();
        } else {
          errEl.textContent = data.erro || 'Erro ao fazer login.';
          errEl.style.display = 'block';
        }
      } catch(e) { errEl.textContent = 'Erro de conexão.'; errEl.style.display = 'block'; }
    }
  };
  x.send(JSON.stringify({ email: email, senha: senha }));
}

function logoutSuporte() {
  localStorage.removeItem('chef_suporte_token');
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('login-container').style.display = 'flex';
}

/* ═══ NAVEGAÇÃO ═══ */
var _currentTab = 'sec-dashboard';

function switchTabSuporte(targetId) {
  _currentTab = targetId;
  var items = document.querySelectorAll('.sidebar .menu-item');
  var sections = document.querySelectorAll('.content-area .content-section');
  for (var i = 0; i < items.length; i++) {
    items[i].className = items[i].getAttribute('data-target') === targetId ? 'menu-item active' : 'menu-item';
  }
  for (var j = 0; j < sections.length; j++) {
    sections[j].className = sections[j].id === targetId ? 'content-section active' : 'content-section';
  }
  if (targetId === 'sec-dashboard') carregarDashboardSuporte();
  else if (targetId === 'sec-vendas') carregarFinanceiroSuporte();
  else if (targetId === 'sec-restaurantes') carregarRestaurantesSuporte();
  else if (targetId === 'sec-cardapio') { if (_restauranteAtual) carregarProdutos(); }
  else if (targetId === 'sec-tarefas') carregarAtividades();
  else if (targetId === 'sec-ranking') carregarRanking();
  else if (targetId === 'sec-temas-curadoria') { if (typeof carregarCuradoriaTemas === 'function') carregarCuradoriaTemas(); }
  else if (targetId === 'sec-site-vendas-modulos') { if (typeof carregarModulosSiteVendas === 'function') carregarModulosSiteVendas(); }
}

function entrarPainel() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  atualizarHeader();
  initSuporteRealtimeSockets();
  carregarNotificacoesSuporte();
  switchTabSuporte('sec-dashboard');
}

function atualizarHeader() {
  if (!suporteUser) return;
  document.getElementById('user-name-display').textContent = suporteUser.nome;
  document.getElementById('user-xp').textContent = (suporteUser.xp || 0) + ' XP';
  document.getElementById('user-level').textContent = 'Nível ' + (suporteUser.nivel || 1);
}

/* ═══ DASHBOARD ═══ */
function carregarDashboardSuporte() {
  // Stats cards
  var statsHtml = '';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="color:var(--accent);"><i class="fa-solid fa-store"></i></div><div class="stat-value" id="dash-rest-count">0</div><div class="stat-label">Restaurantes</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="color:var(--info);"><i class="fa-solid fa-utensils"></i></div><div class="stat-value" id="dash-prod-count">0</div><div class="stat-label">Produtos</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="color:var(--warning);"><i class="fa-solid fa-star"></i></div><div class="stat-value" id="dash-level">' + (suporteUser.nivel || 1) + '</div><div class="stat-label">Nível</div></div>';
  statsHtml += '<div class="stat-card"><div class="stat-icon" style="color:var(--success);"><i class="fa-solid fa-bolt"></i></div><div class="stat-value" id="dash-xp">' + (suporteUser.xp || 0) + '</div><div class="stat-label">XP Total</div></div>';
  document.getElementById('dash-stats').innerHTML = statsHtml;

  // Progress bar
  var xp = suporteUser.xp || 0;
  var nivel = suporteUser.nivel || 1;
  var xpInLevel = xp % 100;
  var progress = (xpInLevel / 100) * 100;
  document.getElementById('xp-label').textContent = 'XP: ' + xp;
  document.getElementById('xp-next').textContent = 'Nível ' + nivel + ' — ' + xpInLevel + '/100 XP';
  document.getElementById('xp-bar-fill').style.width = progress + '%';

  // Carregar dados
  apiGet('/api/suporte/restaurantes', function(err, data) {
    if (err || !data || !data.ok) return;
    var rests = data.restaurantes || [];
    _restaurantesCache = rests;
    document.getElementById('dash-rest-count').textContent = rests.length;

    // Contar produtos totais
    var totalProd = 0;
    var loaded = 0;
    if (rests.length === 0) {
      document.getElementById('dash-prod-count').textContent = '0';
      carregarTarefasRecentes();
      return;
    }
    rests.forEach(function(r) {
      apiGet('/api/suporte/restaurantes/' + r.id + '/produtos', function(err2, data2) {
        loaded++;
        if (!err2 && data2 && data2.ok) totalProd += (data2.produtos || []).length;
        if (loaded >= rests.length) {
          document.getElementById('dash-prod-count').textContent = totalProd;
        }
      });
    });
    carregarTarefasRecentes();
  });

  // Conquistas
  apiGet('/api/suporte/minhas-conquistas', function(err, data) {
    if (!err && data && data.ok && data.conquistas) {
      var c = document.getElementById('ultimas-conquistas');
      if (data.conquistas.length === 0) { c.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">Nenhuma conquista ainda. Complete tarefas para ganhar XP!</span>'; return; }
      var h = '';
      for (var i = 0; i < Math.min(data.conquistas.length, 5); i++) {
        var a = data.conquistas[i];
        h += '<span class="achievement" style="padding:0.5rem;min-width:auto;"><span class="ach-icon" style="font-size:1.2rem;"><i class="fa-solid ' + (a.icone || 'fa-star') + '" style="color:var(--warning);"></i></span><span class="ach-name" style="font-size:0.7rem;">' + esc(a.descricao) + '</span></span>';
      }
      c.innerHTML = h;
    }
  });
}

function carregarTarefasRecentes() {
  apiGet('/api/suporte/minhas-tarefas', function(err, data) {
    var tbody = document.getElementById('recent-tasks-body');
    if (err || !data || !data.ok || !data.tarefas || data.tarefas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Nenhuma atividade ainda.</td></tr>';
      return;
    }
    var h = '';
    var tarefas = data.tarefas.slice(0, 10);
    var tipoLabels = { criar_produto: 'Criou Item', editar_produto: 'Editou Item', duplicar_produto: 'Duplicou Item' };
    for (var i = 0; i < tarefas.length; i++) {
      var t = tarefas[i];
      h += '<tr><td>' + esc(tipoLabels[t.tipo] || t.tipo) + '</td><td>' + esc(t.restaurante_nome || '—') + '</td><td style="color:var(--success);font-weight:600;">+' + t.pontos + ' XP</td><td><small>' + (t.concluida_em ? new Date(t.concluida_em).toLocaleString('pt-BR') : (t.criada_em ? new Date(t.criada_em).toLocaleString('pt-BR') : '—')) + '</small></td></tr>';
    }
    tbody.innerHTML = h;
  });
}

/* ═══ RESTAURANTES ═══ */
function carregarRestaurantesSuporte() {
  apiGet('/api/suporte/restaurantes', function(err, data) {
    if (err || !data || !data.ok) { document.getElementById('rest-grid').innerHTML = '<div class="empty-state"><i class="fa-solid fa-store"></i><p>Erro ao carregar restaurantes.</p></div>'; return; }
    _restaurantesCache = data.restaurantes || [];
    renderRestaurantesSuporte();
  });
}

function renderRestaurantesSuporte() {
  var grid = document.getElementById('rest-grid');
  var search = (document.getElementById('rest-search').value || '').toLowerCase();
  var filtered = _restaurantesCache.filter(function(r) { return r.nome.toLowerCase().indexOf(search) !== -1; });
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-store"></i><p>Nenhum restaurante encontrado.</p></div>';
    return;
  }
  var h = '';
  for (var i = 0; i < filtered.length; i++) {
    var r = filtered[i];
    var statusColor = r.ativo ? '#22c55e' : '#ef4444';
    var statusText = r.ativo ? 'Ativo' : 'Inativo';
      h += '<div class="rest-card" onclick="abrirCardapio(' + r.id + ',' + escJs(r.nome) + ')">' +
      '<div class="rest-name">' + esc(r.nome) + '</div>' +
      '<div class="rest-info">#' + r.id + ' · ' + esc(r.licenca || '—') + ' · <span style="color:' + statusColor + ';">' + statusText + '</span></div>' +
      '<div class="rest-info" style="margin-top:0.3rem;color:var(--accent);font-size:0.75rem;"><i class="fa-solid fa-arrow-right"></i> Gerenciar cardápio</div>' +
      '</div>';
  }
  grid.innerHTML = h;
}

function abrirCardapio(restId, restNome) {
  _restauranteAtual = { id: restId, nome: restNome };
  document.getElementById('cardapio-rest-name').textContent = 'Gerenciando: ' + esc(restNome) + ' (#' + restId + ')';
  document.getElementById('menu-cardapio').style.display = 'flex';
  switchTabSuporte('sec-cardapio');
  carregarProdutos();
}

function voltarRestaurantes() {
  _restauranteAtual = null;
  document.getElementById('menu-cardapio').style.display = 'none';
  switchTabSuporte('sec-restaurantes');
}

/* ═══ CARDÁPIO (PRODUTOS) ═══ */
function carregarProdutos() {
  if (!_restauranteAtual) return;
  document.getElementById('produtos-list').innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Carregando cardápio...</p></div>';
  apiGet('/api/suporte/restaurantes/' + _restauranteAtual.id + '/produtos', function(err, data) {
    if (err || !data || !data.ok) {
      document.getElementById('produtos-list').innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Erro ao carregar cardápio.</p></div>';
      return;
    }
    _produtosCache = data.produtos || [];
    _categoriasCache = data.categorias || [];
    // Atualizar datalist de categorias
    var dl = document.getElementById('categoria-suggest');
    dl.innerHTML = '';
    _categoriasCache.forEach(function(c) {
      var opt = document.createElement('option'); opt.value = c.nome || c; dl.appendChild(opt);
    });
    renderProdutos();
  });
}

function renderProdutos() {
  var container = document.getElementById('produtos-list');
  var search = (document.getElementById('prod-search').value || '').trim();
  var catFiltro = (document.getElementById('prod-categoria-filtro').value || '').trim();
  var filtered = _produtosCache;
  if (search) {
    if (window.FuzzySearch) {
      filtered = window.FuzzySearch.filter(filtered, search, function(p) { return [p.nome || '']; });
    } else {
      filtered = filtered.filter(function(p) { return (p.nome || '').toLowerCase().includes(search.toLowerCase()); });
    }
  }
  if (catFiltro) {
    if (window.FuzzySearch) {
      filtered = window.FuzzySearch.filter(filtered, catFiltro, function(p) { return [p.categoria || '']; });
    } else {
      filtered = filtered.filter(function(p) { return (p.categoria || '').toLowerCase().includes(catFiltro.toLowerCase()); });
    }
  }
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-utensils"></i><p>Nenhum item no cardápio.</p><button class="btn btn-primary btn-sm" style="margin-top:0.5rem;" onclick="abrirModalProduto(null)"><i class="fa-solid fa-plus"></i> Adicionar Primeiro Item</button></div>';
    return;
  }
  var h = '<div style="padding:0.5rem 0.8rem;font-size:0.8rem;color:var(--text-muted);border-bottom:1px solid var(--border-color);">' + filtered.length + ' item(ns) encontrado(s)</div>';
  for (var i = 0; i < filtered.length; i++) {
    var p = filtered[i];
    var disp = p.disponivel !== 0 && p.disponivel !== false;
    h += '<div class="produto-row">' +
      '<div class="produto-info"><div class="prod-nome">' + esc(p.nome) + '</div>' +
      '<div class="prod-meta">' + esc(p.categoria || 'Sem categoria') + (p.descricao ? ' · ' + esc(p.descricao.substring(0, 60)) : '') + '</div></div>' +
      '<div class="produto-preco">R$ ' + (parseFloat(p.preco) || 0).toFixed(2).replace('.', ',') + '</div>' +
      '<div style="display:flex;gap:0.3rem;">' +
      '<button class="btn btn-sm ' + (disp ? 'btn-success' : 'btn-warning') + '" onclick="toggleDisponivel(' + p.id + ',' + (disp ? 'false' : 'true') + ')" title="' + (disp ? 'Desativar' : 'Ativar') + '"><i class="fa-solid ' + (disp ? 'fa-eye' : 'fa-eye-slash') + '"></i></button>' +
      '<button class="btn btn-sm" onclick="abrirModalProduto(' + p.id + ')" title="Editar"><i class="fa-solid fa-pen"></i></button>' +
      '<button class="btn btn-sm" onclick="duplicarProduto(' + p.id + ')" title="Duplicar"><i class="fa-solid fa-copy"></i></button>' +
      '<button class="btn btn-sm btn-danger" onclick="excluirProduto(' + p.id + ')" title="Excluir"><i class="fa-solid fa-trash"></i></button>' +
      '</div></div>';
  }
  container.innerHTML = h;
}

function abrirModalProduto(prodId) {
  document.getElementById('modal-produto-title').textContent = prodId ? 'Editar Item' : 'Novo Item';
  document.getElementById('prod-edit-id').value = prodId || '';
  if (prodId) {
    var p = null;
    for (var i = 0; i < _produtosCache.length; i++) { if (_produtosCache[i].id === prodId) { p = _produtosCache[i]; break; } }
    if (p) {
      document.getElementById('prod-nome').value = p.nome || '';
      document.getElementById('prod-categoria').value = p.categoria || '';
      document.getElementById('prod-preco').value = p.preco || 0;
      document.getElementById('prod-descricao').value = p.descricao || '';
      document.getElementById('prod-ingredientes').value = p.ingredientes || '';
      document.getElementById('prod-disponivel').checked = p.disponivel !== 0 && p.disponivel !== false;
    }
  } else {
    document.getElementById('prod-nome').value = '';
    document.getElementById('prod-categoria').value = '';
    document.getElementById('prod-preco').value = 0;
    document.getElementById('prod-descricao').value = '';
    document.getElementById('prod-ingredientes').value = '';
    document.getElementById('prod-disponivel').checked = true;
  }
  document.getElementById('modal-produto').classList.add('active');
}

function salvarProduto() {
  var id = document.getElementById('prod-edit-id').value;
  var nome = document.getElementById('prod-nome').value.trim();
  if (!nome) { showToast('Nome do item é obrigatório!', 'warning'); return; }
  var payload = {
    nome: nome,
    categoria: document.getElementById('prod-categoria').value.trim(),
    preco: parseFloat(document.getElementById('prod-preco').value) || 0,
    descricao: document.getElementById('prod-descricao').value.trim(),
    ingredientes: document.getElementById('prod-ingredientes').value.trim(),
    disponivel: document.getElementById('prod-disponivel').checked
  };
  var url = '/api/suporte/restaurantes/' + _restauranteAtual.id + '/produtos';
  if (id) {
    apiPut(url + '/' + id, payload, function(err, data) {
      if (err || !data || !data.ok) { showToast('Erro: ' + (data ? data.erro : err), 'danger'); return; }
      showToast('Item atualizado! +3 XP', 'success');
      document.getElementById('modal-produto').classList.remove('active');
      carregarProdutos();
      atualizarDadosUsuario();
    });
  } else {
    apiPost(url, payload, function(err, data) {
      if (err || !data || !data.ok) { showToast('Erro: ' + (data ? data.erro : err), 'danger'); return; }
      showToast('Item criado! +5 XP', 'success');
      document.getElementById('modal-produto').classList.remove('active');
      carregarProdutos();
      atualizarDadosUsuario();
    });
  }
}

function excluirProduto(prodId) {
  if (!confirm('Excluir este item do cardápio?')) return;
  apiDelete('/api/suporte/restaurantes/' + _restauranteAtual.id + '/produtos/' + prodId, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao excluir', 'danger'); return; }
    showToast('Item excluído.', 'success');
    carregarProdutos();
  });
}

function toggleDisponivel(prodId, novoStatus) {
  apiPut('/api/suporte/restaurantes/' + _restauranteAtual.id + '/produtos/' + prodId, { disponivel: novoStatus }, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao atualizar', 'danger'); return; }
    showToast('Item ' + (novoStatus ? 'ativado' : 'desativado') + '!', 'success');
    carregarProdutos();
  });
}

function duplicarProduto(prodId) {
  apiPost('/api/suporte/restaurantes/' + _restauranteAtual.id + '/produtos/' + prodId + '/duplicar', {}, function(err, data) {
    if (err || !data || !data.ok) { showToast('Erro ao duplicar', 'danger'); return; }
    showToast('Item duplicado! +2 XP', 'success');
    carregarProdutos();
    atualizarDadosUsuario();
  });
}

/* ═══ ATIVIDADES ═══ */
function carregarAtividades() {
  apiGet('/api/suporte/minhas-conquistas', function(err, data) {
    var grid = document.getElementById('conquistas-grid');
    if (err || !data || !data.ok || !data.conquistas || data.conquistas.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="padding:1rem;"><i class="fa-solid fa-trophy" style="font-size:2rem;"></i><p>Nenhuma conquista ainda. Complete tarefas para ganhar XP e desbloquear conquistas!</p></div>';
      return;
    }
    var h = '';
    for (var i = 0; i < data.conquistas.length; i++) {
      var a = data.conquistas[i];
      h += '<div class="achievement"><div class="ach-icon"><i class="fa-solid ' + (a.icone || 'fa-star') + '" style="color:var(--warning);"></i></div><div class="ach-name">' + esc(a.descricao) + '</div><div class="ach-desc">' + new Date(a.data_obtida).toLocaleDateString('pt-BR') + '</div></div>';
    }
    grid.innerHTML = h;
  });

  apiGet('/api/suporte/minhas-tarefas', function(err, data) {
    var tbody = document.getElementById('all-tasks-body');
    if (err || !data || !data.ok || !data.tarefas || data.tarefas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Nenhuma atividade registrada.</td></tr>';
      return;
    }
    var tipoLabels = { criar_produto: 'Criou Item', editar_produto: 'Editou Item', duplicar_produto: 'Duplicou Item' };
    var h = '';
    for (var i = 0; i < data.tarefas.length; i++) {
      var t = data.tarefas[i];
      h += '<tr><td>' + esc(tipoLabels[t.tipo] || t.tipo) + '</td><td>' + esc(t.descricao || '—') + '</td>' +
        '<td>' + esc(t.restaurante_nome || '—') + '</td>' +
        '<td style="color:var(--success);font-weight:600;">+' + t.pontos + ' XP</td>' +
        '<td><small>' + (t.concluida_em ? new Date(t.concluida_em).toLocaleString('pt-BR') : '—') + '</small></td></tr>';
    }
    tbody.innerHTML = h;
  });
}

/* ═══ RANKING ═══ */
function carregarRanking() {
  apiGet('/api/suporte/ranking', function(err, data) {
    var tbody = document.getElementById('ranking-body');
    if (err || !data || !data.ok) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444;">Erro ao carregar ranking.</td></tr>';
      return;
    }
    document.getElementById('minha-posicao').innerHTML = '<i class="fa-solid fa-medal" style="color:var(--warning);"></i> Sua posição: <strong>#' + data.minhaPosicao + '</strong>';
    var ranking = data.ranking || [];
    if (ranking.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Nenhum membro na equipe.</td></tr>';
      return;
    }
    var statusLabels = { disponivel: 'Disponível', ocupado: 'Ocupado', offline: 'Offline' };
    var h = '';
    for (var i = 0; i < ranking.length; i++) {
      var r = ranking[i];
      var posClass = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : 'rank-rest'));
      var isMe = r.id === suporteUser.id;
      var statusColor = r.status === 'disponivel' ? '#22c55e' : (r.status === 'ocupado' ? '#f59e0b' : '#ef4444');
      h += '<tr' + (isMe ? ' class="rank-highlight"' : '') + '>' +
        '<td style="text-align:center;"><span class="rank-pos ' + posClass + '">' + (i + 1) + '</span></td>' +
        '<td>' + esc(r.nome) + (isMe ? ' <span style="color:var(--accent);font-size:0.75rem;">(você)</span>' : '') + '</td>' +
        '<td>' + esc(r.cargo || '—') + '</td>' +
        '<td style="text-align:center;"><span class="level-badge">Nível ' + (r.nivel || 1) + '</span></td>' +
        '<td style="text-align:center;font-weight:600;">' + (r.xp || 0) + ' XP</td>' +
        '<td style="text-align:center;"><span style="color:' + statusColor + ';"><span class="status-dot" style="background:' + statusColor + ';"></span>' + (statusLabels[r.status] || r.status) + '</span></td>' +
        '</tr>';
    }
    tbody.innerHTML = h;
  });
}

/* ═══ UTILITÁRIOS ═══ */
function atualizarDadosUsuario() {
  apiGet('/api/suporte/me', function(err, data) {
    if (!err && data && data.ok) {
      suporteUser = data.usuario;
      atualizarHeader();
    }
  });
}
/* ═══ VENDAS & ONBOARDING ═══ */
function carregarMinhasVendas() {
  apiGet('/api/suporte/minhas-vendas', function(err, data) {
    var tbody = document.getElementById('minhas-vendas-body');
    if (!tbody) return;
    if (err || !data || !data.ok || !data.vendas || data.vendas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhuma venda registrada ainda. Clique em "Registrar Nova Venda" para começar.</td></tr>';
      return;
    }
    var h = '';
    var fatoresLabels = {
      facilidade_interface: 'Interface / Facilidade',
      pedido_qrcode: 'Cardápio QR Code',
      controle_financeiro: 'Controle Financeiro',
      integracao_ifood: 'Integração iFood',
      suporte_humanizado: 'Suporte Humanizado',
      preco_competitivo: 'Custo-Benefício',
      estabilidade_offline: 'Modo Offline',
      outro: 'Outro'
    };
    for (var i = 0; i < data.vendas.length; i++) {
      var v = data.vendas[i];
      var stColor = v.status_venda === 'fechado' ? 'var(--success)' : (v.status_venda === 'negociacao' ? 'var(--warning)' : 'var(--danger)');
      var stIcon = v.status_venda === 'fechado' ? 'fa-circle-check' : (v.status_venda === 'negociacao' ? 'fa-clock' : 'fa-circle-xmark');
      h += '<tr>' +
        '<td><code style="color:var(--accent);font-weight:bold;">' + esc(v.chave_ativacao) + '</code></td>' +
        '<td><strong style="color:white;">' + esc(v.restaurante_nome) + '</strong><br><small style="color:var(--text-muted);">#' + (v.restaurante_id || '—') + '</small></td>' +
        '<td>' + esc(v.contato_nome || '—') + '<br><small style="color:var(--text-muted);">' + esc(v.contato_telefone || '') + '</small></td>' +
        '<td><span style="color:var(--warning);font-weight:bold;">' + esc(v.plano.toUpperCase()) + '</span><br><small>R$ ' + parseFloat(v.valor_venda || 0).toFixed(2) + '</small></td>' +
        '<td><span class="level-badge" style="font-size:0.75rem;">' + esc(fatoresLabels[v.fator_decisao] || v.fator_decisao || '—') + '</span></td>' +
        '<td><small style="color:var(--text-muted);">Objeção: ' + esc(v.objeção_nao_fecho || 'Nenhuma') + '<br>Ajudas: ' + esc(v.ajudas_usabilidade || 'Nenhuma') + '</small></td>' +
        '<td><small>' + (v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR') : '—') + '</small></td>' +
        '</tr>';
    }
    tbody.innerHTML = h;
  });
}

function abrirModalNovaVenda() {
  document.getElementById('venda-restaurante-nome').value = '';
  document.getElementById('venda-contato-nome').value = '';
  document.getElementById('venda-contato-telefone').value = '';
  document.getElementById('venda-valor').value = '299';
  document.getElementById('venda-objecao').value = '';
  document.getElementById('venda-ajudas').value = '';
  document.getElementById('modal-nova-venda').classList.add('active');
}

function fecharModalNovaVenda() {
  document.getElementById('modal-nova-venda').classList.remove('active');
}

function salvarVendaSuporte() {
  var restNome = document.getElementById('venda-restaurante-nome').value.trim();
  var contatoNome = document.getElementById('venda-contato-nome').value.trim();
  var contatoTel = document.getElementById('venda-contato-telefone').value.trim();
  var plano = document.getElementById('venda-plano').value;
  var valor = document.getElementById('venda-valor').value;
  var statusVenda = document.getElementById('venda-status').value;
  var fatorDecisao = document.getElementById('venda-fator-decisao').value;
  var objecao = document.getElementById('venda-objecao').value.trim();
  var ajudas = document.getElementById('venda-ajudas').value.trim();

  if (!restNome) { alert('Digite o nome do restaurante.'); return; }

  apiPost('/api/suporte/vendas', {
    restaurante_nome: restNome,
    contato_nome: contatoNome,
    contato_telefone: contatoTel,
    plano: plano,
    valor_venda: valor,
    status_venda: statusVenda,
    fator_decisao: fatorDecisao,
    objecao_nao_fecho: objecao,
    ajudas_usabilidade: ajudas
  }, function(err, data) {
    if (err || !data || !data.ok) {
      alert(err || (data && data.erro) || 'Erro ao registrar venda.');
      return;
    }
    alert(data.mensagem || 'Venda realizada com sucesso!');
    fecharModalNovaVenda();
    carregarFinanceiroSuporte();
    carregarRestaurantesSuporte();
  });
}

function carregarFinanceiroSuporte() {
  carregarMissoesSurpresa();
  apiGet('/api/suporte/financeiro', function(err, data) {
    if (err || !data || !data.ok) { carregarMinhasVendas(); return; }

    var f = data.financeiro || {};
    if (document.getElementById('v-saldo-liquido')) {
      document.getElementById('v-saldo-liquido').textContent = 'R$ ' + parseFloat(f.saldoLiquido || 0).toFixed(2);
    }
    if (document.getElementById('v-total-comissoes')) {
      document.getElementById('v-total-comissoes').textContent = 'R$ ' + parseFloat(f.totalComissoes || 0).toFixed(2);
    }
    if (document.getElementById('v-total-vendas-valor')) {
      document.getElementById('v-total-vendas-valor').textContent = 'Em R$ ' + parseFloat(f.totalVendasValor || 0).toFixed(2) + ' em vendas';
    }
    if (document.getElementById('v-meta-status')) {
      document.getElementById('v-meta-status').textContent = (f.vendasFechadasCount || 0) + ' / ' + (f.metaVendas || 5);
    }
    if (document.getElementById('v-meta-progress-bar')) {
      document.getElementById('v-meta-progress-bar').style.width = (f.progressoMetaPct || 0) + '%';
    }
    if (document.getElementById('v-bonificacao-label')) {
      document.getElementById('v-bonificacao-label').textContent = f.atingiuMeta ? '🎉 Bônus de R$ ' + parseFloat(f.bonificacaoMeta || 200).toFixed(2) + ' CONQUISTADO!' : 'Bônus Meta: R$ ' + parseFloat(f.bonificacaoMeta || 200).toFixed(2);
    }
    if (document.getElementById('v-eficiencia')) {
      document.getElementById('v-eficiencia').textContent = f.eficienciaConversao || '0%';
    }

    // Renderizar tabela de vendas com comissões
    var tbody = document.getElementById('minhas-vendas-body');
    if (!tbody) return;
    var vendas = data.vendas || [];
    if (vendas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhuma venda registrada ainda. Clique em "Registrar Nova Venda" para começar.</td></tr>';
      return;
    }

    var h = '';
    var fatoresLabels = {
      facilidade_interface: 'Interface / Facilidade',
      pedido_qrcode: 'Cardápio QR Code',
      controle_financeiro: 'Controle Financeiro',
      integracao_ifood: 'Integração iFood',
      suporte_humanizado: 'Suporte Humanizado',
      preco_competitivo: 'Custo-Benefício',
      estabilidade_offline: 'Modo Offline',
      outro: 'Outro'
    };
    for (var i = 0; i < vendas.length; i++) {
      var v = vendas[i];
      var stColor = v.status_venda === 'fechado' ? 'var(--success)' : (v.status_venda === 'negociacao' ? 'var(--warning)' : 'var(--danger)');
      h += '<tr>' +
        '<td><code style="color:var(--accent);font-weight:bold;">' + esc(v.chave_ativacao) + '</code></td>' +
        '<td><strong style="color:white;">' + esc(v.restaurante_nome) + '</strong><br><small style="color:var(--text-muted);">#' + (v.restaurante_id || '—') + '</small></td>' +
        '<td><span style="color:var(--warning);font-weight:bold;">' + esc(v.plano.toUpperCase()) + '</span><br><small>R$ ' + parseFloat(v.valor_venda || 0).toFixed(2) + '</small></td>' +
        '<td><span class="level-badge" style="font-size:0.75rem;">' + (v.comissao_percentual || 10) + '%</span></td>' +
        '<td><strong style="color:var(--success);">R$ ' + parseFloat(v.comissao_valor || 0).toFixed(2) + '</strong></td>' +
        '<td><small style="color:var(--text-muted);">Fator: ' + esc(fatoresLabels[v.fator_decisao] || v.fator_decisao || '—') + '<br>Objeção: ' + esc(v.objeção_nao_fecho || 'Nenhuma') + '</small></td>' +
        '<td><small>' + (v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR') : '—') + '</small></td>' +
        '</tr>';
    }
    tbody.innerHTML = h;
  });
}

function abrirModalAdiantamento() {
  document.getElementById('adiantamento-valor').value = '';
  document.getElementById('adiantamento-desc').value = '';
  document.getElementById('modal-adiantamento').classList.add('active');
}

function fecharModalAdiantamento() {
  document.getElementById('modal-adiantamento').classList.remove('active');
}

function confirmarSolicitarAdiantamento() {
  var val = parseFloat(document.getElementById('adiantamento-valor').value);
  var desc = document.getElementById('adiantamento-desc').value.trim();

  if (!val || val <= 0) { alert('Informe um valor válido para o adiantamento.'); return; }

  apiPost('/api/suporte/adiantamentos', { valor: val, descricao: desc }, function(err, data) {
    if (err || !data || !data.ok) {
      alert(err || (data && data.erro) || 'Erro ao solicitar adiantamento.');
      return;
    }
    alert(data.mensagem || 'Adiantamento registrado!');
    fecharModalAdiantamento();
    carregarFinanceiroSuporte();
  });
}

function abrirModalCadastroParceiro() {
  document.getElementById('cad-nome').value = '';
  document.getElementById('cad-email').value = '';
  document.getElementById('cad-telefone').value = '';
  document.getElementById('cad-senha').value = '';
  document.getElementById('cad-cpf').value = '';
  document.getElementById('cad-pix').value = '';
  document.getElementById('cad-motivacao').value = '';
  document.getElementById('modal-cadastro-parceiro').classList.add('active');
}

function fecharModalCadastroParceiro() {
  document.getElementById('modal-cadastro-parceiro').classList.remove('active');
}

function salvarCadastroParceiro() {
  var nome = document.getElementById('cad-nome').value.trim();
  var email = document.getElementById('cad-email').value.trim();
  var tel = document.getElementById('cad-telefone').value.trim();
  var senha = document.getElementById('cad-senha').value;
  var cpf = document.getElementById('cad-cpf').value.trim();
  var pix = document.getElementById('cad-pix').value.trim();
  var motivacao = document.getElementById('cad-motivacao').value.trim();

  if (!nome || !email || !senha) {
    alert('Preencha nome, email e senha para o cadastro.');
    return;
  }

  apiPost('/api/suporte/cadastro', {
    nome: nome,
    email: email,
    telefone: tel,
    senha: senha,
    cpf_cnpj: cpf,
    pix_chave: pix,
    motivacao: motivacao
  }, function(err, data) {
    if (err || !data || !data.ok) {
      alert(err || (data && data.erro) || 'Erro ao realizar cadastro.');
      return;
    }
    alert(data.mensagem || 'Cadastro realizado! Aguarde a aprovação da equipe.');
    fecharModalCadastroParceiro();
  });
}

/* ═══ CENTRAL DE NOTIFICAÇÕES EM TEMPO REAL & MISSÕES SURPRESA ═══ */


// ── Relatos de Restaurantes ─────────────────────────────────
function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

function carregarRelatosRestaurantes() {
  apiGet('/api/suporte/tarefas-relatadas', function(err, data) {
    var lista = document.getElementById('relatos-lista');
    var badge = document.getElementById('relatos-count-badge');
    if (err || !data || !data.ok) {
      if (lista) lista.innerHTML = '<div class="empty-state" style="padding:1rem;"><p>Não foi possível carregar os relatos.</p></div>';
      return;
    }
    var relatos = data.relatos || [];
    if (badge) {
      badge.textContent = relatos.length;
      badge.style.display = relatos.length > 0 ? 'inline-block' : 'none';
    }
    if (!lista) return;
    if (relatos.length === 0) {
      lista.innerHTML = '<div class="empty-state" style="padding:1rem;"><p>Nenhum relato pendente. Tudo tranquilo! 🎉</p></div>';
      return;
    }
    var h = '';
    relatos.forEach(function(r) {
      var desc = String(r.descricao || '');
      var linhas = desc.split('\n');
      var tituloRelato = linhas[0] || 'Relato';
      var corpo = linhas.slice(1).join('\n').trim();
      var priAlta = /\bprioridade ALTA\b/i.test(linhas[0] || '');
      var borda = priAlta ? 'border-left:4px solid #ef4444;' : 'border-left:4px solid var(--warning,#f59e0b);';
      var seloTipo = '';
      if (r.tipo === 'falha_automatica') seloTipo = ' <span style="background:#ef4444;color:#fff;font-size:0.68rem;font-weight:800;padding:1px 8px;border-radius:10px;">🚨 FALHA AUTOMÁTICA</span>';
      else if (r.tipo === 'design_tema') seloTipo = ' <span style="background:#ec4899;color:#fff;font-size:0.68rem;font-weight:800;padding:1px 8px;border-radius:10px;">🎨 DESIGN DE TEMA</span>';
      else if (r.tipo === 'delegacao_super') seloTipo = ' <span style="background:#0ea5e9;color:#fff;font-size:0.68rem;font-weight:800;padding:1px 8px;border-radius:10px;">📌 DELEGAÇÃO SUPER ADMIN</span>';
      h += '<div class="relato-item card" style="' + borda + 'padding:12px 14px;margin-bottom:10px;">'
        + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">'
        + '<div style="flex:1;min-width:220px;">'
        + '<strong style="font-size:0.9rem;">' + escHtml(tituloRelato) + '</strong>' + seloTipo
        + (r.restaurante_nome ? ' <span style="color:var(--text-muted);font-size:0.78rem;">• ' + escHtml(r.restaurante_nome) + '</span>' : '')
        + '<div style="color:var(--text-sub);font-size:0.8rem;white-space:pre-wrap;margin-top:6px;">' + escHtml(corpo) + '</div>'
        + '<small style="color:var(--text-muted);">' + (r.criada_em ? new Date(r.criada_em.replace(' ','T')).toLocaleString('pt-BR') : '') + '</small>'
        + '</div>'
        + '<button class="btn btn-primary" style="white-space:nowrap;" onclick="assumirRelato(' + r.id + ')"><i class="fa-solid fa-hand"></i> Assumir</button>'
        + '</div></div>';
    });
    lista.innerHTML = h;
  });
}

window.assumirRelato = function(id) {
  apiPost('/api/suporte/assumir-relato', { id: id }, function(err, data) {
    if ((err || !data.ok)) { showToast((data && data.erro) || 'Erro ao assumir relato', 'error'); return; }
    showToast(data.mensagem || 'Relato assumido!', 'success');
    carregarRelatosRestaurantes();
    carregarAtividades();
  });
};

window.concluirMinhaTarefa = function(id) {
  apiPost('/api/suporte/concluir-tarefa', { id: id }, function(err, data) {
    if (err || !data || !data.ok) { showToast((data && data.erro) || 'Erro ao concluir tarefa', 'error'); return; }
    showToast(data.mensagem || 'Tarefa concluída!', 'success');
    carregarAtividades();
  });
};

var _suporteSocket = null;
function initSuporteRealtimeSockets() {
  if (typeof io === 'undefined') return;
  if (_suporteSocket) return;
  try {
    _suporteSocket = io();
    _suporteSocket.on('nova_missao_surpresa', function(data) {
      showToast('?? PROMOÇÃO SURPRESA: ' + data.titulo + ' (Bônus R$ ' + parseFloat(data.recompensa_valor || 0).toFixed(2) + ')', 'warning');
      carregarMissoesSurpresa();
      carregarNotificacoesSuporte();
    });
    _suporteSocket.on('nova_tarefa_suporte', function(data) {
      showToast('Novo relato de ' + (data.restaurante_nome || 'restaurante') + ': ' + data.titulo, 'warning');
      carregarRelatosRestaurantes();
    });
  } catch(e) { console.error('Erro ao conectar socket de suporte:', e); }
}

function carregarNotificacoesSuporte() {
  apiGet('/api/suporte/notificacoes', function(err, data) {
    var badge = document.getElementById('notif-badge');
    var list = document.getElementById('central-notificacoes-list');
    if (!data || !data.ok || !data.notificacoes) return;

    var notifs = data.notificacoes || [];
    if (badge) {
      if (notifs.length > 0) {
        badge.textContent = notifs.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (list) {
      if (notifs.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">Nenhuma notificação recebida.</div>';
        return;
      }
      var h = '';
      notifs.forEach(function(n) {
        var icon = n.tipo === 'urgente' ? 'fa-bell-slash' : (n.tipo === 'importante' ? 'fa-triangle-exclamation' : 'fa-bullhorn');
        var color = n.tipo === 'urgente' ? 'var(--danger)' : (n.tipo === 'importante' ? 'var(--warning)' : 'var(--accent)');
        h += '<div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:10px;padding:12px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<strong style="color:white;font-size:0.9rem;"><i class="fa-solid ' + icon + '" style="color:' + color + ';margin-right:6px;"></i> ' + esc(n.titulo) + '</strong>' +
            '<small style="color:var(--text-muted);font-size:0.75rem;">' + (n.criado_em ? new Date(n.criado_em).toLocaleString('pt-BR') : '—') + '</small>' +
          '</div>' +
          '<p style="color:var(--text-secondary);font-size:0.85rem;margin:0;">' + esc(n.corpo) + '</p>' +
          '</div>';
      });
      list.innerHTML = h;
    }
  });
}

function toggleCentralNotificacoesSuporte() {
  var modal = document.getElementById('modal-central-notificacoes');
  if (!modal) return;
  if (modal.classList.contains('active')) {
    modal.classList.remove('active');
  } else {
    modal.classList.add('active');
    carregarNotificacoesSuporte();
  }
}

function carregarMissoesSurpresa() {
  apiGet('/api/suporte/missoes', function(err, data) {
    var container = document.getElementById('container-missoes-surpresa');
    if (!container) return;
    if (err || !data || !data.ok || !data.missoes || data.missoes.length === 0) {
      container.innerHTML = '<div style="background:rgba(255,255,255,0.05);padding:1rem;border-radius:12px;border:1px dashed #6366f1;text-align:center;color:#94a3b8;font-size:0.85rem;">Nenhuma promoção relâmpago ativa no momento. Fique atento às notificações!</div>';
      return;
    }
    var h = '';
    data.missoes.forEach(function(m) {
      h += '<div style="background:rgba(99,102,241,0.15);border:1px solid #6366f1;padding:12px;border-radius:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
          '<h4 style="color:#fbbf24;font-size:0.95rem;margin:0;"><i class="fa-solid fa-bolt" style="color:#f59e0b;"></i> ' + esc(m.titulo) + '</h4>' +
          '<span style="background:var(--success);color:white;font-weight:800;padding:2px 8px;border-radius:10px;font-size:0.75rem;">+ R$ ' + parseFloat(m.recompensa_valor || 0).toFixed(2) + '</span>' +
        '</div>' +
        '<p style="color:#e2e8f0;font-size:0.8rem;margin-bottom:8px;">' + esc(m.descricao) + '</p>' +
        '<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#94a3b8;">' +
          '<span>Meta: <strong>' + (m.meta_qtd || 1) + ' vendas</strong></span>' +
          '<span>Prazo: <strong>' + (m.data_limite ? new Date(m.data_limite).toLocaleString('pt-BR') : 'Hoje / Esporádico') + '</strong></span>' +
        '</div>' +
        '</div>';
    });
    container.innerHTML = h;
  });
}
/* ═══ SIDEBAR EVENTS ═══ */
document.addEventListener('DOMContentLoaded', function() {
  var savedToken = localStorage.getItem('chef_suporte_token');
  if (savedToken) {
    suporteToken = savedToken;
    apiGet('/api/suporte/me', function(err, data) {
      if (!err && data && data.ok) {
        suporteUser = data.usuario;
        entrarPainel();
      } else {
        localStorage.removeItem('chef_suporte_token');
      }
    });
  }

  var menuItems = document.querySelectorAll('.sidebar .menu-item');
  for (var i = 0; i < menuItems.length; i++) {
    menuItems[i].addEventListener('click', function() {
      switchTabSuporte(this.getAttribute('data-target'));
    });
  }

  document.getElementById('login-senha').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') loginSuporte();
  });

  if (typeof suporteToken !== 'undefined' && suporteToken && typeof carregarRelatosRestaurantes === 'function') {
    carregarRelatosRestaurantes();
  }
});