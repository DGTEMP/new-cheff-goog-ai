const fs = require('fs');

let configHtml = fs.readFileSync('configuracoes.html', 'utf8');

if (!configHtml.includes('modal-editar-funcionario')) {
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

  configHtml = configHtml.replace('</body>', modalHtml);
  fs.writeFileSync('configuracoes.html', configHtml);
  console.log('Modal added to configuracoes.html');
}
