const btnSubmit = document.getElementById('btn-submit');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('error-msg');

let _destinoLogin = 'sistema';
let _loginResAtual = null; // resposta do login aguardando escolha de restaurante

window.setDestinoLogin = function(tipo) {
  _destinoLogin = tipo;
  const btnSys = document.getElementById('tab-login-sistema');
  const btnDono = document.getElementById('tab-login-dono');
  const btnSub = document.getElementById('btn-submit');

  if (tipo === 'dono') {
    if (btnSys) { btnSys.style.background = 'transparent'; btnSys.style.color = '#64748b'; btnSys.style.fontWeight = '600'; }
    if (btnDono) { btnDono.style.background = 'var(--primary)'; btnDono.style.color = 'white'; btnDono.style.fontWeight = '700'; }
    if (btnSub) btnSub.innerText = 'Entrar no Painel do Dono';
  } else {
    if (btnSys) { btnSys.style.background = 'var(--primary)'; btnSys.style.color = 'white'; btnSys.style.fontWeight = '700'; }
    if (btnDono) { btnDono.style.background = 'transparent'; btnDono.style.color = '#64748b'; btnDono.style.fontWeight = '600'; }
    if (btnSub) btnSub.innerText = 'Entrar no Sistema Operacional';
  }
};

/* Micro-interações com sensação nativa */
function vibrar(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) {}
}

/* ═══ Seletor de Restaurante para donos de rede ═══ */
function abrirSeletorRede(res) {
  _loginResAtual = res;
  const overlay = document.getElementById('rede-overlay');
  const lista = document.getElementById('rede-lista');
  if (!overlay || !lista) return continuarLogin(res.restaurante_id);

  const todos = [{ id: res.restaurante_id }].concat(res.rede || []);
  const ultimo = String(localStorage.getItem('cc_ultimo_restaurante') || '');
  const nomeUsuario = (res.nome_usuario || usernameInput.value.split('@')[0] || '').trim();

  const saudacao = document.getElementById('rede-saudacao');
  if (saudacao) saudacao.textContent = nomeUsuario
    ? `Olá, ${nomeUsuario}! Você administra ${todos.length} estabelecimentos.`
    : 'Você administra mais de um estabelecimento.';

  lista.innerHTML = todos.map(r => {
    const ehAtual = String(r.id) === String(res.restaurante_id);
    const inicial = (r.nome || '?').trim().charAt(0).toUpperCase();
    return `<button type="button" class="rede-card-restaurante" data-rid="${r.id}" onclick="escolherRestauranteRede('${r.id}')">
      <span class="rede-avatar">${inicial}</span>
      <span style="flex:1; min-width:0;">
        <strong style="display:block; color:var(--text); font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.nome || ('Restaurante #' + r.id)}</strong>
        ${String(r.id) === ultimo ? '<span style="color:var(--text-muted); font-size:12px;">Usado por último</span>' : ''}
      </span>
      ${ehAtual ? '<span class="rede-badge-atual">SUA CONTA</span>' : ''}
    </button>`;
  }).join('');

  overlay.classList.add('aberto');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visivel')));
  vibrar(8);
}

window.fecharSeletorRede = function() {
  const overlay = document.getElementById('rede-overlay');
  if (!overlay) return;
  overlay.classList.remove('visivel');
  setTimeout(() => overlay.classList.remove('aberto'), 380);
  _loginResAtual = null;
  btnSubmit.innerText = _destinoLogin === 'dono' ? 'Entrar no Painel do Dono' : 'Entrar no Sistema';
  btnSubmit.disabled = false;
};

document.getElementById('rede-overlay')?.addEventListener('click', (ev) => {
  if (ev.target && ev.target.id === 'rede-overlay') window.fecharSeletorRede();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && document.getElementById('rede-overlay')?.classList.contains('aberto')) {
    ev.preventDefault();
    window.fecharSeletorRede();
  }
});

function concluirLogin(restauranteId) {
  continuarLogin(restauranteId);
}

