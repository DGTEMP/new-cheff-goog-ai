const fs = require('fs');

// --- 1. Patch index.html ---
let html = fs.readFileSync('index.html', 'utf8');

const novaComandaBtn = `
        <button class="btn-action" id="btn-nova-comanda" style="margin-bottom: 15px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: #e3fafc; color: #0b7285; border: 1px solid #99e9f2; font-weight: bold;">
          <i class="ph ph-user-plus" style="font-size: 20px;"></i>
          Nova Comanda Rapida
        </button>
`;

if (!html.includes('btn-nova-comanda')) {
  html = html.replace('<div id="left-actions-container"', novaComandaBtn + '\n        <div id="left-actions-container"');
}

const novaComandaModal = `
  <!-- NOVA COMANDA MODAL -->
  <div class="modal-overlay" id="modal-nova-comanda-ui" style="display: none; z-index: 10000;">
    <div class="modal" style="width: 400px; padding: 20px;">
      <div class="modal-header">
        <h3 style="margin: 0; display:flex; align-items:center; gap:8px; color: #fc4b15;"><i class="ph ph-receipt"></i> Nova Comanda (CRM)</h3>
        <button class="modal-close" onclick="document.getElementById('modal-nova-comanda-ui').style.display='none'"><i class="ph ph-x"></i></button>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="font-weight:bold; display:block; margin-bottom:5px;">Nome do Cliente</label>
        <input type="text" id="nova-comanda-nome" placeholder="Ex: João da Silva" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
      </div>
      <div style="margin-bottom: 20px;">
        <label style="font-weight:bold; display:block; margin-bottom:5px;">Telefone / WhatsApp</label>
        <input type="text" id="nova-comanda-telefone" placeholder="Ex: (11) 99999-9999" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
      </div>
      <button id="btn-salvar-nova-comanda" class="btn-action primary" style="width: 100%; padding: 12px; font-weight: bold; justify-content:center;">Abrir Comanda e Iniciar Venda</button>
    </div>
  </div>
`;

if (!html.includes('modal-nova-comanda-ui')) {
  html = html.replace('</body>', novaComandaModal + '\n</body>');
}
fs.writeFileSync('index.html', html, 'utf8');

// --- 2. Patch server.js ---
let server = fs.readFileSync('server.js', 'utf8');
const serverLogic = `
  // -- NOVA COMANDA CRM --
  socket.on('nova_comanda_crm', (data) => {
    // Insert/Update CRM
    db.run("INSERT INTO clientes (nome, telefone, observacao) VALUES (?, ?, ?)", [data.nome, data.telefone, "Cadastrado via Nova Comanda"], function(err) {
      let clienteId = this ? this.lastID : null;
      
      // Criar mesa com o nome do cliente
      let mesaName = 'Comanda - ' + data.nome;
      db.run("INSERT INTO mesas (nome, status) VALUES (?, 'Ocupada')", [mesaName], function(err2) {
        if (!err2) {
           // Notify everyone
           db.all("SELECT * FROM mesas", (e, r) => io.emit('mesas_atualizadas', r || []));
           db.all("SELECT * FROM clientes", (e, r) => io.emit('clientes_atualizados', r || []));
           
           // Return the created mesa back to the sender to auto-open PDV
           socket.emit('comanda_criada_sucesso', { nomeMesa: mesaName });
        }
      });
    });
  });
`;

if (!server.includes('nova_comanda_crm')) {
  server = server.replace("io.on('connection', (socket) => {", "io.on('connection', (socket) => {" + serverLogic);
  fs.writeFileSync('server.js', server, 'utf8');
}

// --- 3. Patch main.js ---
let main = fs.readFileSync('main.js', 'utf8');
const mainLogic = `
  // -- Lógica Nova Comanda --
  const btnNovaComanda = document.getElementById('btn-nova-comanda');
  const modalNovaComanda = document.getElementById('modal-nova-comanda-ui');
  const btnSalvarNovaComanda = document.getElementById('btn-salvar-nova-comanda');

  if(btnNovaComanda) {
    btnNovaComanda.onclick = () => {
      document.getElementById('nova-comanda-nome').value = '';
      document.getElementById('nova-comanda-telefone').value = '';
      modalNovaComanda.style.display = 'flex';
      setTimeout(() => document.getElementById('nova-comanda-nome').focus(), 100);
    };
  }

  if(btnSalvarNovaComanda) {
    btnSalvarNovaComanda.onclick = () => {
      const nome = document.getElementById('nova-comanda-nome').value.trim();
      const telefone = document.getElementById('nova-comanda-telefone').value.trim();
      if(!nome) return alert('Por favor, digite o nome do cliente.');
      
      socket.emit('nova_comanda_crm', { nome, telefone });
      modalNovaComanda.style.display = 'none';
    };
  }

  socket.on('comanda_criada_sucesso', ({ nomeMesa }) => {
    // Forçar a visualização para Comandas para o usuário ver a comanda criada
    window.viewFilter = 'Comandas';
    const btnToolbarComandas = document.getElementById('toolbar-comandas');
    if (btnToolbarComandas) btnToolbarComandas.click();
    
    // Auto-selecionar a mesa e abrir PDV
    setTimeout(() => {
       const cards = document.querySelectorAll('.mesa-item');
       let targetCard = null;
       cards.forEach(c => {
         if(c.querySelector('.mesa-nome').innerText === nomeMesa) {
            targetCard = c;
         }
       });
       
       if (targetCard) {
         targetCard.click(); // Select
         const btnAdic = document.getElementById('btn-adicionar-produtos');
         if(btnAdic) btnAdic.click(); // Open PDV
       } else {
         // Fallback if not found visually immediately (socket delay)
         setTimeout(() => {
           const cards2 = document.querySelectorAll('.mesa-item');
           cards2.forEach(c => {
             if(c.querySelector('.mesa-nome').innerText === nomeMesa) c.click();
           });
           const btnAdic = document.getElementById('btn-adicionar-produtos');
           if(btnAdic) btnAdic.click();
         }, 500);
       }
    }, 200);
  });
`;

if (!main.includes('nova_comanda_crm')) {
  main += '\n' + mainLogic;
  fs.writeFileSync('main.js', main, 'utf8');
}

console.log("Comanda Rapida implemented!");
