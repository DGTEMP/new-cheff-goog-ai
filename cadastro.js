const HOST = window.location.hostname;
const _ridCadastro = new URLSearchParams(window.location.search).get('restaurante_id');
if (_ridCadastro) localStorage.setItem('restaurante_id', _ridCadastro);
const socket = io({ query: { token: localStorage.getItem('chef_token'), restaurante_id: localStorage.getItem('restaurante_id') || '1' } });

document.getElementById('btn-register').onclick = () => {
  const nome = document.getElementById('reg-nome').value.trim();
  const usuario = document.getElementById('reg-user').value.trim();
  const senha = document.getElementById('reg-pass').value.trim();

  if (!nome || !usuario || !senha) {
    alert('Por favor, preencha todos os campos!');
    return;
  }

  document.getElementById('btn-register').innerHTML = '<i class="ph ph-spinner-gap"></i> ENVIANDO...';
  
  socket.emit('cadastro_funcionario', { nome, usuario, senha });
};

socket.on('cadastro_sucesso', () => {
  document.getElementById('register-view').style.display = 'none';
  document.getElementById('success-view').style.display = 'flex';
});

socket.on('cadastro_erro', (msg) => {
  alert(msg);
  document.getElementById('btn-register').innerHTML = 'ENVIAR CADASTRO';
});
