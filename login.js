const btnSubmit = document.getElementById('btn-submit');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('error-msg');

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
      localStorage.setItem('restaurante_id', res.restaurante_id);
      localStorage.setItem('chef_credentials', JSON.stringify({ cargo: res.role }));

      const role = (res.role || '').toLowerCase();
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
      btnSubmit.innerText = 'Entrar no Sistema';
      btnSubmit.disabled = false;
    }
  } catch (err) {
    errorMsg.innerText = 'Erro ao conectar no servidor.';
    errorMsg.style.display = 'block';
    btnSubmit.innerText = 'Entrar no Sistema';
    btnSubmit.disabled = false;
  }
}

btnSubmit.addEventListener('click', attemptLogin);
passwordInput.addEventListener('keypress', event => {
  if (event.key === 'Enter') attemptLogin();
});
