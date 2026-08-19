window.activeComandas = [];
window.pendingShowBill = false;
window.newComandasMap = new Map();
const HOST = window.location.hostname;
const socket = io({ query: { token: localStorage.getItem('chef_token'), restaurante_id: localStorage.getItem('restaurante_id') || '1' } });
window.socket = socket;

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

socket.on('connect', () => {
  if (loggedUser) {
    socket.emit('get_mesas');
    socket.emit('get_produtos');
    socket.emit('get_esteira', loggedUser.nome);
  }
});

function escHtml(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escJs(t){try{return JSON.stringify(String(t==null?'':t)).replace(/</g,'\\x3C').replace(/>/g,'\\x3E').replace(/"/g,'&quot;').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}catch(e){return '""';}}


let allMesas = [];
let allPedidos = [];
let cart = [];
let tableGroupCache = {};
let longPressTimer = null; // Used in UI for tables
let isHomePressFired = false;
let homePressTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    const handleHomeStart = (e) => {
      isHomePressFired = false;
      homePressTimeout = setTimeout(() => {
        isHomePressFired = true;
        window.location.href = '/index.html';
      }, 2000);
    };
    
    const handleHomeEnd = (e) => {
      if (homePressTimeout) {
        clearTimeout(homePressTimeout);
        homePressTimeout = null;
      }
      if (!isHomePressFired) {
        if (typeof showView === 'function') {
          showView('tables', 'Comanda Mobile');
        }
      }
      if (e && e.cancelable) e.preventDefault();
    };

    btnHome.addEventListener('mousedown', handleHomeStart);
    btnHome.addEventListener('touchstart', handleHomeStart, { passive: true });
    btnHome.addEventListener('mouseup', handleHomeEnd);
    btnHome.addEventListener('touchend', handleHomeEnd);
  }
});
let TABS = [];
let MENU = [];
let MESAS = [];
let CONFIGS = {};
let currentTable = '';
let currentTab = '';

const contasSolicitadas = new Set();
let selectedProduct = null;
let selectedQty = 1;
let selectedAddons = new Set();
let loggedUser = null;

// --- Bill Logic Variables ---
let billItems = [];
let billSplitCount = 1;
let billSelectedItems = new Map(); // id -> fraction (0 to 1)
let billCurrentMode = 'pessoas'; // 'pessoas' or 'itens'
let billActionValue = 0;
let billSelectedIdsForFinalize = []; // FULL items selected


// --- Routing ---
window.showView = (id, titleText, pushToHistory = true) => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${id}`).classList.add('active');
  document.getElementById('header-title').innerText = titleText;
  
  if (pushToHistory) {
    history.pushState({ view: id, title: titleText }, '', '');
  }

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (id === 'tables') document.getElementById('nav-mesas').classList.add('active');
  if (id === 'esteira') document.getElementById('nav-esteira').classList.add('active');

  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    if (id === 'tables' || id === 'esteira') {
      bottomNav.style.display = 'flex';
    } else {
      bottomNav.style.display = 'none';
    }
  }
};

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.view) {
    showView(e.state.view, e.state.title, false);
  }
});

// --- Toast ---
function showToast(msg, bg = '#3ab55b') {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.style.background = bg;
  toast.classList.add('show');
  toast.style.display = 'block';
  setTimeout(() => { toast.classList.remove('show'); toast.style.display = 'none'; }, 2500);
}

// --- Login Logic ---
let loginMode = 'usuario';
const btnModeUsuario = document.getElementById('btn-mode-usuario');
const btnModePin = document.getElementById('btn-mode-pin');
const formUsuario = document.getElementById('login-form-usuario');
const formPin = document.getElementById('login-form-pin');

if (btnModeUsuario) btnModeUsuario.addEventListener('click', () => {
  loginMode = 'usuario';
  btnModeUsuario.style.background = 'white'; btnModeUsuario.style.color = '#7c3aed'; btnModeUsuario.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  btnModePin.style.background = 'transparent'; btnModePin.style.color = '#6b7280'; btnModePin.style.boxShadow = 'none';
  formUsuario.style.display = 'block'; formPin.style.display = 'none';
});
if (btnModePin) btnModePin.addEventListener('click', () => {
  loginMode = 'pin';
  btnModePin.style.background = 'white'; btnModePin.style.color = '#7c3aed'; btnModePin.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  btnModeUsuario.style.background = 'transparent'; btnModeUsuario.style.color = '#6b7280'; btnModeUsuario.style.boxShadow = 'none';
  formPin.style.display = 'block'; formUsuario.style.display = 'none';
  document.getElementById('input-pin').focus();
});

document.getElementById('btn-login').onclick = () => {
  try {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    }
  } catch(e) {}

  if (loginMode === 'pin') {
    const pin = document.getElementById('input-pin').value.trim();
    if (!pin) return showToast('Informe o PIN', '#fc4b15');
    socket.emit('login_por_pin', { pin });
  } else {
    const usuario = document.getElementById('input-usuario').value;
    const senha = document.getElementById('input-senha').value;
    if (!usuario || !senha) return showToast('Preencha os campos', '#fc4b15');
    socket.emit('login_funcionario', { usuario, senha });
  }
};

document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('chef_credentials');
    localStorage.removeItem('chef_session');
    localStorage.removeItem('logged_user');
    window.location.href = '/painel-funcionario.html';
  };

document.getElementById('btn-fullscreen').onclick = async () => {
  const doc = document.documentElement;
  const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
  
  if (!isFullscreen) {
    try {
      if (screen.orientation && screen.orientation.type && screen.orientation.lock) {
        await screen.orientation.lock(screen.orientation.type).catch(() => {});
      }
      
      if (doc.requestFullscreen) {
        await doc.requestFullscreen();
      } else if (doc.webkitRequestFullscreen) { /* Safari */
        await doc.webkitRequestFullscreen();
      } else if (doc.msRequestFullscreen) { /* IE11 */
        await doc.msRequestFullscreen();
      }
    } catch (err) {
      console.log(err);
      alert('Seu navegador não suporta tela cheia nativa. (Ex: iPhones não suportam tela cheia no Safari, adicione à Tela de Início).');
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { /* Safari */
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
      document.msExitFullscreen();
    }
  }
};

const handleFullscreenChange = () => {
  const icon = document.querySelector('#btn-fullscreen i');
  const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
  if (isFullscreen) {
    icon.className = 'ph ph-corners-in';
  } else {
    icon.className = 'ph ph-corners-out';
  }
};
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

socket.on('login_success', (user) => {
  loggedUser = user;
  if (user.restaurante_id) localStorage.setItem('restaurante_id', user.restaurante_id);
  if (typeof initTracking === 'function') initTracking(user.id);
  const isAdmin = (user.cargo || user.funcao || '') !== 'Garçom';
  if(document.getElementById('btn-home')) document.getElementById('btn-home').style.display = isAdmin ? 'block' : 'none';
  if(document.getElementById('btn-colaborador')) document.getElementById('btn-colaborador').style.display = isAdmin ? 'block' : 'none';
  if(document.getElementById('btn-logout')) document.getElementById('btn-logout').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('btn-fullscreen').style.display = 'block';
  showToast(`Bem vindo, ${user.nome}!`);
  showView('tables', 'Comanda Mobile');
  socket.emit('get_mesas');
  socket.emit('get_produtos');
  socket.emit('get_esteira', loggedUser.nome);

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
});

// (Segurança) Armazena apenas o token de sessão (sem senha) para reautenticação automática.
socket.on('login_token', (token) => {
  if (!token || !loggedUser) return;
  try {
    localStorage.setItem('chef_session', JSON.stringify({ token, usuario: loggedUser.usuario, cargo: loggedUser.cargo, nome: loggedUser.nome, id: loggedUser.id }));
  } catch (e) { }
});

socket.on('login_error', (msg) => {
  localStorage.removeItem('chef_credentials');
  localStorage.removeItem('chef_session');
  showToast(msg, '#fc4b15');
  showView('login', 'Acesso Garçom');
});

// --- IA Notification Queue (prevents overlap & stacking) ---
window._iaNotifQueue = [];
window._iaNotifActive = false;

function processIaNotifQueue() {
  if (window._iaNotifActive || window._iaNotifQueue.length === 0) return;
  window._iaNotifActive = true;
  var item = window._iaNotifQueue.shift();
  item.createFn();
  setTimeout(function() {
    window._iaNotifActive = false;
    processIaNotifQueue();
  }, item.duration);
}

function queueIaNotif(createFn, duration) {
  window._iaNotifQueue.push({ createFn: createFn, duration: duration || 8000 });
  processIaNotifQueue();
}

function createIaOverlay(msg, bg, buttonsHtml, duration) {
  var wrapper = document.createElement("div");
  wrapper.className = "ia-notificacao";
  wrapper.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding-top:60px;pointer-events:auto;zoom:1;-webkit-zoom:1;";
  wrapper.innerHTML = '<div style="background:' + bg + ';color:white;padding:14px 20px;border-radius:12px;max-width:90%;width:360px;box-shadow:0 4px 16px rgba(0,0,0,0.3);animation:slideToast 0.3s ease-out;pointer-events:auto;zoom:1;-webkit-zoom:1;">' + msg + (buttonsHtml ? '<div style="display:flex;gap:8px;margin-top:10px;">' + buttonsHtml + '</div>' : '') + '</div>';
  document.body.appendChild(wrapper);
  var removeFn = function() { if (wrapper.parentElement) wrapper.remove(); };
  wrapper.addEventListener("click", function(e) { if (e.target === wrapper) removeFn(); });
  setTimeout(removeFn, duration);
  return wrapper;
}

// --- IA: Sugestao de refill de bebida ---
socket.on("ia_sugestao_garcom", (data) => {
  var tipo = data.tipo, mesa = data.mesa, produto = data.produto, minutos = data.minutos, mensagem = data.mensagem;
  if (tipo === "refill_bebida") {
    showToast(mensagem, "#3b82f6");
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🍺 Refill sugerido", { body: mensagem, icon: "/favicon.ico" });
    }
    queueIaNotif(function() {
      createIaOverlay(
        '<div style="font-weight:700;font-size:14px;margin-bottom:6px;">🍺 Oferecer nova bebida?</div>' +
        '<div style="font-size:13px;">' + escHtml(mensagem) + '</div>',
        "#3b82f6",
        '<button data-action="refill-sim" data-mesa="' + escHtml(mesa) + '" data-produto="' + escHtml(produto) + '" style="flex:1;padding:10px;background:#22c55e;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">Sim, vou oferecer</button>' +
        '<button data-action="dismiss" style="flex:1;padding:10px;background:#64748b;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">Agora não</button>',
        30000
      );
    });
  }
});

socket.on("ia_sugestao_garcom_aceita", (data) => {
  showToast(data.mensagem, "#22c55e");
});

// --- IA: Manobra - Solicitacao de entrada cortesia ---
socket.on("ia_manobra_aceita", (data) => {
  var pedidoId = data.pedidoId, mesa = data.mesa, produto = data.produto, minutos = data.minutos, mensagem = data.mensagem;
  showToast(mensagem, "#ff6b35");
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("🔥 Manobra - Entrada cortesia", { body: mensagem, icon: "/favicon.ico", requireInteraction: true });
  }
  queueIaNotif(function() {
    createIaOverlay(
      '<div style="font-weight:700;font-size:14px;margin-bottom:6px;">🔥 Oferecer entrada cortesia</div>' +
      '<div style="font-size:13px;">' + escHtml(mensagem) + '</div>',
      "#ff6b35",
      '<button data-action="manobra-sim" data-pedido-id="' + escHtml(pedidoId) + '" data-mesa="' + escHtml(mesa) + '" data-produto="' + escHtml(produto) + '" style="flex:1;padding:10px;background:#22c55e;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">Vou oferecer entrada</button>' +
      '<button data-action="manobra-nao" data-pedido-id="' + escHtml(pedidoId) + '" data-mesa="' + escHtml(mesa) + '" data-produto="' + escHtml(produto) + '" style="flex:1;padding:10px;background:#64748b;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">Cliente recusou</button>',
      30000
    );
  });
});

socket.on("ia_manobra_executada", (data) => {
  showToast(data.mensagem, "#22c55e");
});

// --- IA: Event delegation for popup buttons (fixes zoom/touch issues) ---
document.addEventListener("click", function(e) {
  var btn = e.target.closest("[data-action]");
  if (!btn) return;
  var action = btn.getAttribute("data-action");
  var wrapper = btn.closest(".ia-notificacao");

  if (action === "refill-sim") {
    window.socket.emit("ia_resposta_sugestao", {
      tipo: "refill_bebida",
      mesa: btn.getAttribute("data-mesa"),
      produto: btn.getAttribute("data-produto"),
      resposta: "sim"
    });
    if (wrapper) wrapper.remove();
  } else if (action === "manobra-sim") {
    window.socket.emit("ia_manobra_executar", {
      pedidoId: parseInt(btn.getAttribute("data-pedido-id")),
      mesa: btn.getAttribute("data-mesa"),
      produto: btn.getAttribute("data-produto"),
      resposta: "sim"
    });
    if (wrapper) wrapper.remove();
  } else if (action === "manobra-nao") {
    window.socket.emit("ia_manobra_executar", {
      pedidoId: parseInt(btn.getAttribute("data-pedido-id")),
      mesa: btn.getAttribute("data-mesa"),
      produto: btn.getAttribute("data-produto"),
      resposta: "nao"
    });
    if (wrapper) wrapper.remove();
  } else if (action === "dismiss") {
    var dismissData = {
      tipo: btn.getAttribute("data-action"),
      mesa: btn.getAttribute("data-mesa") || "",
      produto: btn.getAttribute("data-produto") || "",
      pedidoId: btn.getAttribute("data-pedido-id") || "",
      texto: "",
      criadoEm: Date.now()
    };
    var notifText = wrapper ? wrapper.textContent.trim() : "";
    dismissData.texto = notifText.substring(0, 120);
    try {
      var chave = "chef_pendentes_" + (loggedUser ? loggedUser.nome : "local");
      var lista = JSON.parse(localStorage.getItem(chave) || "[]");
      if (!Array.isArray(lista)) lista = [];
      lista.unshift(dismissData);
      if (lista.length > 20) lista = lista.slice(0, 20);
      localStorage.setItem(chave, JSON.stringify(lista));
    } catch(e) {}
    if (wrapper) wrapper.remove();
  }
});
// Auto Login (via token de sessão — nunca pela senha)
window.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('chef_credentials');
  const savedSession = localStorage.getItem('chef_session');
  if (savedSession) {
    try {
      const sess = JSON.parse(savedSession);
      if (sess.token) {
        socket.emit('login_funcionario_token', sess.token);
        return;
      }
    } catch(e){}
  }
  
  // Se não tem sessão salva, vai pro painel do funcionário (novo portal de entrada)
  window.location.href = '/painel-funcionario.html';
});

// --- Data Fetching ---
socket.on('mesas_atualizadas', (mesas) => {
  MESAS = mesas;
  renderTables();
});

socket.on('configuracoes_atualizadas', fetchConfigs);

async function fetchConfigs() {
  try {
    const res = await fetch('/api/config?restaurante_id=' + encodeURIComponent(localStorage.getItem('restaurante_id') || '1'));
    CONFIGS = await res.json();
    if (MENU.length > 0) reorderTabs();
  } catch (e) {
    console.error(e);
  }
}
fetchConfigs();

function reorderTabs() {
  let rawTabs = [...new Set(MENU.map(m => m.category))];
  
  if (CONFIGS && CONFIGS.ordem_categorias) {
    try {
      const order = JSON.parse(CONFIGS.ordem_categorias);
      TABS = rawTabs.sort((a, b) => {
        let idxA = order.indexOf(a);
        let idxB = order.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });
      // Forçar "Mais Pedidos" para primeiro se existir
      if (TABS.includes('Mais Pedidos')) {
        TABS = ['Mais Pedidos', ...TABS.filter(t => t !== 'Mais Pedidos')];
      }
    } catch(e) {
      TABS = rawTabs;
    }
  } else {
    TABS = rawTabs;
    if (TABS.includes('Mais Pedidos')) {
      TABS = ['Mais Pedidos', ...TABS.filter(t => t !== 'Mais Pedidos')];
    }
  }

  if (TABS.length > 0 && !TABS.includes(currentTab)) {
    currentTab = TABS[0];
  }
  if (document.getElementById('view-menu').classList.contains('active')) {
    renderMenu();
  }
}

socket.on('produtos_atualizados', (produtos) => {
  MENU = produtos
    .filter(p => p.status !== 'inativo' && p.visibilidade !== 'caixa')
    .map(p => ({
    id: p.id,
    originalId: p.originalId,
    category: p.categoria,
    name: p.nome,
    emoji: p.emoji || '🍽️',
    price: Number(p.preco),
    sector: p.setor || 'Cozinha 1',
    hasAddons: p.hasAddons === 1 || p.hasAddons === 'true' || p.hasAddons === true
  }));
  
  reorderTabs();
});

// --- CONTEXT MENU (MANTER PRESSIONADO) ---
let garcomLongPressFiredAt = 0;

function garcomWasLongPress() {
  return (Date.now() - garcomLongPressFiredAt) < 500;
}

function showGarcomContextMenu(x, y, items) {
  hideGarcomContextMenu();
  let menu = document.getElementById('garcom-context-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'garcom-context-menu';
    menu.style.cssText = 'display:none; position:fixed; z-index:10050; background:#ffffff; border-radius:14px; box-shadow:0 12px 32px rgba(0,0,0,0.25); border:1px solid #e2e8f0; min-width:220px; max-width:280px; overflow:hidden; padding:6px 0; user-select:none; font-family:inherit;';
    document.body.appendChild(menu);
  }
  menu.innerHTML = items.map((it, i) => {
    if (it.sep) return '<div style="border-top:1px solid #f1f5f9; margin:4px 0;"></div>';
    return `<button data-idx="${i}" style="width:100%; text-align:left; padding:12px 16px; background:none; border:none; font-size:14px; font-weight:600; color:${it.color || '#334155'}; cursor:pointer; display:flex; align-items:center; gap:10px;">
      <i class="ph ${it.icon || 'ph-circle'}" style="color:${it.color || '#64748b'}; font-size:18px;"></i> ${it.label}
    </button>`;
  }).join('');

  const menuW = 240;
  const menuH = Math.min(items.length, 12) * 48 + 12;
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - menuW - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - menuH - 8)) + 'px';
  menu.style.display = 'block';

  menu.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = items[+btn.dataset.idx];
      hideGarcomContextMenu();
      if (item && item.callback) item.callback();
    });
  });

  setTimeout(() => {
    const close = (e) => {
      if (e.target && menu.contains(e.target)) return;
      if (Date.now() - garcomLongPressFiredAt < 700) return;
      hideGarcomContextMenu();
      document.removeEventListener('touchstart', close);
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
    };
    document.addEventListener('touchstart', close, { passive: true });
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
  }, 50);
}

function hideGarcomContextMenu() {
  const menu = document.getElementById('garcom-context-menu');
  if (menu) menu.style.display = 'none';
}

function bindLongPressDelegated(containerEl, targetSelector, handler, duration = 450) {
  if (!containerEl || containerEl._garcomLpBound) return;
  containerEl._garcomLpBound = true;
  let timer = null;
  let startX = 0, startY = 0;
  const start = (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const el = (e.target && e.target.closest) ? e.target.closest(targetSelector) : null;
    if (!el || !containerEl.contains(el)) return;
    const t = (e.touches && e.touches[0]) || e;
    startX = t.clientX;
    startY = t.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      garcomLongPressFiredAt = Date.now();
      handler(el, t.clientX, t.clientY, e);
    }, duration);
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const move = (e) => {
    if (!timer) return;
    const t = (e.touches && e.touches[0]) || e;
    if (Math.abs(t.clientX - startX) > 12 || Math.abs(t.clientY - startY) > 12) {
      clearTimeout(timer);
      timer = null;
    }
  };
  containerEl.addEventListener('touchstart', start, { passive: true });
  containerEl.addEventListener('touchend', cancel);
  containerEl.addEventListener('touchmove', move, { passive: true });
  containerEl.addEventListener('touchcancel', cancel);
  containerEl.addEventListener('mousedown', start);
  containerEl.addEventListener('mousemove', move);
  containerEl.addEventListener('mouseup', cancel);
  containerEl.addEventListener('mouseleave', cancel);

  containerEl.addEventListener('contextmenu', (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const el = (e.target && e.target.closest) ? e.target.closest(targetSelector) : null;
    if (!el || !containerEl.contains(el)) return;
    e.preventDefault();
    if (Date.now() - garcomLongPressFiredAt < 700) return;
    const t = (e.touches && e.touches[0]) || e;
    garcomLongPressFiredAt = Date.now();
    handler(el, t.clientX, t.clientY, e);
  }, { passive: false });
}

function garcomOperador() {
  return loggedUser ? (loggedUser.nome || 'Garçom') : 'Garçom';
}

let pickMesaCallback = null;
function openPickMesaModal(title, excludeName, cb) {
  pickMesaCallback = cb;
  const modal = document.getElementById('pick-mesa-modal');
  if (!modal) return;
  document.getElementById('pick-mesa-title').innerText = title;
  const list = document.getElementById('pick-mesa-list');
  const others = MESAS.filter(m => m.nome !== excludeName);
  if (others.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:24px 8px; font-weight:600;">Nenhuma outra mesa disponível.</div>';
  } else {
    list.innerHTML = others.map((m, i) => {
      const isOcupada = m.status === 'Ocupada';
      const isReservada = m.status === 'Reservada';
      const color = isOcupada ? '#dc2626' : (isReservada ? '#2563eb' : '#16a34a');
      const label = isOcupada ? 'Ocupada' : (isReservada ? 'Reservada' : 'Livre');
      return `<button data-idx="${i}" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; cursor:pointer;">
        <span style="font-weight:800; font-size:16px; color:#0f172a;">${escHtml(m.nome)}</span>
        <span style="font-size:12px; font-weight:700; color:${color};">${label}</span>
      </button>`;
    }).join('');
    list.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mesa = others[+btn.dataset.idx];
        const cb = pickMesaCallback;
        window.closePickMesaModal();
        if (mesa && cb) cb(mesa.nome);
      });
    });
  }
  modal.style.display = 'flex';
}

window.closePickMesaModal = () => {
  pickMesaCallback = null;
  const modal = document.getElementById('pick-mesa-modal');
  if (modal) modal.style.display = 'none';
};

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.openTableContextMenu = (mesa, x, y) => {
  const isReserved = mesa.status === 'Reservada';
  const isOccupied = mesa.status === 'Ocupada';
  const items = [];

  items.push({
    label: 'Ver Conta Parcial',
    icon: 'ph-receipt',
    color: '#fc4b15',
    callback: () => {
      window.pendingShowBill = true;
      currentTable = mesa.nome;
      socket.emit('get_itens_mesa', mesa.nome);
    }
  });

  items.push({
    label: 'Pedir Conta',
    icon: 'ph-calculator',
    color: '#f2a900',
    callback: () => {
      if (confirm('Solicitar fechamento da mesa no caixa?')) {
        socket.emit('alerta_pedir_conta', mesa.nome);
        showToast('Fechamento solicitado!', '#f2c94c');
      }
    }
  });

  if (isReserved) {
    items.push({
      label: 'Cancelar Reserva',
      icon: 'ph-calendar-x',
      color: '#ef4444',
      callback: () => {
        if (confirm('Cancelar a reserva e liberar a mesa?')) {
          socket.emit('cancelar_reserva', { mesaName: mesa.nome });
          showToast('Reserva cancelada', '#ef4444');
        }
      }
    });
  } else {
    items.push({
      label: 'Reservar Mesa',
      icon: 'ph-calendar-check',
      color: '#3b82f6',
      callback: () => {
        const obs = prompt(`Reservar a mesa ${mesa.nome}.\nCliente / observação:`);
        if (obs === null) return;
        socket.emit('reservar_mesa', {
          mesaName: mesa.nome,
          observacao: JSON.stringify({ cliente: obs, data: '', obs })
        });
        showToast(`Mesa ${mesa.nome} reservada!`);
      }
    });
  }

  items.push({
    label: 'Atribuir Cliente à Mesa',
    icon: 'ph-user-plus',
    color: '#0ea5e9',
    callback: () => window.openAssignClientModal(mesa)
  });

  items.push({ sep: true });

  items.push({
    label: 'Juntar Mesas',
    icon: 'ph-link-simple',
    color: '#8b5cf6',
    callback: () => {
      openPickMesaModal(`Juntar a mesa ${mesa.nome} com:`, mesa.nome, (target) => {
        if (confirm(`Juntar a mesa ${mesa.nome} com a ${target}?`)) {
          socket.emit('juntar_mesas', { mesaA: mesa.nome, mesaB: target, operador: garcomOperador() });
          showToast(`Mesas ${mesa.nome} e ${target} unidas`);
        }
      });
    }
  });

  items.push({
    label: 'Transferir Itens',
    icon: 'ph-arrows-left-right',
    color: '#f97316',
    callback: () => {
      openPickMesaModal(`Mover itens da mesa ${mesa.nome} para:`, mesa.nome, (target) => {
        if (confirm(`Mover TODOS os itens da mesa ${mesa.nome} para a ${target}? (mesa ficará livre)`)) {
          socket.emit('transferir_mesas_itens', { mesaA: mesa.nome, mesaB: target, operador: garcomOperador() });
          showToast(`Itens movidos para a ${target}`);
        }
      });
    }
  });

  if (isOccupied) {
    items.push({
      label: 'Transferir Mesa',
      icon: 'ph-swap',
      color: '#ef4444',
      callback: () => {
        openPickMesaModal(`Transferir a ocupação da mesa ${mesa.nome} para:`, mesa.nome, (target) => {
          if (confirm(`Transferir a ocupação da mesa ${mesa.nome} para a ${target}?`)) {
            socket.emit('transferir_mesa', { mesaAtual: mesa.nome, novaMesa: target, operador: garcomOperador() });
            showToast(`Mesa transferida para a ${target}`);
          }
        });
      }
    });
  }

  showGarcomContextMenu(x, y, items);
};

window.openBillItemContextMenu = (item, x, y) => {
  const isPaid = item.status === 'Pago';
  const fraction = billSelectedItems.get(item.id) || 0;
  const items = [];

  if (!isPaid) {
    items.push({
      label: fraction === 0.5 ? 'Voltar ao Total' : 'Rachar Metade',
      icon: 'ph-scissors',
      color: '#8b5cf6',
      callback: () => splitItemFraction(item.id)
    });
    items.push({
      label: fraction > 0 ? 'Desmarcar da Seleção' : 'Selecionar p/ Pagamento',
      icon: 'ph-check-square-offset',
      color: '#fc4b15',
      callback: () => toggleBillItem(item.id)
    });
    items.push({
      label: 'Marcar como Entregue',
      icon: 'ph-check-circle',
      color: '#16a34a',
      callback: () => {
        socket.emit('marcar_entregue', { id: item.id, userName: garcomOperador() });
        socket.emit('get_itens_mesa', currentTable);
        showToast('Item marcado como entregue!', '#16a34a');
      }
    });
  }

  items.push({
    label: 'Mover para Comanda',
    icon: 'ph-user',
    color: '#3b82f6',
    callback: () => {
      const nome = prompt('Digite o nome da comanda (deixe vazio para consumo da mesa):');
      if (nome === null) return;
      socket.emit('atribuir_comanda_item', { itemId: item.id, comandaName: nome.trim() || null, operador: garcomOperador() });
      socket.emit('get_itens_mesa', currentTable);
      showToast('Item movido para comanda');
    }
  });

  items.push({
    label: 'Transferir p/ Outra Mesa',
    icon: 'ph-arrows-left-right',
    color: '#f97316',
    callback: () => {
      openPickMesaModal('Transferir este item para:', currentTable, (target) => {
        if (confirm(`Transferir este item para a ${target}?`)) {
          socket.emit('transferir_item', { itemId: item.id, novaMesa: target, operador: garcomOperador() });
          showToast(`Item transferido para a ${target}`);
        }
      });
    }
  });

  if (!isPaid) {
    items.push({ sep: true });
    items.push({
      label: 'Estornar / Remover Item',
      icon: 'ph-trash',
      color: '#ef4444',
      callback: () => {
        if (confirm('Remover este item da conta da mesa?\nAção exige senha de gerente no caixa e não pode ser desfeita.')) {
          socket.emit('remover_item_pedido', {
            orderId: item.id,
            mesaName: currentTable,
            usuario: garcomOperador(),
            motivo: 'Removido pelo garçom (Comanda Mobile)'
          });
          showToast('Item removido!', '#ef4444');
        }
      }
    });
  }

  showGarcomContextMenu(x, y, items);
};

window.openProductContextMenu = (prod, x, y) => {
  showGarcomContextMenu(x, y, [
    {
      label: 'Ver Detalhes',
      icon: 'ph-eye',
      color: '#3b82f6',
      callback: () => openDetails(prod.id)
    },
    {
      label: 'Adicionar 1 ao Pedido',
      icon: 'ph-plus-circle',
      color: '#16a34a',
      callback: () => addDirectToCart(prod.id)
    }
  ]);
};

// --- ATRIBUIR CLIENTE À MESA ---
window.openAssignClientModal = (mesa) => {
  window._assignClientMesa = mesa.nome;
  document.getElementById('assign-client-table').innerText = mesa.nome;
  document.getElementById('assign-client-name').value = '';
  document.getElementById('assign-client-phone').value = '';
  document.getElementById('assign-client-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('assign-client-name').focus(), 100);
};

window.closeAssignClientModal = () => {
  document.getElementById('assign-client-modal').style.display = 'none';
  window._assignClientMesa = null;
};

window.submitAssignClient = () => {
  const mesa = window._assignClientMesa;
  const nome = document.getElementById('assign-client-name').value.trim();
  const telefone = document.getElementById('assign-client-phone').value.trim();
  if (!mesa) return;
  if (!nome) {
    alert('Digite o nome do cliente.');
    return;
  }
  socket.emit('cliente_entrou_mesa', { mesa, cliente: { id: null, nome, telefone } });
  showToast(`Cliente ${nome} atribuído à mesa ${mesa}`);
  window.closeAssignClientModal();
};

// --- BIND DE MANTER PRESSIONADO ---
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('tables-grid');
  if (grid) bindLongPressDelegated(grid, '.table-card', (el, x, y) => {
    const idx = [...grid.children].indexOf(el);
    const mesa = MESAS[idx];
    if (mesa) window.openTableContextMenu(mesa, x, y);
  });

  const billList = document.getElementById('bill-items-list');
  if (billList) bindLongPressDelegated(billList, '.bill-item-row', (el, x, y) => {
    const id = el.getAttribute('data-item-id');
    const item = billItems.find(i => String(i.id) === String(id));
    if (item) window.openBillItemContextMenu(item, x, y);
  });

  const pessoasList = document.getElementById('bill-pessoas-items-list');
  if (pessoasList) bindLongPressDelegated(pessoasList, '[data-item-id]', (el, x, y) => {
    const id = el.getAttribute('data-item-id');
    const item = billItems.find(i => String(i.id) === String(id));
    if (item) window.openBillItemContextMenu(item, x, y);
  });

  const menuList = document.getElementById('menu-list');
  if (menuList) bindLongPressDelegated(menuList, '.menu-item', (el, x, y) => {
    const id = el.getAttribute('data-menu-id');
    const prod = MENU.find(m => String(m.id) === String(id));
    if (prod) window.openProductContextMenu(prod, x, y);
  });
});

// --- Tables Logic ---
function renderTables() {
  const grid = document.getElementById('tables-grid');
  grid.innerHTML = '';
  
  if (MESAS.length === 0) {
    grid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: #888;">Nenhuma mesa cadastrada.</div>';
    return;
  }
  
  MESAS.forEach(mesa => {
    const card = document.createElement('div');
    card.className = 'table-card';
    if (mesa.status === 'Ocupada') card.classList.add('ocupada');
    if (mesa.status === 'Reservada') card.classList.add('reservada');
    
    card.style.position = 'relative';
    
    let cartIndicator = '';
    try {
      const savedCartStr = localStorage.getItem(`chef_cart_${mesa.nome}`);
      if (savedCartStr) {
        const savedCart = JSON.parse(savedCartStr);
        if (Array.isArray(savedCart) && savedCart.length > 0) {
          const badgeCount = savedCart.reduce((sum, i) => sum + i.quantity, 0);
          cartIndicator = `<div class="cart-badge">${badgeCount} <i class="ph ph-shopping-cart"></i></div>`;
        }
      }
    } catch(e){}

    if (contasSolicitadas.has(mesa.nome)) {
      cartIndicator += `<div class="bill-requested-icon" title="Conta Solicitada"><i class="ph ph-receipt"></i></div>`;
    }

    card.innerHTML = `
      ${cartIndicator}
      <i class="ph ph-armchair"></i>
      <span>${escHtml(mesa.nome)}</span>
    `;
    card.onclick = () => {
      if (garcomWasLongPress()) return;
      currentTable = mesa.nome;
      if (mesa.status === 'Ocupada' || mesa.status === 'Reservada') {
        openTableOptions(mesa);
      } else {
        loadCart(mesa.nome);
        showView('menu', `Pedido: ${mesa.nome}`);
        renderMenu();
      }
    };
    grid.appendChild(card);
  });
}

function loadCart(mesaName) {
  try {
    const saved = localStorage.getItem(`chef_cart_${mesaName}`);
    cart = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(cart)) cart = [];
  } catch(e) { cart = []; }
  updateCartBadge();
}

function saveCart(mesaName) {
  try {
    if (Array.isArray(cart) && cart.length > 0) {
      localStorage.setItem(`chef_cart_${mesaName}`, JSON.stringify(cart));
    } else {
      localStorage.removeItem(`chef_cart_${mesaName}`);
    }
  } catch(e) { console.error('Erro ao salvar', e); }
}

window.openTableOptions = (mesa) => {
  currentTable = mesa.nome;
  window.pendingShowBill = false;
  socket.emit('get_itens_mesa', mesa.nome);
  document.getElementById('options-table-name').innerText = mesa.nome;
  showView('table-options', 'Opções da Mesa');
  
  document.getElementById('btn-opt-add').onclick = () => {
    loadCart(mesa.nome);
    showView('menu', `Pedido: ${mesa.nome}`);
    renderMenu();
  };

  document.getElementById('btn-opt-qr').onclick = () => {
    startQRScanner(mesa.nome);
  };
  
  document.getElementById('btn-opt-view').onclick = () => {
    window.pendingShowBill = true;
    socket.emit('get_itens_mesa', mesa.nome);
  };
  
  document.getElementById('btn-opt-bill').onclick = () => {
    if(confirm('Solicitar fechamento da mesa no caixa?')) {
      socket.emit('alerta_pedir_conta', mesa.nome);
      showToast('Fechamento solicitado!', '#f2c94c');
      showView('tables', 'Comanda Mobile');
    }
  };

  const btnMostrarCliente = document.getElementById('btn-opt-mostrar-cliente');
  if (btnMostrarCliente) {
    btnMostrarCliente.onclick = () => {
      window.open('conta-cliente.html?mesa=' + encodeURIComponent(mesa.nome), '_blank');
    };
  }
};

socket.on('toque_pedir_conta', (mesaName) => {
  contasSolicitadas.add(mesaName);
  renderTables();
  showToast(`Conta solicitada: ${mesaName}`, '#f2c94c');
});

socket.on('sync_mesas_fechando', (list) => {
  contasSolicitadas.clear();
  list.forEach(m => contasSolicitadas.add(m));
  renderTables();
});

socket.on('itens_mesa_recebidos', (data) => {
  if (data.mesaName !== currentTable) return;
  const newItems = data.items.map(i => ({ ...i, totalVal: Number(i.total.replace(',','.')) }));
  window.activeComandas = [...new Set(newItems.map(i => i.mesa_comanda).filter(Boolean))];
  
  const isAlreadyInBill = document.getElementById('view-bill').classList.contains('active');
  billItems = newItems;
  
  if (isAlreadyInBill) {
    for (const [id, fraction] of billSelectedItems.entries()) {
      const found = billItems.find(i => i.id === id);
      if (!found || found.status === 'Pago') {
        billSelectedItems.delete(id);
      }
    }
    renderBillView();
  } else if (window.pendingShowBill) {
    window.pendingShowBill = false;
    billSplitCount = 1;
    billSelectedItems.clear();
    document.getElementById('bill-split-count').innerText = '1';
    document.getElementById('bill-service-fee').checked = true;
    document.getElementById('bill-table-name').innerText = currentTable;
    switchBillTab('pessoas');
    renderBillView();
    showView('bill', 'Conta Parcial');
  } else {
    // Just update items in background, do not redirect
  }
});

// --- Bill Logic Functions ---
function getBillGrossTotal() {
  return billItems.reduce((acc, curr) => (curr.totalVal >= 0) ? acc + curr.totalVal : acc, 0);
}

function getBillSubtotal() {
  return billItems.reduce((acc, curr) => (curr.totalVal >= 0 && curr.status !== 'Pago') ? acc + curr.totalVal : acc, 0);
}

function getBillPaymentsTotal() {
  return billItems.reduce((acc, curr) => {
    if (curr.totalVal < 0) {
      const name = curr.productName || '';
      if (name.toLowerCase().includes('comanda')) {
        return acc;
      }
      return acc + Math.abs(curr.totalVal);
    }
    return acc;
  }, 0);
}

function getBillMultiplier() {
  return document.getElementById('bill-service-fee').checked ? 1.1 : 1.0;
}

window.renderBillView = () => {
  const consumedSubtotal = getBillSubtotal();
  const grossSubtotal = getBillGrossTotal();
  const multiplier = getBillMultiplier();
  const serviceFee = consumedSubtotal * (multiplier - 1.0);
  const totalPayments = getBillPaymentsTotal();
  const grandTotal = Math.max(0, consumedSubtotal + serviceFee - totalPayments);
  const totalDaMesa = grossSubtotal * multiplier;

  document.getElementById('bill-subtotal').innerText = `R$ ${totalDaMesa.toFixed(2).replace('.',',')}`;
  document.getElementById('bill-grand-total').innerText = `R$ ${grandTotal.toFixed(2).replace('.',',')}`;

  if (billCurrentMode === 'pessoas') {
    billActionValue = grandTotal / billSplitCount;
    document.getElementById('bill-split-value').innerText = `R$ ${billActionValue.toFixed(2).replace('.',',')}`;
    billSelectedIdsForFinalize = []; // We don't finalize items in this mode
    if (typeof renderBillPessoasItems === 'function') renderBillPessoasItems();
  } else {
    let selSubtotal = 0;
    billSelectedIdsForFinalize = [];
    billItems.forEach(item => {
      if (item.totalVal >= 0 && billSelectedItems.has(item.id)) {
        const fraction = billSelectedItems.get(item.id);
        selSubtotal += item.totalVal * fraction;
        if (fraction === 1) billSelectedIdsForFinalize.push(item.id);
      }
    });
    billActionValue = selSubtotal * multiplier;
    document.getElementById('bill-selected-count').innerText = `R$ ${billActionValue.toFixed(2).replace('.',',')}`;
    renderBillItemsList();
  }

  document.getElementById('bill-action-value').innerText = `R$ ${billActionValue.toFixed(2).replace('.',',')}`;
};

function renderBillPessoasItems() {
  const list = document.getElementById('bill-pessoas-items-list');
  if(!list) return;
  const multiplier = getBillMultiplier();
  if (billItems.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: #888; font-size: 14px; padding: 12px;">Nenhum item.</div>';
    return;
  }
  
  const consumed = billItems.filter(i => i.totalVal >= 0);
  const payments = billItems.filter(i => i.totalVal < 0);

  // Group consumed items: shared vs by comanda
  const sharedGroup = consumed.filter(i => !i.mesa_comanda || i.mesa_comanda.trim() === '');
  const comandaGroups = {};
  consumed.forEach(i => {
    const cName = i.mesa_comanda ? i.mesa_comanda.trim() : '';
    if (cName !== '') {
      if (!comandaGroups[cName]) comandaGroups[cName] = [];
      comandaGroups[cName].push(i);
    }
  });

  let html = '';

  const renderGroupHTML = (title, items, isShared) => {
    if (items.length === 0) return '';
    const headerColor = isShared ? '#7f8c8d' : '#fc4b15';
    const icon = isShared ? 'ph-squares-four' : 'ph-user';
    
    let groupHtml = `
      <div style="font-weight: 700; color: ${headerColor}; font-size: 13px; margin-top: 16px; margin-bottom: 8px; border-bottom: 2px solid ${isShared ? '#bdc3c7' : '#ffd5c2'}; padding-bottom: 4px; display: flex; align-items: center; gap: 6px; text-transform: uppercase;">
        <i class="ph ${icon}"></i> ${title}
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
    `;
    
    groupHtml += items.map(item => {
      const finalVal = item.totalVal * multiplier;
      const isPaid = item.status === 'Pago';
      return `
        <div data-item-id="${item.id}" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; ${isPaid ? 'opacity: 0.5;' : ''}">
          <div style="font-size: 14px; color: #333; ${isPaid ? 'text-decoration: line-through;' : ''}">
            <span style="font-weight: 600;">${item.quantity}x</span> ${item.productEmoji || '🍽️'} ${item.productName}
            ${isPaid ? '<span style="color:#3ab55b; font-size:12px; margin-left:4px;">(Pago)</span>' : ''}
          </div>
          <div style="font-size: 14px; font-weight: 600; color: #666;">R$ ${finalVal.toFixed(2).replace('.', ',')}</div>
        </div>
      `;
    }).join('');
    
    groupHtml += `</div>`;
    return groupHtml;
  };

  html += renderGroupHTML('Consumo da Mesa (Compartilhado)', sharedGroup, true);
  
  Object.keys(comandaGroups).forEach(cName => {
    html += renderGroupHTML(`Comanda: ${cName}`, comandaGroups[cName], false);
  });

  if (payments.length > 0) {
    html += `<div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #fc4b15;">
      <strong style="color: #fc4b15; font-size: 18px; text-transform: uppercase;">Pagamentos Já Realizados:</strong>
    </div>`;
    html += payments.map(item => {
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fff0eb; border-radius: 8px; margin-top: 8px; border: 1px solid #fc4b15;">
          <div style="font-size: 18px; color: #fc4b15; font-weight: bold;"><i class="ph ph-money"></i> ${item.productName}</div>
          <div style="font-size: 18px; font-weight: 900; color: #fc4b15;">- R$ ${Math.abs(item.totalVal).toFixed(2).replace('.', ',')}</div>
        </div>
      `;
    }).join('');
  }
  if(typeof morphdom !== 'undefined') morphdom(list, '<div>'+html+'</div>', {childrenOnly:true}); else list.innerHTML = html;
}

