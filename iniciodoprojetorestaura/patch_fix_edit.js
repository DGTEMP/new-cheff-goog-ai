const fs = require('fs');
let mainJs = fs.readFileSync('main.js', 'utf8');

if (!mainJs.includes('window.abrirModalEditarFuncionario = ')) {
  mainJs += `

window.abrirModalEditarFuncionario = (id) => {
  const func = window.funcionariosList.find(f => f.id === id);
  if (!func) return;
  document.getElementById('edit-func-id').value = func.id;
  document.getElementById('edit-func-nome').value = func.nome;
  document.getElementById('edit-func-usuario').value = func.usuario;
  document.getElementById('edit-func-senha').value = '';
  document.getElementById('edit-func-cargo').value = func.cargo;
  document.getElementById('edit-func-valor-hora').value = func.valor_hora || 0;
  document.getElementById('modal-editar-funcionario').style.display = 'flex';
};

window.salvarEdicaoFuncionario = () => {
  const id = document.getElementById('edit-func-id').value;
  const nome = document.getElementById('edit-func-nome').value;
  const usuario = document.getElementById('edit-func-usuario').value;
  const senha = document.getElementById('edit-func-senha').value;
  const cargo = document.getElementById('edit-func-cargo').value;
  const valor_hora = parseFloat(document.getElementById('edit-func-valor-hora').value) || 0;
  
  if(!nome || !usuario || !cargo) return alert('Preencha nome, usuário e cargo!');
  
  socket.emit('update_funcionario', { id, nome, usuario, senha, cargo, valor_hora });
  document.getElementById('modal-editar-funcionario').style.display = 'none';
};
`;
  fs.writeFileSync('main.js', mainJs);
  console.log('Adicionado as funções window.abrirModalEditarFuncionario e window.salvarEdicaoFuncionario ao final do main.js');
}