window.escolherRestauranteRede = function(rid) {
  vibrar(10);
  const res = _loginResAtual;
  if (!res) return;
  // Restaurante da conta original: token já serve
  if (String(rid) === String(res.restaurante_id)) return concluirLogin(rid);

  fetch('/api/auth/trocar-restaurante', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + res.token },
    body: JSON.stringify({ restaurante_id: parseInt(rid, 10) })
  })
    .then(r => r.json())
    .then(d => {
      if (d && d.success) {
        res.token_usado = d.token;
        concluirLogin(d.restaurante_id);
      } else {
        alert((d && d.error) || 'Não foi possível entrar neste restaurante.');
        window.fecharSeletorRede();
      }
    })
    .catch(() => {
      alert('Erro de conexão ao alternar restaurante.');
      window.fecharSeletorRede();
    });
};

function redirecionarPorRole(role) {
  role = (role || '').toLowerCase();
  if (['admin', 'administrador', 'gerente', 'caixa'].includes(role)) {
    window.location.href = '/index.html';
  } else if (role === 'garçom' || role === 'garcom') {
    window.location.href = '/garcom.html';
  } else if (['cozinha', 'copa', 'bar'].includes(role)) {
    window.location.href = '/fila-pedidos.html';
  } else {
    window.location.href = '/index.html';
  }
}

function continuarLogin(restauranteIdEscolhido) {
  const res = _loginResAtual || {};
  const role = (res.role || '').toLowerCase();
  const rid = restauranteIdEscolhido || res.restaurante_id;

  localStorage.setItem('chef_token', res.token_usado || res.token);
  localStorage.setItem('restaurante_id', String(rid));
  localStorage.setItem('cc_ultimo_restaurante', String(rid));
  localStorage.setItem('chef_credentials', JSON.stringify({ cargo: res.role || 'admin', role: res.role || 'admin', usuario: res.email_login || usernameInput.value.trim(), nome: (res.email_login || usernameInput.value).split('@')[0] }));
  vibrar([10, 30, 10]);

  if (_destinoLogin === 'dono') {
    window.location.href = '/painel-dono.html';
    return;
  }
  redirecionarPorRole(role);
}

async function attemptLogin() {
  const email = usernameInput.value.trim();
  const senha = passwordInput.value.trim();
  if (!email || !senha) {
    errorMsg.innerText = 'Preencha os campos!';
    errorMsg.style.display = 'block';
    return;
  }
  
  errorMsg.style.display = 'none';
  btnSubmit.innerText = 'Autenticando...';
  btnSubmit.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const res = await response.json();

    if (res.success) {
      const role = (res.role || '').toLowerCase();
      _loginResAtual = res;

      // Se o usuário selecionou "Painel do Dono" ou possui perfil admin/gerente no seletor
      if (_destinoLogin === 'dono') {
        if (!['admin', 'administrador', 'gerente', 'dono'].includes(role)) {
          fetch('/api/auth/notificar-impostor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              cargo: role,
              restaurante_id: res.restaurante_id || '1'
            })
          }).catch(() => {});

          errorMsg.innerText = '⚠️ Acesso Negado! Tentativa de acesso não autorizada registrada e enviada à gerência e suporte.';
          errorMsg.style.display = 'block';
          btnSubmit.innerText = 'Entrar no Painel do Dono';
          btnSubmit.disabled = false;
          _loginResAtual = null;
          return;
        }
      }

      // Dono de rede: deixa escolher o estabelecimento antes de entrar
      if (Array.isArray(res.rede) && res.rede.length > 0 && ['admin', 'administrador', 'gerente', 'dono'].includes(role)) {
        btnSubmit.innerText = 'Escolha o restaurante...';
        abrirSeletorRede(res);
        return;
      }

      continuarLogin(res.restaurante_id);
    } else {
      errorMsg.innerText = res.error || 'Falha no login.';
      errorMsg.style.display = 'block';
      btnSubmit.innerText = _destinoLogin === 'dono' ? 'Entrar no Painel do Dono' : 'Entrar no Sistema';
      btnSubmit.disabled = false;
    }
  } catch (err) {
    errorMsg.innerText = 'Erro ao conectar no servidor.';
    errorMsg.style.display = 'block';
    btnSubmit.innerText = _destinoLogin === 'dono' ? 'Entrar no Painel do Dono' : 'Entrar no Sistema';
    btnSubmit.disabled = false;
  }
}

btnSubmit.addEventListener('click', attemptLogin);
passwordInput.addEventListener('keypress', event => {
  if (event.key === 'Enter') attemptLogin();
});