function renderBillItemsList() {
  const list = document.getElementById('bill-items-list');
  const multiplier = getBillMultiplier();
  
  if (billItems.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Nenhum item em andamento.</div>';
    return;
  }

  const consumed = billItems.filter(i => i.totalVal >= 0);
  const payments = billItems.filter(i => i.totalVal < 0);

  // Group consumed items: shared vs by comanda
  const sharedGroup = consumed.filter(i => !i.mesa_comanda || i.mesa_comanda.trim() === '');
  const comandaGroups = {};
  consumed.forEach(i => {
    const cName = i.mesa_comanda ? i.mesa_comanda.trim() : '';
    if (cName !== '') {
      if (!comandaGroups[cName]) comandaGroups[cName] = [];
      comandaGroups[cName].push(i);
    }
  });

  let html = '';

  const renderGroupHTML = (title, items, isShared) => {
    if (items.length === 0) return '';
    const headerColor = isShared ? '#7f8c8d' : '#fc4b15';
    
    let groupHtml = `
      <div style="font-weight: 700; color: ${headerColor}; font-size: 13px; margin-top: 16px; margin-bottom: 8px; border-bottom: 2px solid ${isShared ? '#bdc3c7' : '#ffd5c2'}; padding-bottom: 4px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; grid-column: 1 / -1;">
        <i class="ph ${isShared ? 'ph-squares-four' : 'ph-user'}"></i> ${title}
      </div>
    `;
    
    groupHtml += items.map(item => {
      const isPaid = item.status === 'Pago';
      const fraction = billSelectedItems.get(item.id) || 0;
      const isSelected = fraction > 0 && !isPaid;
      const finalVal = item.totalVal * multiplier;
      
      return `
        <div class="bill-item-row ${isSelected ? 'selected' : ''}" data-item-id="${item.id}" style="${isPaid ? 'opacity: 0.6; background: #f0f0f0;' : ''}" onclick="${isPaid ? '' : `if(!garcomWasLongPress()) toggleBillItem(${item.id});`}">
          <div class="checkbox">${isPaid ? '<i class="ph ph-check-circle" style="color:#3ab55b; font-size:16px;"></i>' : (isSelected ? (fraction === 1 ? '<i class="ph ph-check"></i>' : '<span style="font-size:10px;">1/2</span>') : '')}</div>
          <div style="flex:1; ${isPaid ? 'text-decoration: line-through;' : ''}">
            <div style="font-weight:600; color:#333;">${item.quantity}x ${item.productEmoji || '🍽️'} ${item.productName} ${isPaid ? '<span style="color:#3ab55b; font-size:12px; margin-left:8px;">(Pago)</span>' : ''}</div>
            <div style="font-size:14px; color:#666;">Total: R$ ${finalVal.toFixed(2).replace('.',',')}</div>
          </div>
          ${!isPaid ? `<button class="btn-split-item ${fraction === 0.5 ? 'active' : ''}" onclick="event.stopPropagation(); splitItemFraction(${item.id})">
            ${fraction === 0.5 ? 'Metade' : 'Rachar Meio'}
          </button>` : ''}
        </div>
      `;
    }).join('');
    
    return groupHtml;
  };

  html += renderGroupHTML('Consumo da Mesa (Compartilhado)', sharedGroup, true);
  
  Object.keys(comandaGroups).forEach(cName => {
    html += renderGroupHTML(`Comanda: ${cName}`, comandaGroups[cName], false);
  });

  if (payments.length > 0) {
    html += `<div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #fc4b15; grid-column: 1 / -1;">
      <strong style="color: #fc4b15; font-size: 18px; text-transform: uppercase;">Pagamentos Já Realizados:</strong>
      <div style="font-size: 14px; color: #888;">O valor restante já está sendo calculado para fechar a conta.</div>
    </div>`;
    html += payments.map(item => {
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #fff0eb; border-radius: 8px; margin-top: 8px; border: 1px solid #fc4b15; grid-column: 1 / -1;">
          <div style="font-size: 18px; color: #fc4b15; font-weight: bold;"><i class="ph ph-money"></i> ${item.productName}</div>
          <div style="font-size: 18px; font-weight: 900; color: #fc4b15;">- R$ ${Math.abs(item.totalVal).toFixed(2).replace('.', ',')}</div>
        </div>
      `;
    }).join('');
  }
  if(typeof morphdom !== 'undefined') morphdom(list, '<div>'+html+'</div>', {childrenOnly:true}); else list.innerHTML = html;
}

window.toggleBillItem = (id) => {
  if (billSelectedItems.has(id)) {
    billSelectedItems.delete(id);
  } else {
    billSelectedItems.set(id, 1); // Select 100%
  }
  renderBillView();
};

window.splitItemFraction = (id) => {
  if (billSelectedItems.get(id) === 1) {
    billSelectedItems.set(id, 0.5); // Half
  } else if (billSelectedItems.get(id) === 0.5) {
    billSelectedItems.set(id, 1); // Back to full
  }
  renderBillView();
};

window.switchBillTab = (tab) => {
  billCurrentMode = tab;
  document.querySelectorAll('.bill-tab').forEach(t => {
    t.classList.remove('active');
    t.style.background = 'transparent'; t.style.color = '#666';
  });
  document.getElementById(`tab-bill-${tab}`).classList.add('active');
  document.getElementById(`tab-bill-${tab}`).style.color = '#fc4b15';
  
  document.querySelectorAll('.bill-content').forEach(c => c.style.display = 'none');
  document.getElementById(`bill-content-${tab}`).style.display = 'block';
  
  renderBillView();
};

window.changeSplitCount = (dir) => {
  billSplitCount += dir;
  if (billSplitCount < 1) billSplitCount = 1;
  document.getElementById('bill-split-count').innerText = billSplitCount;
  renderBillView();
};

window.toggleServiceFee = () => {
  const cb = document.getElementById('bill-service-fee');
  cb.checked = !cb.checked;
  const icon = document.getElementById('icon-service');
  if (cb.checked) {
    icon.classList.remove('ph');
    icon.classList.add('ph-fill');
    icon.style.color = '#fc4b15';
    showToast('Taxa de 10% adicionada', '#fc4b15');
  } else {
    icon.classList.remove('ph-fill');
    icon.classList.add('ph');
    icon.style.color = '#ccc';
    showToast('Taxa de 10% removida', '#888');
  }
  renderBillView();
};

window.updateCustomPaymentValue = (val) => {
  if (val === undefined || val === null) return;
  let num = parseFloat(String(val).replace(',', '.'));
  if (!isNaN(num) && num >= 0) billActionValue = num;
};

// --- Payment Modal ---
window.openPaymentModal = () => {
  const inputEl = document.getElementById('payment-input-value');
  if (inputEl && inputEl.value) {
    let num = parseFloat(String(inputEl.value).replace(',', '.'));
    if (!isNaN(num) && num > 0) billActionValue = num;
  }

  if (billActionValue <= 0) return alert('O valor a receber deve ser maior que zero!');
  
  const consumedSubtotal = getBillSubtotal();
  const grossSubtotal = getBillGrossTotal();
  const multiplier = getBillMultiplier();
  const serviceFee = consumedSubtotal * (multiplier - 1.0);
  const totalPayments = getBillPaymentsTotal();
  const grandTotal = Math.max(0, consumedSubtotal + serviceFee - totalPayments);
  
  if (billActionValue > grandTotal + 0.05) {
    alert(`Atenção: O saldo restante da mesa é apenas R$ ${grandTotal.toFixed(2).replace('.',',')}. O valor a pagar será ajustado para o restante da conta.`);
    billActionValue = grandTotal;
  }
  
  if (inputEl) inputEl.value = billActionValue.toFixed(2).replace('.',',');
  document.getElementById('payment-modal').style.display = 'flex';
};

window.closePaymentModal = () => {
  document.getElementById('payment-modal').style.display = 'none';
};

window.processPayment = (method) => {
  const inputEl = document.getElementById('payment-input-value');
  if (inputEl && inputEl.value) {
    let num = parseFloat(String(inputEl.value).replace(',', '.'));
    if (!isNaN(num) && num > 0) billActionValue = num;
  }

  if (!billActionValue || billActionValue <= 0) {
    return alert('O valor a receber deve ser maior que zero!');
  }

  if (method === 'Dinheiro') {
    const mod10 = billActionValue % 10;
    const mod5 = billActionValue % 5;
    let ajudaText = '';
    if (mod5 > 0 && mod5 < 5) ajudaText += `\n- Dar +R$ ${mod5.toFixed(2).replace('.',',')} -> troco arredonda!`;
    if (mod10 !== mod5 && mod10 > 0) ajudaText += `\n- Dar +R$ ${mod10.toFixed(2).replace('.',',')} -> troco arredonda!`;

    const inputVal = prompt(`O valor a cobrar é R$ ${billActionValue.toFixed(2).replace('.', ',')}.${ajudaText}\n\nQuanto o cliente entregou em dinheiro? (Deixe em branco se foi o valor exato)`);
    if (inputVal === null) return; // Cancelou
    
    if (inputVal.trim() !== '') {
      const valorRecebido = parseFloat(inputVal.replace(',', '.'));
      if (isNaN(valorRecebido) || valorRecebido < billActionValue) {
         alert('Atenção: O valor entregue pelo cliente é menor que o valor a ser cobrado!');
         return;
      }
      
      const troco = valorRecebido - billActionValue;
      if (troco > 0) {
         if (confirm(`TROCO: R$ ${troco.toFixed(2).replace('.', ',')}\n\nO cliente deseja deixar esse troco como Caixinha / Gorjeta para os funcionários?`)) {
            socket.emit('movimentacao_caixa', {
               tipo: 'Entrada',
               valor: troco,
               forma_pagamento: method,
               descricao: `Caixinha / Gorjeta: ${currentTable}`
            });
            if (typeof trackInsertion === 'function') trackInsertion();
            alert(`✅ Caixinha de R$ ${troco.toFixed(2).replace('.',',')} registrada no caixa! Processando o pagamento principal...`);
         } else {
            alert(`✅ COBRANÇA APROVADA!\n\nDEVOLVA DE TROCO: R$ ${troco.toFixed(2).replace('.', ',')}`);
         }
      }
    }
  } else {
    if (!confirm(`Confirmar recebimento de R$ ${billActionValue.toFixed(2).replace('.', ',')} no ${method}?`)) return;
  }
  
  const paymentObj = { metodo: method, valor: billActionValue };
  
  const consumedSubtotal = getBillSubtotal();
  const grossSubtotal = getBillGrossTotal();
  const multiplier = getBillMultiplier();
  const serviceFee = consumedSubtotal * (multiplier - 1.0);
  const totalPayments = getBillPaymentsTotal();
  const grandTotal = Math.max(0, consumedSubtotal + serviceFee - totalPayments);
  const isFullTable = Math.abs(billActionValue - grandTotal) < 0.05;

  if (isFullTable) {
    const chkEmitir = document.getElementById('mobile-payment-emitir-nfce');
    const inputCpf = document.getElementById('mobile-payment-cpf-cnpj');
    socket.emit('finalizar_mesa', {
      mesaName: currentTable,
      payments: [paymentObj],
      totalValue: billActionValue,
      emitirNfce: chkEmitir ? chkEmitir.checked : true,
      cpfCnpj: inputCpf ? inputCpf.value.trim() : ''
    });
    if (typeof trackInsertion === 'function') trackInsertion();
    showToast('Mesa fechada com sucesso!');
    closePaymentModal();
    showView('tables', 'Comanda Mobile');
    return;
  }
  
  // Se for "Por Itens" e selecionou itens inteiros: a gente pode mandar pro servidor finalizar_parcial_mesa!
  if (billCurrentMode === 'itens' && billSelectedIdsForFinalize.length > 0) {
    // E se houver outros que foram rachados no meio? Os marcados pela metade no podem ser finalizados (o valor cobrado vai cobrir eles na gaveta)
    // Ento lanamos o recebimento e finalizamos s os itens inteiros!
    socket.emit('finalizar_parcial_mesa', {
      mesaName: currentTable,
      pedidoIds: billSelectedIdsForFinalize,
      payments: [paymentObj]
    });
    if (typeof trackInsertion === 'function') trackInsertion();
  } else {
    // movimentacao_caixa REMOVED — pagamento_parcial_valor already inserts into movimentacoes via socket-financeiro.js
    const billFeeChk = document.getElementById('bill-service-fee');
    socket.emit('pagamento_parcial_valor', {
      mesaName: currentTable,
      valor: billActionValue,
      metodo: method,
      comTaxa: billFeeChk ? billFeeChk.checked : true,
      userName: loggedUser ? loggedUser.nome : 'Sistema'
    });
    if (typeof trackInsertion === 'function') trackInsertion();
  }
  
  showToast(`R$ ${billActionValue.toFixed(2)} recebido com sucesso!`);
  closePaymentModal();
  socket.emit('get_itens_mesa', currentTable); // refresh items list
};

// --- Menu Logic ---
window.scrollToActiveTab = function() {
  const tabsContainer = document.getElementById('menu-tabs');
  if (!tabsContainer) return;
  setTimeout(() => {
    const activeTab = tabsContainer.querySelector('.tab.active');
    if (!activeTab) return;
    const containerWidth = tabsContainer.clientWidth;
    const tabLeft = activeTab.offsetLeft;
    const tabWidth = activeTab.offsetWidth;
    const targetScrollLeft = tabLeft - (containerWidth / 2) + (tabWidth / 2);
    tabsContainer.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth'
    });
  }, 30);
};

window.renderMenu = function renderMenu() {
  const tabsContainer = document.getElementById('menu-tabs');
  tabsContainer.innerHTML = TABS.map(tab => `
    <div class="tab ${tab === currentTab ? 'active' : ''}" onclick="selectTab('${tab}')">${tab}</div>
  `).join('');
  window.scrollToActiveTab();

  const listContainer = document.getElementById('menu-list');
  const query = window.garcomSearchQuery || '';
  let filtered = [];
  if (query.trim() !== '') {
    filtered = window.FuzzySearch.filter(MENU, query.trim(), (m) => [m.name, m.category || '']);
  } else {
    filtered = MENU.filter(m => m.category === currentTab);
  }
  
  if (filtered.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Nenhum produto nesta categoria.</div>';
    return;
  }
  
  listContainer.innerHTML = filtered.map(item => `
    <div class="menu-item" data-menu-id="${item.id}" onclick="if(!garcomWasLongPress()) openDetails(${item.id})">
      <div class="img-box">${escHtml(item.emoji)}</div>
      <div class="menu-item-info">
        <div class="menu-item-name">${escHtml(item.name)}</div>
        <div class="menu-item-price">R$ ${item.price.toFixed(2).replace('.', ',')}</div>
      </div>
    </div>
  `).join('');
}

window.selectTab = (tab) => {
  currentTab = tab;
  const searchInput = document.getElementById('garcom-search-product');
  if (searchInput && searchInput.value) {
    searchInput.value = '';
    window.garcomSearchQuery = '';
    const clearBtn = document.getElementById('garcom-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
  }
  renderMenu();
};

window.openDetails = (id) => {
  selectedProduct = MENU.find(m => m.id === id);
  selectedQty = 1;
  selectedAddons.clear();
  
  document.getElementById('detail-img').innerText = selectedProduct.emoji;
  document.getElementById('detail-name').innerText = selectedProduct.name;
  document.getElementById('detail-qty').innerText = selectedQty;
  document.getElementById('detail-obs').value = '';
  
  const addonsSec = document.getElementById('detail-addons');
  addonsSec.style.display = 'none';
  
  renderSuggestions(selectedProduct);
  updateDetailPrice();
  showView('details', 'Detalhes do Item');
};

window.addDirectToCart = (id) => {
  const prod = MENU.find(m => m.id === id);
  if (!prod) return;
  cart.push({
    productName: prod.name,
    productEmoji: prod.emoji,
    sector: prod.sector,
    quantity: 1,
    obs: '',
    addons: [],
    total: prod.price,
    status: 'Recebido',
    localName: currentTable,
    userName: loggedUser.nome,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now()
  });
  saveCart(currentTable);
  updateCartBadge();
  showToast(`${prod.name} adicionado ao carrinho!`, '#3ab55b');
};

function renderSuggestions(product) {
  const sugSection = document.getElementById('detail-suggestions');
  const sugList = document.getElementById('sugestoes-list');
  
  let pool = MENU.filter(m => m.category !== product.category);
  
  if (!product.category.toLowerCase().includes('bebida')) {
     const bebidas = pool.filter(m => m.category.toLowerCase().includes('bebida'));
     if (bebidas.length > 0) pool = bebidas;
  }
  
  pool = pool.sort(() => 0.5 - Math.random()).slice(0, 4); // Show up to 4 items
  
  if (pool.length === 0) {
    sugSection.style.display = 'none';
    return;
  }
  
  sugSection.style.display = 'block';
  sugList.innerHTML = pool.map(item => `
    <div class="suggestion-card">
      <div class="sug-img">${item.emoji}</div>
      <div class="sug-name" title="${item.name}">${item.name}</div>
      <div class="sug-price">R$ ${item.price.toFixed(2).replace('.', ',')}</div>
      <button onclick="addDirectToCart(${item.id})" style="margin-top:8px; width:100%; padding:6px; background:#eaf8ef; color:#3ab55b; border:1px solid #3ab55b; border-radius:6px; font-weight:bold; cursor:pointer;">+ Adicionar</button>
    </div>
  `).join('');
}

document.getElementById('btn-plus').onclick = () => { selectedQty++; document.getElementById('detail-qty').innerText = selectedQty; updateDetailPrice(); };
document.getElementById('btn-minus').onclick = () => { if(selectedQty > 1) { selectedQty--; document.getElementById('detail-qty').innerText = selectedQty; updateDetailPrice(); } };

function updateDetailPrice() {
  document.getElementById('detail-unit-price').innerText = `R$ ${selectedProduct.price.toFixed(2).replace('.', ',')}`;
  document.getElementById('detail-total-price').innerText = `R$ ${(selectedProduct.price * selectedQty).toFixed(2).replace('.', ',')}`;
}

document.getElementById('btn-add-to-cart').onclick = () => {
  cart.push({
    productName: selectedProduct.name,
    productEmoji: selectedProduct.emoji,
    sector: selectedProduct.sector,
    quantity: selectedQty,
    obs: document.getElementById('detail-obs').value,
    total: selectedProduct.price * selectedQty,
    status: 'Recebido',
    localName: currentTable,
    userName: loggedUser.nome,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    addons: []
  });
  saveCart(currentTable);
  updateCartBadge();
  showView('menu', `Pedido: ${currentTable}`);
};

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (cart.length > 0) {
    badge.style.display = 'flex';
    badge.innerText = cart.length;
  } else {
    badge.style.display = 'none';
  }
}

document.getElementById('fab-cart').onclick = () => {
  if (cart.length === 0) return alert('Carrinho vazio!');
  renderCart();
  showView('cart', 'Revisar Pedido');
};

function renderCart() {
  const list = document.getElementById('cart-list');
  let total = 0;
  list.innerHTML = cart.map((item, idx) => {
    total += item.total;
    const allComandas = [...new Set([
      ...(window.activeComandas || []),
      ...(window.newComandasMap ? Array.from(window.newComandasMap.keys()) : [])
    ])];
    
    return `
      <div class="cart-item" style="padding: 16px; background: #fff; border: 1px solid #eee; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
        <div style="display:flex; justify-content:space-between; margin-bottom: 6px; align-items: center;">
          <strong style="font-size: 16px; color: #333;">${item.quantity}x ${item.productName}</strong>
          <strong style="color: #fc4b15; font-size: 16px;">R$ ${item.total.toFixed(2).replace('.',',')}</strong>
        </div>
        ${item.obs ? `<div style="font-size: 13px; color: #777; margin-bottom: 8px; background: #f9f9f9; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #ddd;">Obs: ${item.obs}</div>` : ''}
        
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #eee;">
          <span style="font-size: 13px; color: #666; font-weight: 500;">Comanda/Cliente:</span>
          <select onchange="window.changeItemComanda(${idx}, this.value)" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; outline: none; background: #fff; color: #333; font-weight: 500; max-width: 180px;">
            <option value="">Mesa (Compartilhado)</option>
            ${allComandas.map(c => `<option value="${c}" ${item.mesa_comanda === c ? 'selected' : ''}>${c}</option>`).join('')}
            <option value="__NEW__" style="color: #fc4b15; font-weight: bold;">+ Nova Comanda...</option>
          </select>
        </div>
        
        <div style="text-align: right; margin-top: 10px;">
          <button onclick="removeFromCart(${idx})" style="background: none; border: none; color: #999; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;"><i class="ph ph-trash"></i> Remover</button>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('cart-total-value').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

window.removeFromCart = (idx) => {
  cart.splice(idx, 1);
  saveCart(currentTable);
  updateCartBadge();
  if (cart.length === 0) showView('menu', `Pedido: ${currentTable}`);
  else renderCart();
};

document.getElementById('btn-send-order').onclick = () => {
  if (cart.length === 0) return alert('Carrinho vazio!');
  
  const orderComandaInput = document.getElementById('order-comanda') ? document.getElementById('order-comanda').value.trim() : '';

  cart.forEach(item => {
    const comandaName = item.mesa_comanda || orderComandaInput;
    const phone = comandaName ? (window.newComandasMap ? window.newComandasMap.get(comandaName) : '') : '';
    const emitItem = { 
      ...item, 
      total: item.total.toFixed(2).replace('.', ','),
      mesa_comanda: comandaName,
      cliente_telefone: phone || ''
    };
    socket.emit('novo_pedido', emitItem);
  });
  if (typeof trackInsertion === 'function') trackInsertion();
  cart = [];
  window.newComandasMap = new Map();
  if (document.getElementById('order-comanda')) {
    document.getElementById('order-comanda').value = '';
  }
  saveCart(currentTable);
  updateCartBadge();
  showToast('Pedido enviado com sucesso!');
  showView('tables', 'Comanda Mobile');
};

// --- Esteira ---
let prontosAnterioresIds = [];
const chamadasReclamadas = new Map();

socket.on('pedidos_atualizados', () => {
  if (loggedUser) socket.emit('get_esteira', loggedUser.nome);
  if (currentTable && document.getElementById('view-bill').classList.contains('active')) {
    socket.emit('get_itens_mesa', currentTable);
  }
});

socket.on('esteira_atualizada', (pedidos) => {
  const esteira = document.getElementById('esteira-list');
  const prontos = pedidos;
  const novosIds = prontos.map(p => p.id);
  const idsNovos = novosIds.filter(id => !prontosAnterioresIds.includes(id));
  prontosAnterioresIds = novosIds;

  const badge = document.getElementById('esteira-badge');
  if (badge) {
    badge.style.display = (prontos.length > 0) ? 'block' : 'none';
  }

  var pendentes = [];
  try {
    var chave = "chef_pendentes_" + (loggedUser ? loggedUser.nome : "local");
    pendentes = JSON.parse(localStorage.getItem(chave) || "[]");
    if (!Array.isArray(pendentes)) pendentes = [];
  } catch(e) { pendentes = []; }

  var html = '';

  if (pendentes.length > 0) {
    html += '<div style="font-size:12px;font-weight:800;color:#b45309;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:6px;"><i class="ph ph-clock"></i> Atividades Pendentes</div>';
    html += pendentes.map(function(p, idx) {
      var tempo = Math.floor((Date.now() - (p.criadoEm || 0)) / 60000);
      var tempoTxt = tempo < 1 ? 'agora' : tempo + 'min';
      return '<div style="background:#fffbeb;border:1px solid #fde68a;padding:12px;border-radius:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">' +
        '<div style="flex:1;font-size:13px;color:#92400e;font-weight:600;">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;"><i class="ph ph-clock" style="color:#b45309;"></i> ' + tempoTxt + '</div>' +
          '<div style="font-size:12px;color:#78716c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">' + (p.texto || 'Atividade pendente') + '</div>' +
        '</div>' +
        '<button onclick="window.marcarPendenteResolvido(' + idx + ')" style="background:#22c55e;color:white;border:none;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;white-space:nowrap;">Feito</button>' +
      '</div>';
    }).join('');
  }

  if (prontos.length === 0 && pendentes.length === 0) {
    esteira.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Nenhum pedido pronto.</div>';
    return;
  }

  if (prontos.length > 0) {
    if (pendentes.length > 0) {
      html += '<div style="font-size:12px;font-weight:800;color:#15803d;margin:12px 0 8px;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:6px;"><i class="ph ph-check-circle"></i> Prontos para Entrega</div>';
    }
    html += prontos.map(p => {
      const isPdv = p.tipo === 'pdv';
      const isChamada = p.userName === 'Chamada';
      const isCalled = !!(p.garcom_call) || isChamada;
      const borderColor = isPdv ? '#f97316' : (isCalled ? '#8b5cf6' : '#3ab55b');
      const icon = isPdv ? 'ph-hand-waving' : (isCalled ? 'ph-bell-ringing' : 'ph-table');
      const iconColor = isPdv ? '#f97316' : (isCalled ? '#8b5cf6' : '#fc4b15');
      const locationLabel = isPdv ? `📋 ${p.localName}` : (isChamada ? `🔔 ${p.localName}` : p.localName);
      const isNew = idsNovos.includes(p.id);
      const blinkClass = isNew ? (isChamada ? 'pronto-blink-orange' : 'pronto-blink') : '';
      const claimedBy = isPdv ? p.targetGarcom : (isChamada ? chamadasReclamadas.get(p.id) : null);

      let tempoPronto = '';
      if (p.prontoEm) {
        const diffSec = Math.floor((Date.now() - new Date(p.prontoEm).getTime()) / 1000);
        if (diffSec < 60) tempoPronto = `${diffSec}s`;
        else if (diffSec < 3600) tempoPronto = `${Math.floor(diffSec / 60)}min`;
        else tempoPronto = `${Math.floor(diffSec / 3600)}h${Math.floor((diffSec % 3600) / 60)}m`;
      } else if (p.createdAt) {
        const diffSec = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 1000);
        if (diffSec < 60) tempoPronto = `${diffSec}s`;
        else if (diffSec < 3600) tempoPronto = `${Math.floor(diffSec / 60)}min`;
        else tempoPronto = `${Math.floor(diffSec / 3600)}h${Math.floor((diffSec % 3600) / 60)}m`;
      }

      // For QR code chamada calls accepted by this waiter: hide the card immediately (no "Entregar" step)
      if (isChamada && chamadasReclamadas.get(p.id) === loggedUser?.nome) return '';

      let btnHtml = '';
      if (isPdv) {
        if (!p.targetGarcom) {
          btnHtml = `<button onclick="aceitarChamadoPdv(${escJs(p.localName)})" style="background:#f97316;color:white;border:none;padding:12px 18px;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;"><i class="ph ph-arrow-right" style="font-size:18px;"></i> IR</button>`;
        } else if (p.targetGarcom === loggedUser?.nome) {
          btnHtml = `<button onclick="marcarEntregue('${p.id}')" style="background:#16a34a;color:white;border:none;padding:12px 18px;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;"><i class="ph ph-check-circle" style="font-size:18px;"></i> Entregar</button>`;
        } else {
          btnHtml = `<div style="background:#fef3c7;color:#92400e;border:none;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:4px;"><i class="ph ph-user-check"></i> ${p.targetGarcom}</div>`;
        }
      } else if (isChamada && claimedBy && claimedBy !== loggedUser?.nome) {
        // Another waiter already accepted this QR call
        btnHtml = `<div style="background:#fef3c7;color:#92400e;border:none;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:4px;"><i class="ph ph-user-check"></i> ${claimedBy}</div>`;
      } else if (isChamada) {
        // QR code waiter call — "IR" disappears card immediately (no Entregar step)
        btnHtml = `<button onclick="irChamadaQR(${p.id}, ${escJs(p.localName || '')})" style="background:#8b5cf6;color:white;border:none;padding:12px 18px;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;"><i class="ph ph-arrow-right" style="font-size:18px;"></i> IR</button>`;
      } else if (isCalled) {
        // Regular garcom_call — Buscar flow (keeps Entregar step)
        btnHtml = `<button onclick="buscarChamada(${p.id}, ${escJs(p.productName || '')}, ${escJs(p.localName || '')})" style="background:#8b5cf6;color:white;border:none;padding:12px 18px;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;"><i class="ph ph-walk" style="font-size:18px;"></i> Buscar</button>`;
      } else {
        btnHtml = `<button onclick="marcarEntregue(${p.id})" style="background:${borderColor};color:white;border:none;padding:12px 18px;border-radius:10px;font-weight:bold;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;"><i class="ph ph-check-circle" style="font-size:18px;"></i> Entregar</button>`;
      }

      const cardBg = isCalled ? '#7c3aed' : (isPdv ? '#fff7ed' : 'white');
      const textColor = isCalled ? 'white' : '#1e293b';
      const subTextColor = isCalled ? '#e9d5ff' : '#475569';
      const tagBg = isCalled ? 'rgba(255,255,255,0.2)' : (isPdv ? '#fff5f0' : '#fff5f0');
      const tagColor = isCalled ? 'white' : '#fc4b15';

      return `
    <div data-id="${p.id}" class="${blinkClass}" style="background: ${cardBg}; padding: 16px; border-radius: 12px; margin-bottom: 12px; border-left: 5px solid ${borderColor}; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      <div>
        <div style="font-size: 18px; font-weight: 800; color: ${textColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
          <i class="ph ${icon}" style="color: ${iconColor};"></i>
          <span>${locationLabel}</span>
          ${p.mesa_comanda ? `<span style="background: ${tagBg}; color: ${tagColor}; border: 1px solid ${isCalled ? 'rgba(255,255,255,0.3)' : '#ffcca8'}; padding: 2px 8px; border-radius: 8px; font-size: 14px; font-weight: 700;">(${escHtml(p.mesa_comanda)})</span>` : ''}
          ${isNew ? `<span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Novo</span>` : ''}
          ${claimedBy && claimedBy !== loggedUser?.nome ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700;">👤 ${escHtml(claimedBy)}</span>` : ''}
        </div>
        <div style="color: ${subTextColor}; font-size: 15px; font-weight: 600;">${p.quantity}x ${escHtml(p.productEmoji || '')} ${escHtml(p.productName)}</div>
        ${tempoPronto ? `<div style="color: ${isCalled ? '#fbbf24' : (isChamada ? '#c2410c' : '#15803d')}; font-size: 12px; font-weight: 700; margin-top: 4px; display: flex; align-items: center; gap: 4px;"><i class="ph ph-clock"></i> Pronto há ${tempoPronto}</div>` : ''}
        ${(() => {
          if (p.prontoEm && p.createdAt) {
            const prepSec = Math.floor((new Date(p.prontoEm).getTime() - new Date(p.createdAt).getTime()) / 1000);
            if (prepSec > 0) {
              let tempoPrep = '';
              if (prepSec < 60) tempoPrep = `${prepSec}s`;
              else if (prepSec < 3600) tempoPrep = `${Math.floor(prepSec / 60)}min${prepSec % 60 ? ' ' + (prepSec % 60) + 's' : ''}`;
              else tempoPrep = `${Math.floor(prepSec / 3600)}h${Math.floor((prepSec % 3600) / 60)}min`;
              return `<div style="color: ${isCalled ? '#e9d5ff' : (isPdv ? '#c2410c' : '#1d4ed8')}; font-size: 11px; font-weight: 600; margin-top: 2px; display: flex; align-items: center; gap: 4px;"><i class="ph ph-stopwatch"></i> Preparo: ${tempoPrep}</div>`;
            }
          }
          return '';
        })()}
      </div>
      ${btnHtml}
    </div>
  `;
    }).join('');
  }

  esteira.innerHTML = html;
});

window.marcarEntregue = (id) => {
  if(!loggedUser) return;
  socket.emit('marcar_entregue', { id, userName: loggedUser.nome });
};

window.aceitarChamadoPdv = (localName) => {
  if(!loggedUser) return;
  socket.emit('garcom_aceitou_chamado', { localName, garcomNome: loggedUser.nome });
};

window.buscarChamada = (pedidoId, productName, localName) => {
  if(!loggedUser) return;
  chamadasReclamadas.set(pedidoId, loggedUser.nome);
  socket.emit('garcom_buscando', { pedidoId, garcomNome: loggedUser.nome, localName, productName });
  showToast(`✅ Indo buscar ${productName} - ${localName}`, '#8b5cf6');
};

// For QR code chamada calls: IR button makes card vanish immediately
window.irChamadaQR = (pedidoId, localName) => {
  if (!loggedUser) return;
  chamadasReclamadas.set(pedidoId, loggedUser.nome); // hides card on next render
  socket.emit('garcom_buscando', { pedidoId, garcomNome: loggedUser.nome, localName, productName: 'Chamado' });
  showToast(`✅ Indo até ${localName}`, '#8b5cf6');
  // Immediately request fresh esteira so card disappears right away
  socket.emit('get_esteira', loggedUser.nome);
};

window.marcarPendenteResolvido = (idx) => {
  try {
    var chave = "chef_pendentes_" + (loggedUser ? loggedUser.nome : "local");
    var lista = JSON.parse(localStorage.getItem(chave) || "[]");
    if (Array.isArray(lista) && idx >= 0 && idx < lista.length) {
      lista.splice(idx, 1);
      localStorage.setItem(chave, JSON.stringify(lista));
    }
    if (loggedUser) socket.emit('get_esteira', loggedUser.nome);
  } catch(e) {}
};

document.getElementById('nav-mesas').onclick = () => showView('tables', 'Comanda Mobile');
document.getElementById('nav-esteira').onclick = () => showView('esteira', 'Prontos para Entrega');

// --- QR CODE SCANNER LOGIC ---
let html5QrCode = null;

window.startQRScanner = (mesaName) => {
  document.getElementById('qr-modal').style.display = 'flex';
  
  if (typeof Html5Qrcode === 'undefined') {
    document.getElementById('qr-modal').style.display = 'none';
    showToast('Leitor de QR indisponível (biblioteca não carregada).', '#e74c3c');
    return;
  }

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("qr-reader");
  }

  html5QrCode.start(
    { facingMode: "environment" }, // Usa a câmera traseira do celular/tablet
    {
      fps: 15, // Mais frames por segundo para leitura rápida
      qrbox: { width: 250, height: 250 }
    },
    (decodedText, decodedResult) => {
      // Ao ler com sucesso
      html5QrCode.stop().catch(e => console.error(e));
      document.getElementById('qr-modal').style.display = 'none';
      
      // Emitir para o servidor validar o cupom
      socket.emit('validar_cupom', { mesaName: mesaName, codigo: decodedText, userName: loggedUser ? loggedUser.nome : 'Garçom' });
      showToast('Validando cupom...', '#f2c94c');
    },
    (errorMessage) => {
      // Ignorar erros de scan contínuos
    }
  ).catch((err) => {
    console.error("Erro ao iniciar câmera", err);
  });
};

window.closeQRScanner = () => {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
    }).catch(e => console.error(e));
  }
  document.getElementById('qr-modal').style.display = 'none';
};

socket.on('cupom_sucesso', (data) => {
  showToast(data.mensagem || 'Cupom aplicado!', '#3ab55b');
  playDing();
  showView('tables', 'Comanda Mobile'); // Retorna para a lista de mesas/atualiza
});

socket.on('cupom_invalido', (data) => {
  alert('Erro ao resgatar: ' + data.error);
});

socket.on('pedido_pronto', (pedido) => {
  if (loggedUser) {
    const escopo = localStorage.getItem('esteira-som-escopo') || (CONFIGS && CONFIGS['esteira-som-escopo']) || 'todos';
    const isOwnOrder = pedido.userName === loggedUser.nome;
    const shouldPlaySound = (escopo === 'todos') || isOwnOrder;

    const comandaLabel = pedido.mesa_comanda ? ` - (${pedido.mesa_comanda})` : '';

    if (shouldPlaySound) {
      showToast(`🔔 PEDIDO PRONTO! ${pedido.quantity || 1}x ${pedido.productName || 'Item'} (${pedido.localName}${comandaLabel})`, '#22c55e');
      if (typeof playChamarGarcom === 'function') playChamarGarcom();
      if (typeof playDing === 'function') playDing();
    }
    socket.emit('get_esteira', loggedUser.nome);

    const bellBtn = document.getElementById('nav-esteira');
    if (bellBtn && shouldPlaySound) {
      const bellIcon = bellBtn.querySelector('i');
      if (bellIcon) {
        bellIcon.classList.remove('bell-shake');
        void bellIcon.offsetWidth;
        bellIcon.classList.add('bell-shake');
        bellIcon.addEventListener('animationend', () => bellIcon.classList.remove('bell-shake'), { once: true });
      }
    }
    const badge = document.getElementById('esteira-badge') || document.getElementById('prontos-badge');
    if (badge) {
      badge.style.display = 'block';
      badge.classList.remove('badge-glow');
      void badge.offsetWidth;
      badge.classList.add('badge-glow');
      badge.addEventListener('animationend', () => badge.classList.remove('badge-glow'), { once: true });
    }

    if (shouldPlaySound && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('🔔 Pedido Pronto!', {
        body: `${pedido.quantity || 1}x ${pedido.productName} - ${pedido.localName}${comandaLabel}`,
        tag: `pronto-${pedido.id}`,
        requireInteraction: true
      });
    }
  }
});

let activeAcceptModal = null;

function showAcceptNotification(data) {
  const existing = document.getElementById('garcom-accept-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'garcom-accept-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:200000;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:20px;padding:28px;max-width:360px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:modalPop 0.2s ease;';

  box.innerHTML = `
    <div style="font-size:48px;margin-bottom:8px;"><i class="ph ph-hand-waving"></i></div>
    <h3 style="font-size:18px;font-weight:800;margin-bottom:4px;">Chamado na Mesa</h3>
    <p style="font-size:14px;color:#64748b;margin-bottom:4px;">${escHtml(data.localName)}</p>
    ${data.clienteNome ? '<p style="font-size:13px;color:#d97706;font-weight:700;margin-bottom:4px;"><i class="ph ph-user"></i> ' + escHtml(data.clienteNome) + '</p>' : ''}
    <p style="font-size:13px;color:#94a3b8;margin-bottom:20px;">Cliente chamou o garçom</p>
    <div style="display:flex;gap:10px;">
      <button id="btn-recusar-chamado" style="flex:1;padding:12px;border-radius:12px;border:2px solid #e2e8f0;background:white;font-weight:700;font-size:14px;cursor:pointer;color:#64748b;">Recusar</button>
      <button id="btn-aceitar-chamado" style="flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:white;font-weight:700;font-size:14px;cursor:pointer;">Aceitar</button>
    </div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById('btn-aceitar-chamado').onclick = () => {
    socket.emit('garcom_aceitou_chamado', { localName: data.localName, garcomNome: loggedUser.nome });
    showToast(`Você aceitou o chamado de ${data.localName}`, '#10b981');
    overlay.remove();
    activeAcceptModal = null;
  };
  document.getElementById('btn-recusar-chamado').onclick = () => {
    overlay.remove();
    activeAcceptModal = null;
  };
  activeAcceptModal = overlay;
}

socket.on('notificacao_garcom', (data) => {
  if (!loggedUser) return;

  const badge = document.getElementById('esteira-badge');
  if (badge) {
    badge.style.display = 'block';
    badge.classList.remove('badge-glow');
    void badge.offsetWidth;
    badge.classList.add('badge-glow');
    badge.addEventListener('animationend', () => badge.classList.remove('badge-glow'), { once: true });
  }

  const bellBtn = document.getElementById('nav-esteira');
  if (bellBtn) {
    const bellIcon = bellBtn.querySelector('i');
    if (bellIcon) {
      bellIcon.classList.remove('bell-shake');
      void bellIcon.offsetWidth;
      bellIcon.classList.add('bell-shake');
      bellIcon.addEventListener('animationend', () => bellIcon.classList.remove('bell-shake'), { once: true });
    }
  }

  if (data.userName === 'Chamada') {
    showAcceptNotification(data);
  }

  const clienteLabel = data.clienteNome ? ` — ${data.clienteNome}` : '';
  const msg = `🔔 ${data.quantity}x ${data.productName} - ${data.localName}${clienteLabel} aguardando retirada!`;
  showToast(msg, '#8b5cf6');
  playChamarGarcom();

  if ('Notification' in window) {
    const sendNotif = () => {
      new Notification('🔔 Garçom Chamado!', {
        body: `${data.quantity}x ${data.productName} - ${data.localName}${data.clienteNome ? ' (' + data.clienteNome + ')' : ''}`,
        tag: `chamar-${data.id}`,
        requireInteraction: true
      });
    };
    if (Notification.permission === 'granted') {
      sendNotif();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => { if (perm === 'granted') sendNotif(); });
    }
  }
});

socket.on('garcom_buscando', ({ pedidoId, garcomNome, localName, productName }) => {
  if (!loggedUser) return;
  chamadasReclamadas.set(pedidoId, garcomNome);
  if (garcomNome === loggedUser.nome) {
    showToast(`✅ Você está buscando ${productName} - ${localName}`, '#16a34a');
  } else {
    showToast(`👨‍🍳 ${garcomNome} está indo buscar ${productName} - ${localName}`, '#8b5cf6');
  }
  socket.emit('get_esteira', loggedUser.nome);
});

socket.on('status_atualizado', () => {
  if (loggedUser) socket.emit('get_esteira', loggedUser.nome);
  if (currentTable && document.getElementById('view-bill').classList.contains('active')) {
    socket.emit('get_itens_mesa', currentTable);
  }
});

// --- ÁUDIO E VIBRAÇÃO ---
let audioCtx = null;

function initGarcomAudio() {
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {
    console.log("Audio init failed", e);
  }
}

// iOS/Safari só libera o áudio após um gesto do usuário — desbloquear no 1º toque
['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
  window.addEventListener(evt, initGarcomAudio, { passive: true });
});

function playDing() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    const toneType = localStorage.getItem('sound-esteira-mobile') || (CONFIGS && CONFIGS['sound-esteira-mobile']) || 'pop';
    if (typeof window.playAudioTone === 'function') {
      window.playAudioTone(toneType);
      return;
    }

    initGarcomAudio();
    if (!audioCtx) return;

    createChime(880, 0);       // A5
    createChime(1108.73, 0.15); // C#6
  } catch (e) {
    console.log("Audio/Vibration not supported or blocked by browser.", e);
  }
}

function createChime(freq, delay) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  
  const now = audioCtx.currentTime + delay;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(now);
  osc.stop(now + 1);
}

function playChamarGarcom() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([300, 150, 300, 150, 300]);
    }
    initGarcomAudio();
    if (!audioCtx) return;
    createChime(1046.5, 0);
    createChime(1318.5, 0.12);
    createChime(1568, 0.24);
    createChime(1318.5, 0.45);
    createChime(1046.5, 0.57);
  } catch (e) {
    console.log("Audio/Vibration not supported.", e);
  }
}

