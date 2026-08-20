const btnSubmit = document.getElementById('btn-submit');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('error-msg');

let _destinoLogin = 'sistema';

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
      localStorage.setItem('chef_token', res.token);
      localStorage.setItem('restaurante_id', res.restaurante_id || '1');
      localStorage.setItem('chef_credentials', JSON.stringify({ cargo: res.role || 'admin', role: res.role || 'admin', usuario: email, nome: email.split('@')[0] }));

      const role = (res.role || '').toLowerCase();
      
      // Se o usuário selecionou "Painel do Dono" ou possui perfil admin/gerente no seletor
      if (_destinoLogin === 'dono') {
        if (!['admin', 'administrador', 'gerente', 'dono'].includes(role)) {
          errorMsg.innerText = 'Esta conta não possui permissão de Dono/Gerente do restaurante.';
          errorMsg.style.display = 'block';
          btnSubmit.innerText = 'Entrar no Painel do Dono';
          btnSubmit.disabled = false;
          return;
        }
        window.location.href = '/painel-dono.html';
        return;
      }

      if (['admin', 'administrador', 'gerente', 'caixa'].includes(role)) {
        window.location.href = '/index.html';
      } else if (role === 'garçom' || role === 'garcom') {
        window.location.href = '/garcom.html';
      } else if (['cozinha', 'copa', 'bar'].includes(role)) {
        window.location.href = '/fila-pedidos.html';
      } else {
        window.location.href = '/index.html';
      }
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
