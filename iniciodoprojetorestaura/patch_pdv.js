const fs = require('fs');
let js = fs.readFileSync('main.js', 'utf8');
const start = js.indexOf("const btnNovo = document.getElementById('btn-adicionar-produtos');");
const end = js.indexOf('// --- ADMIN PANEL LOGIC ---');
const newJS = `const btnNovo = document.getElementById('btn-adicionar-produtos');
  const pdvOverlay = document.getElementById('pdv-overlay');

  window.pdvCart = [];
  window.pdvCurrentCategory = 'Todas';

  window.renderPdvMenu = () => {
    if (!window.allProducts) return;
    const catsDiv = document.getElementById('pdv-categories');
    const itemsDiv = document.getElementById('pdv-menu-items');
    if (!catsDiv || !itemsDiv) return;

    const categories = ['Todas', ...new Set(window.allProducts.map(p => p.categoria))];
    catsDiv.innerHTML = categories.map(c => \`
      <button class="pdv-category-btn \${c === window.pdvCurrentCategory ? 'active' : ''}" 
              onclick="window.pdvCurrentCategory='\${c}'; window.renderPdvMenu()"
              style="padding: 8px 16px; border-radius: 20px; border: none; background: \${c === window.pdvCurrentCategory ? '#fc4b15' : '#eee'}; color: \${c === window.pdvCurrentCategory ? 'white' : '#333'}; font-weight: bold; cursor: pointer; white-space: nowrap;">
        \${c}
      </button>
    \`).join('');

    const filteredProds = window.pdvCurrentCategory === 'Todas' ? window.allProducts : window.allProducts.filter(p => p.categoria === window.pdvCurrentCategory);

    itemsDiv.innerHTML = filteredProds.map(p => \`
      <button class="pdv-item" onclick="window.pdvAddToCart(\${p.id})"
              style="padding: 10px; border: 1px solid #eee; border-radius: 8px; cursor: pointer; text-align: left; background: white; transition: 0.2s;">
         <div style="font-weight:bold; font-size: 14px;">\${p.emoji} \${p.nome}</div>
         <div style="color: gray; font-size: 12px; margin-top: 4px;">R$ \${p.preco.toFixed(2).replace('.', ',')}</div>
      </button>
    \`).join('');
  };

  window.pdvAddToCart = (id) => {
    const prod = window.allProducts.find(p => p.id === id);
    if (!prod) return;
    const existing = window.pdvCart.find(item => item.id === id);
    if (existing) existing.quantity += 1;
    else window.pdvCart.push({ ...prod, quantity: 1 });
    window.renderPdvCart();
  };

  window.pdvRemoveFromCart = (id) => {
    const existing = window.pdvCart.find(item => item.id === id);
    if (existing) {
      existing.quantity -= 1;
      if (existing.quantity <= 0) window.pdvCart = window.pdvCart.filter(item => item.id !== id);
    }
    window.renderPdvCart();
  };

  window.renderPdvCart = () => {
    const cartList = document.getElementById('pdv-selected-items');
    const totalPrice = document.getElementById('pdv-total-price');
    if (!cartList || !totalPrice) return;

    let total = 0;
    cartList.innerHTML = window.pdvCart.map(item => {
      total += item.preco * item.quantity;
      return \`
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #eee;">
          <div style="flex: 1; display: flex; flex-direction: column;">
            <strong style="font-size: 14px;">\${item.nome}</strong>
            <span style="color: gray; font-size: 12px;">R$ \${item.preco.toFixed(2).replace('.', ',')} x \${item.quantity}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button onclick="window.pdvRemoveFromCart(\${item.id})" style="background: #eee; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">-</button>
            <span style="font-size: 14px; width: 20px; text-align: center;">\${item.quantity}</span>
            <button onclick="window.pdvAddToCart(\${item.id})" style="background: #3ab55b; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">+</button>
          </div>
        </li>
      \`;
    }).join('');
    
    if (window.pdvCart.length === 0) cartList.innerHTML = '<li style="text-align:center; padding: 20px; color: gray;">Carrinho vazio</li>';
    
    const taxa = parseFloat(document.getElementById('pdv-taxa-entrega')?.value || 0);
    if (document.getElementById('pdv-tipo-pedido')?.value === 'Delivery') total += taxa;
    
    totalPrice.innerText = \`R$ \${total.toFixed(2).replace('.', ',')}\`;
  };

  if (btnNovo && pdvOverlay) {
    btnNovo.onclick = () => {
      window.pdvCart = [];
      window.renderPdvCart();
      window.renderPdvMenu();
      pdvOverlay.style.display = 'flex';
    };
  }

  document.getElementById('btn-fechar-pdv').onclick = () => pdvOverlay.style.display = 'none';

  const tipoPedido = document.getElementById('pdv-tipo-pedido');
  if (tipoPedido) {
    tipoPedido.onchange = (e) => {
      document.getElementById('pdv-delivery-fields').style.display = e.target.value === 'Delivery' ? 'flex' : 'none';
      window.renderPdvCart();
    };
  }

  const taxaEntregaInput = document.getElementById('pdv-taxa-entrega');
  if(taxaEntregaInput) taxaEntregaInput.oninput = window.renderPdvCart;

  document.getElementById('btn-enviar-pdv').onclick = () => {
    if(window.pdvCart.length === 0) return alert('Adicione itens!');
    
    const tipo = document.getElementById('pdv-tipo-pedido').value;
    const clienteNome = document.getElementById('pdv-cliente-nome').value || 'Avulso';
    const entregadorId = document.getElementById('pdv-entregador-select').value;
    const taxaEntrega = parseFloat(document.getElementById('pdv-taxa-entrega')?.value || 0);

    window.pdvCart.forEach(item => {
      let sector = 'Cozinha';
      if (['Bebidas', 'Bar'].includes(item.categoria)) sector = 'Bar';
      
      const pedido = {
        productName: item.nome,
        productEmoji: item.emoji,
        quantity: item.quantity,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        localName: tipo === 'Delivery' ? \`Delivery - \${clienteNome}\` : \`Balcão - \${clienteNome}\`,
        userName: window.loggedInUser || 'Caixa',
        total: (item.preco * item.quantity).toFixed(2).replace('.', ','),
        status: 'Recebido',
        sector: sector,
        entregador_id: entregadorId || null
      };
      socket.emit('novo_pedido', pedido);
    });

    if (tipo === 'Delivery' && taxaEntrega > 0) {
       socket.emit('novo_pedido', {
         productName: 'Taxa de Entrega',
         productEmoji: '🏍️',
         quantity: 1,
         time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
         localName: \`Delivery - \${clienteNome}\`,
         userName: window.loggedInUser || 'Caixa',
         total: taxaEntrega.toFixed(2).replace('.', ','),
         status: 'Pronto',
         sector: 'Nenhum'
       });
    }

    window.pdvCart = [];
    pdvOverlay.style.display = 'none';
    alert('Pedido lançado com sucesso!');
  };

`;
fs.writeFileSync('main.js', js.substring(0, start) + newJS + js.substring(end));
console.log('Replaced');