setInterval(() => {
  if (loggedUser && document.getElementById('view-esteira') && document.getElementById('view-esteira').classList.contains('active')) {
    socket.emit('get_esteira', loggedUser.nome);
  }
}, 30000);

// --- NAVEGAÇÃO POR GESTOS (SWIPE) ---
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  const diffX = touchStartX - touchEndX;
  const diffY = touchStartY - touchEndY;
  
  // Ignora se for mais um scroll vertical do que um swipe horizontal
  if (Math.abs(diffY) > Math.abs(diffX)) return;
  // Limiar mínimo de swipe (50px)
  if (Math.abs(diffX) < 50) return;
  
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;
  
  const currentViewId = activeView.id;
  
  // Apenas permite swipe horizontal nas telas raízes (Mesas e Esteira)
  if (currentViewId === 'view-tables' && diffX > 0) {
    // Arrasto para a Esquerda -> Abre a Esteira
    showView('esteira', 'Prontos para Entrega');
  } else if (currentViewId === 'view-esteira' && diffX < 0) {
    // Arrasto para a Direita -> Abre as Mesas
    showView('tables', 'Comanda Mobile');
  } else if (currentViewId === 'view-menu') {
    // Navegação pelas abas de categorias do Cardápio
    const currentIndex = TABS.indexOf(currentTab);
    if (currentIndex === -1) return;
    
    if (diffX > 0 && currentIndex < TABS.length - 1) {
      // Swipe Esquerda -> Próxima categoria
      window.selectTab(TABS[currentIndex + 1]);
    } else if (diffX < 0 && currentIndex > 0) {
      // Swipe Direita -> Categoria anterior
      window.selectTab(TABS[currentIndex - 1]);
    }
  }
}



