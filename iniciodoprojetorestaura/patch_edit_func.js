const fs = require('fs');

// 1. UPDATE index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');

if (!indexHtml.includes('modal-editar-funcionario')) {
  const modalHtml = `
  <!-- MODAL EDITAR FUNCIONARIO -->
  <div class="modal-overlay" id="modal-editar-funcionario" style="display: none; z-index: 10000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); justify-content: center; align-items: center;">
    <div class="modal" style="background: white; padding: 20px; border-radius: 12px; width: 400px;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; font-size: 18px; color: #2c3e50;">Editar Funcionário</h3>
        <button onclick="document.getElementById('modal-editar-funcionario').style.display='none'" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #888;">&times;</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <input type="hidden" id="edit-func-id">
        <label>Nome:</label>
        <input type="text" id="edit-func-nome" style="padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
        <label>Usuário:</label>
        <input type="text" id="edit-func-usuario" style="padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
        <label>Nova Senha (deixe em branco para não alterar):</label>
        <input type="password" id="edit-func-senha" style="padding: 10px; border: 1px solid #ccc; border-radius: 8px;" placeholder="***">
        <label>Cargo:</label>
        <select id="edit-func-cargo" style="padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
          <option value="Garçom">Garçom</option>
          <option value="Caixa">Caixa</option>
          <option value="Cozinha">Cozinha</option>
          <option value="Bar">Bar</option>
          <option value="Copa">Copa</option>
          <option value="Auxiliar">Auxiliar</option>
        </select>
        <label>Valor da Hora (R$):</label>
        <input type="number" id="edit-func-valor-hora" step="0.50" style="padding: 10px; border: 1px solid #ccc; border-radius: 8px;" placeholder="Ex: 10.00">
        <button onclick="window.salvarEdicaoFuncionario({ query: { token: localStorage.getItem('chef_token') } })" style="padding: 12px; background: #3ab55b; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px;">Salvar Alterações</button>
      </div>
    </div>
  </div>
</body>`;

  indexHtml = indexHtml.replace('</body>', modalHtml);
  fs.writeFileSync('index.html', indexHtml);
}

// 2. UPDATE main.js
let mainJs = fs.readFileSync('main.js', 'utf8');

// Add "Editar" button to active employees list
mainJs = mainJs.replace(
  /<button onclick="window\.deleteFuncionario\(\$\{f\.id\}\)"/g,
  `<button onclick="window.abrirModalEditarFuncionario(\${f.id})" style="color: #2b5c9e; border: none; background: none; cursor: pointer; margin-right: 10px;"><i class="ph ph-pencil"></i> Editar</button>\n            <button onclick="window.deleteFuncionario(\${f.id})"`
);

if (!mainJs.includes('window.abrirModalEditarFuncionario')) {
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
}

// Ensure `window.funcionariosList` is saved when fetching employees
if (!mainJs.includes('window.funcionariosList = funcs;')) {
  mainJs = mainJs.replace(
    /const pendentes = funcs\.filter\(f => f\.status === 'Pendente'\);/g,
    "window.funcionariosList = funcs;\n      const pendentes = funcs.filter(f => f.status === 'Pendente');"
  );
}

fs.writeFileSync('main.js', mainJs);

// 3. UPDATE server.js
let serverJs = fs.readFileSync('server.js', 'utf8');
if (!serverJs.includes('socket.on(\'update_funcionario\'')) {
  const serverLogic = `
  socket.on('update_funcionario', (data) => {
    if (data.senha && data.senha.trim() !== '') {
      db.run('UPDATE funcionarios SET nome = ?, usuario = ?, senha = ?, cargo = ?, valor_hora = ? WHERE id = ?', 
        [data.nome, data.usuario, data.senha, data.cargo, data.valor_hora, data.id], (err) => {
          if(!err) io.emit('funcionarios_atualizados');
      });
    } else {
      db.run('UPDATE funcionarios SET nome = ?, usuario = ?, cargo = ?, valor_hora = ? WHERE id = ?', 
        [data.nome, data.usuario, data.cargo, data.valor_hora, data.id], (err) => {
          if(!err) io.emit('funcionarios_atualizados');
      });
    }
  });
`;
  serverJs = serverJs.replace(/(socket\.on\('aprovar_funcionario'.*?\}\);)/s, "$1\n" + serverLogic);
  fs.writeFileSync('server.js', serverJs);
}

console.log('Admin edit funcionario patch applied!');