// --- INDIVIDUAL COMANDAS HELPERS ---
window.openNewComandaModal = () => {
  document.getElementById('new-comanda-modal').style.display = 'flex';
  document.getElementById('new-comanda-name').value = '';
  document.getElementById('new-comanda-phone').value = '';
  var hist = document.getElementById('cliente-historico');
  if (hist) { hist.style.display = 'none'; hist.innerHTML = ''; }
  document.getElementById('new-comanda-name').focus();
};

window.closeNewComandaModal = () => {
  document.getElementById('new-comanda-modal').style.display = 'none';
  window.pendingComandaItemIdx = null;
};

window.submitNewComanda = () => {
  const name = document.getElementById('new-comanda-name').value.trim();
  const phone = document.getElementById('new-comanda-phone').value.trim();
  
  if (!name) {
    alert('Por favor, digite o nome do cliente.');
    return;
  }
  if (!phone) {
    alert('Por favor, digite o telefone (necessário para remarketing).');
    return;
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) {
    alert('Por favor, digite um telefone válido.');
    return;
  }
  
  window.newComandasMap = window.newComandasMap || new Map();
  window.newComandasMap.set(name, phone);
  
  if (window.pendingComandaItemIdx !== null && window.pendingComandaItemIdx !== undefined) {
    cart[window.pendingComandaItemIdx].mesa_comanda = name;
    saveCart(currentTable);
  }
  
  window.closeNewComandaModal();
  renderCart();
};

window.changeItemComanda = (idx, value) => {
  if (value === '__NEW__') {
    window.pendingComandaItemIdx = idx;
    window.openNewComandaModal();
    renderCart();
  } else {
    cart[idx].mesa_comanda = value || null;
    saveCart(currentTable);
  }
};

// Auto-fill name when existing client's phone matches
document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('new-comanda-phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      const val = e.target.value;
      const digits = val.replace(/\D/g, '');
      if (digits.length >= 8) {
        socket.emit('buscar_cliente_telefone', digits);
      }
    });
  }
});

socket.on('cliente_telefone_encontrado', (data) => {
  const phoneInput = document.getElementById('new-comanda-phone');
  if (phoneInput) {
    const digits = phoneInput.value.replace(/\D/g, '');
    if (digits === data.telefone && data.nome) {
      document.getElementById('new-comanda-name').value = data.nome;
      const nameInput = document.getElementById('new-comanda-name');
      nameInput.style.borderColor = '#3ab55b';
      setTimeout(() => { nameInput.style.borderColor = '#ddd'; }, 1500);
      socket.emit('buscar_historico_cliente', { nome: data.nome, telefone: data.telefone });
    }
  }
});

socket.on('historico_cliente', (data) => {
  var container = document.getElementById('cliente-historico');
  if (!container) return;
  if (!data.historico || data.historico.length === 0) {
    container.innerHTML = '<div style="padding:8px 0;color:#999;font-size:12px;">Nenhum pedido anterior encontrado.</div>';
    container.style.display = 'block';
    return;
  }
  var html = '<div style="padding:8px 0;"><div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;"><i class="ph ph-clock-counter-clockwise"></i> Últimos pedidos:</div>';
  data.historico.forEach(function(p) {
    var tempo = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">' +
      '<div><span style="font-weight:700;">' + (p.productEmoji || '') + ' ' + p.productName + '</span> <span style="color:#94a3b8;">x' + p.quantity + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px;color:#94a3b8;"><span>' + tempo + '</span><span style="color:#16a34a;font-weight:700;">R$ ' + parseFloat(p.total || 0).toFixed(2).replace('.', ',') + '</span></div>' +
    '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  container.style.display = 'block';
});
window.longPressTimer = null;
window.startLongPress = (e) => {
  window.longPressTimer = setTimeout(() => {
    window.longPressTimer = null;
    window.location.href = '/index.html';
  }, 2000);
};
window.cancelLongPress = (e) => {
  if (window.longPressTimer) {
    clearTimeout(window.longPressTimer);
    window.longPressTimer = null;
  }
};
window.endLongPress = (e) => {
  if (window.longPressTimer) {
    clearTimeout(window.longPressTimer);
    window.longPressTimer = null;
    if (typeof showView === 'function') {
      showView('home', 'Chef Garçom');
      if (typeof renderTables === 'function') renderTables();
    }
  }
};

// --- Dark Mode Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  if (!themeToggleBtn) return;
  
  const savedTheme = localStorage.getItem('chef_garcom_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggleBtn.innerHTML = '<i class="ph ph-sun"></i>';
  } else {
    document.body.classList.remove('dark-mode');
    themeToggleBtn.innerHTML = '<i class="ph ph-moon"></i>';
  }
  
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
      localStorage.setItem('chef_garcom_theme', 'dark');
      themeToggleBtn.innerHTML = '<i class="ph ph-sun"></i>';
    } else {
      localStorage.setItem('chef_garcom_theme', 'light');
      themeToggleBtn.innerHTML = '<i class="ph ph-moon"></i>';
    }
  });
});
