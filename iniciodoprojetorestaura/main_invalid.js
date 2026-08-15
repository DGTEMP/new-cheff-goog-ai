
window.onDragStartTable = (e, mesa) => {
  e.dataTransfer.setData('type', 'table');
  e.dataTransfer.setData('mesa', mesa);
  e.dataTransfer.effectAllowed = 'move';
};

window.onDragStartItem = (e, itemId) => {

  e.dataTransfer.setData('type', 'item');

  e.dataTransfer.setData('itemId', itemId);

  e.dataTransfer.effectAllowed = 'move';

};



window.switchMobileTab = (tabId) => {
  const ws = document.querySelector('.workspace');
  if (!ws) return;
  
  ws.classList.remove('active-tab-mesas', 'active-tab-pedido', 'active-tab-acoes');
  ws.classList.add(`active-${tabId}`);
  
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
};

setTimeout(() => {
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.switchMobileTab(btn.getAttribute('data-tab'));
    });
  });
}, 100);

const HOST = window.location.hostname || 'localhost';

const socket = io({ query: { token: localStorage.getItem('chef_token') } });

window.socket = socket;



let serverIp = HOST;



function updateQrCode() {

  const qrImg = document.getElementById('qr-code-img');

  if (qrImg) {

    const appUrl = `https://${serverIp}:5173/cadastro.html`;

    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(appUrl)}`;

  }

}



socket.on('server_ip', (ip) => {

  if (ip && ip !== 'localhost') {

    serverIp = ip;

    updateQrCode();

  }

});



// Nome do restaurante (via licença)

socket.on('restaurant_name', (nome) => {

  const el = document.getElementById('restaurant-name');

  if (el && nome && nome !== 'Chef Cozinha' && nome !== 'Dev Mode') {

    el.textContent = '🍳 ' + nome;

    document.title = nome + ' — Chef Cozinha';

  }

});



// Status da licença e updates

socket.on('license_status', (state) => {

  if (state && state.pendingUpdate) {

    const banner = document.getElementById('update-banner');

    const textEl = document.getElementById('update-banner-text');

    const linkEl = document.getElementById('btn-update-download');

    

    if (banner && textEl && linkEl) {

      const up = state.pendingUpdate;

      textEl.textContent = `🚀 Versão ${up.version} disponível! ${up.message ? `— ${up.message}` : ''}`;

      linkEl.href = up.url || '#';

      banner.style.display = 'flex';

    }

  }

});



document.addEventListener('DOMContentLoaded', updateQrCode);



let ordersData = [];



window.onDropMesa = (e, targetMesa) => {

  e.preventDefault();

  

  const type = e.dataTransfer.getData('type');

  if (!type) return;



  if (type === 'table') {

    const draggedMesa = e.dataTransfer.getData('mesa');

    if (draggedMesa === targetMesa) return;



    // Check if targetMesa is occupied or not by looking at window.ordersData

    const isOccupied = window.ordersData && window.ordersData.some(o => (o.mesa_grupo || o.localName) === targetMesa && o.status !== 'Finalizado');



    if (isOccupied) {

       if (confirm('Deseja realmente JUNTAR a ' + draggedMesa + ' com a ' + targetMesa + '?')) {

           socket.emit('juntar_mesas', { mesaA: draggedMesa, mesaB: targetMesa });

       }

    } else {

       if (confirm('Deseja realmente TRANSFERIR a ' + draggedMesa + ' para a ' + targetMesa + '?')) {

           socket.emit('transferir_mesa', { mesaAtual: draggedMesa, novaMesa: targetMesa });

       }

    }

  } else if (type === 'item') {

    const itemId = e.dataTransfer.getData('itemId');

    if (confirm('Deseja realmente transferir este item para a ' + targetMesa + '?')) {

        socket.emit('transferir_item', { itemId: itemId, novaMesa: targetMesa });

    }

  }

};



window.getPrecoAtivo = (productName, originalPrice) => {

  const promocoesList = window.PROMOCOES || [];

  const now = new Date();

  const dayOfWeek = now.getDay();

  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');



  for (const p of promocoesList) {

    if (!p.ativo) continue;

    let cfg = {};

    try { cfg = JSON.parse(p.config || '{}'); } catch(e){}

    

    if (cfg.tipo_promocao === 'preco_fixo' && cfg.produto_alvo_nome === productName) {

       if (cfg.dias_semana && cfg.dias_semana.length > 0 && !cfg.dias_semana.includes(dayOfWeek)) continue;

       if (cfg.horario_inicio && currentTime < cfg.horario_inicio) continue;

       if (cfg.horario_fim && currentTime > cfg.horario_fim) continue;

       return parseFloat(cfg.novo_preco);

    }

  }

  return originalPrice;

};



const contasSolicitadas = new Set();

socket.on('sync_mesas_fechando', (list) => {

  contasSolicitadas.clear();

  list.forEach(m => contasSolicitadas.add(m));

  if (typeof renderOrders === 'function') renderOrders();

});

socket.on('toque_pedir_conta', (mesaName) => {

  contasSolicitadas.add(mesaName);

  if (typeof renderOrders === 'function') renderOrders();

});



function renderOrders() {

  const grid = document.getElementById('orders-grid');

  if (!grid) return;

  grid.innerHTML = '';



  let totalRevenue = 0;

  let totalCost = 0;



  const groupedOrders = {};



  ordersData.forEach(order => {

    const val = order.total ? parseFloat(String(order.total).replace(',', '.')) : 0;

    totalRevenue += val;

    totalCost += val * 0.3;



    const mesaName = order.mesa_grupo || order.localName || `Pedido Avulso #${order.id}`;

    if (!groupedOrders[mesaName]) {

      groupedOrders[mesaName] = {

        mesaName,

        items: [],

        total: 0,

        pagamentosParciais: [],

        status: order.status,

        createdAt: order.createdAt,

        time: order.time,

        id: order.id,

        userName: order.userName || 'Avulso'

      };

    }

      if (order.productName && (order.productName.includes('Pagamento') || order.productName.includes('Pgto Parcial'))) {

        let metodo = 'Dinheiro';

        if (order.productName.includes('(')) {

           metodo = order.productName.split('(')[1].replace(')', '');

        }

        groupedOrders[mesaName].pagamentosParciais.push({ valor: Math.abs(val), metodo });

      } else {

        groupedOrders[mesaName].items.push(order);

        groupedOrders[mesaName].totalBruto = (groupedOrders[mesaName].totalBruto || 0) + val;

        if (order.status !== 'Pago') {

          groupedOrders[mesaName].total += val;

        }

      }

  });



  const contasPedidas = [];

  const mesasDisponiveis = [];

  const mesasOcupadas = [];

  const mesasEmFechamento = [];

  const mesasReservadas = [];



  if (window.allMesas) {

    window.allMesas.forEach(mesa => {

      if (!groupedOrders[mesa.nome]) {

        if(!mesa.nome.includes('Delivery')) {

           if (mesa.status === 'Reservada') {

             mesasReservadas.push({ ...mesa, isGroup: false });

           } else {

             mesasDisponiveis.push({ ...mesa, isGroup: false });

           }

        }

      } else {

        const group = groupedOrders[mesa.nome];

        if (contasSolicitadas.has(mesa.nome)) {

          contasPedidas.push({ ...group, isGroup: true, originalMesa: mesa });

        } else if (group.status === 'Concluído' || group.status === 'Pronto') {

          mesasEmFechamento.push({ ...group, isGroup: true, originalMesa: mesa });

        } else {

          mesasOcupadas.push({ ...group, isGroup: true, originalMesa: mesa });

        }

        delete groupedOrders[mesa.nome];

      }

    });

  }



  Object.values(groupedOrders).forEach(group => {

    if (contasSolicitadas.has(group.mesaName)) {

      contasPedidas.push({ ...group, isGroup: true });

    } else if (group.status === 'Concluído' || group.status === 'Pronto') {

      mesasEmFechamento.push({ ...group, isGroup: true });

    } else {

      mesasOcupadas.push({ ...group, isGroup: true });

    }

  });



  const elOcupadas = document.getElementById('info-mesas-ocupadas');

  const elLivres = document.getElementById('info-mesas-livres');

  const elFechando = document.getElementById('info-mesas-fechando');

  const elReservadas = document.getElementById('info-mesas-reservadas');



  let ped = contasPedidas;

  let disp = mesasDisponiveis;

  let ocup = mesasOcupadas;

  let fech = mesasEmFechamento;

  let reser = mesasReservadas;



  if (window.viewFilter === 'Comandas') {

    ped = ped.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

    disp = disp.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

    ocup = ocup.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

    fech = fech.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

    reser = reser.filter(m => (m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

  } else {

    ped = ped.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

    disp = disp.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

    ocup = ocup.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

    fech = fech.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

    reser = reser.filter(m => !(m.nome || m.mesaName || '').toLowerCase().includes('comanda'));

  }



  if(elOcupadas) elOcupadas.innerText = ocup.length + fech.length + ped.length;

  if(elLivres) elLivres.innerText = disp.length;

  if(elFechando) elFechando.innerText = fech.length;

  if(elReservadas) elReservadas.innerText = reser.length;



  const renderSection = (title, count, items, statusClass) => {

    if (items.length === 0) return '';

    let html = `

      <div class="mesa-category">

        <div class="mesa-category-title">

          <span>${title}</span>

          <span class="mesa-category-count">${count}</span>

        </div>

        <div class="mesas-grid-layout">

    `;

    items.forEach((item, idx) => {

       const isGroup = item.isGroup;

       const nome = isGroup ? item.mesaName : item.nome;

        let totalBase = isGroup ? (item.totalBruto || item.total) : 0;

        const taxaCheckbox = document.getElementById('taxa-servico');

        if (isGroup && taxaCheckbox && taxaCheckbox.checked) {

          totalBase *= 1.1; // Add 10%

        }

        const valTotal = isGroup ? totalBase.toFixed(2).replace('.', ',') : '0,00';

       let cliente = isGroup ? item.userName : '-';

       

       if (!isGroup && item.status === 'Reservada') {

         try {

           const obsObj = JSON.parse(item.observacao || '{}');

           if (obsObj.cliente) cliente = obsObj.cliente;

           if (obsObj.data) {

             const dt = new Date(obsObj.data);

             if(!isNaN(dt)) cliente += ` (${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')})`;

           }

         } catch(e) {}

       }

       

       const uid = Math.random().toString(36).substr(2, 9);

       item.uid = uid; 

       

       html += `

          <div class="mesa-item status-${statusClass}" id="mesa-card-${uid}" style="position: relative;" draggable="true" ondragstart="window.onDragStartTable(event, '${nome}')" ondragover="event.preventDefault(); this.classList.add('drag-over');" ondragleave="this.classList.remove('drag-over');" ondrop="window.onDropMesa(event, '${nome}'); this.classList.remove('drag-over');">

            ${statusClass === 'solicitada' ? '<div style="position: absolute; top: -8px; right: -8px; background: white; border-radius: 50%; padding: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); display: flex;"><i class="ph ph-receipt" style="color: #3498db; font-size: 20px;"></i></div>' : ''}

            <div class="mesa-header-info">

              <span class="mesa-id">${nome}</span>

              <i class="ph ph-users mesa-icon"></i>

            </div>

            <div class="mesa-client">Cliente: ${cliente}</div>

            <div class="mesa-value">R$ ${valTotal}</div>

          </div>

       `;

    });

    html += `</div></div>`;

    return html;

  };



  let html = '';

  html += renderSection('Conta Solicitada', ped.length, ped, 'solicitada');

  html += renderSection('Para Fechar', fech.length, fech, 'fechamento');

  html += renderSection('Ocupadas', ocup.length, ocup, 'ocupada');

  html += renderSection('Reservadas', reser.length, reser, 'reservada');

  html += renderSection('Disponíveis', disp.length, disp, 'disponivel');



  if(typeof morphdom !== 'undefined') morphdom(grid, '<div>'+html+'</div>', {childrenOnly:true}); else grid.innerHTML = html;

  const allRenderedItems = [...ped, ...fech, ...ocup, ...reser, ...disp];

  allRenderedItems.forEach(item => {

    if (window.mesaAtual && (item.mesaName || item.nome) === (window.mesaAtual.mesaName || window.mesaAtual.nome)) {

      const card = Array.from(document.querySelectorAll('.mesa-item')).find(c => c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.mesaName || c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.nome);

      if (card) card.click();

    }

  });



  // --- Toolbar & Action Buttons (Caixa) ---

  const btnParcial = document.getElementById('btn-movimento-parcial');

  if (btnParcial) {

    btnParcial.addEventListener('click', () => {

      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');

      const containerRight = document.getElementById('right-panel');

      if (containerRight) containerRight.scrollTop = containerRight.scrollHeight;

      const inputValor = document.getElementById('valor-pagamento');

      if (inputValor) inputValor.focus();

    });

  }

  const btnAddPagamento = document.getElementById('btn-add-pagamento');
  if (btnAddPagamento) {
    btnAddPagamento.onclick = () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const selectMetodo = document.getElementById('metodo-pagamento');
      const inputValor = document.getElementById('valor-pagamento');
      if (!inputValor || !selectMetodo) return;
      
      const valorTexto = inputValor.value.trim().replace('R



  const btnConcluir = document.getElementById('btn-movimento-concluir');

  if (btnConcluir) {

    btnConcluir.addEventListener('click', () => {

      const btnFinalizar = document.getElementById('btn-finalizar-venda');

      if (btnFinalizar) {

        if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');

        btnFinalizar.click();

      }

    });

  }



  const btnToolbarMesas = document.getElementById('toolbar-mesas');

  const btnToolbarComandas = document.getElementById('toolbar-comandas');

  window.viewFilter = 'Mesas';

  

  if (btnToolbarMesas) {

    btnToolbarMesas.onclick = () => {

      window.viewFilter = 'Mesas';

      document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));

      btnToolbarMesas.classList.add('active');

      if (typeof renderOrders === 'function') renderOrders();

    };

  }

  if (btnToolbarComandas) {

    btnToolbarComandas.onclick = () => {

      window.viewFilter = 'Comandas';

      document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));

      btnToolbarComandas.classList.add('active');

      if (typeof renderOrders === 'function') renderOrders();

    };

  }



  const btnBalcao = document.getElementById('toolbar-balcao');

  if (btnBalcao) {

    btnBalcao.onclick = () => {

      const btnAdicionar = document.getElementById('btn-adicionar-produtos');

      if (btnAdicionar) btnAdicionar.click();

      const pdvTipo = document.getElementById('pdv-tipo-pedido');

      if (pdvTipo) {

        pdvTipo.value = 'Balcão';

        pdvTipo.dispatchEvent(new Event('change'));

      }

    };

  }



  const btnDelivery = document.getElementById('toolbar-delivery');

  if (btnDelivery) {

    btnDelivery.onclick = () => {

      const btnAdicionar = document.getElementById('btn-adicionar-produtos');

      if (btnAdicionar) btnAdicionar.click();

      const pdvTipo = document.getElementById('pdv-tipo-pedido');

      if (pdvTipo) {

        pdvTipo.value = 'Delivery';

        pdvTipo.dispatchEvent(new Event('change'));

      }

    };

  }

  

  const pdvCliSearchBtn = document.getElementById('pdv-cliente-search-btn');

  const btnAlterarMesa = document.getElementById('btn-alterar-mesa');

  if (btnAlterarMesa) {

    btnAlterarMesa.onclick = () => {

      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');

      const novaMesa = prompt('Digite o novo número ou nome da mesa:', window.mesaAtual.nome || window.mesaAtual.mesaName);

      if (novaMesa && novaMesa.trim() !== '') {

        socket.emit('transferir_mesa', {

          mesaAtual: window.mesaAtual.nome || window.mesaAtual.mesaName,

          novaMesa: novaMesa.trim()

        });

      }

    };

  }



  const btnJuntarMesa = document.getElementById('btn-juntar-mesa');

  if (btnJuntarMesa) {

    btnJuntarMesa.onclick = () => {

      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');

      const targetMesa = prompt(`Juntar [${window.mesaAtual.nome || window.mesaAtual.mesaName}] com qual mesa?`);

      if (targetMesa && targetMesa.trim() !== '') {

        socket.emit('juntar_mesas', {

          mesaA: window.mesaAtual.nome || window.mesaAtual.mesaName,

          mesaB: targetMesa.trim()

        });

      }

    };

  }



  // --- BOTÃO AGRUPAR ITENS ---

  const btnAgrupar = document.getElementById('btn-agrupar-itens');

  if (btnAgrupar) {

    btnAgrupar.onclick = () => {

      window.agruparItens = !window.agruparItens;

      if (window.agruparItens) {

        btnAgrupar.style.backgroundColor = '#3ab55b';

        btnAgrupar.style.color = 'white';

        btnAgrupar.innerHTML = '<i class="ph ph-list-dashes"></i> Desagrupar';

      } else {

        btnAgrupar.style.backgroundColor = '';

        btnAgrupar.style.color = '';

        btnAgrupar.innerHTML = '<i class="ph ph-list-dashes"></i> Agrupar';

      }

      

      // Re-render current mesa if selected

      if (window.mesaAtual) {

        const card = Array.from(document.querySelectorAll('.mesa-item')).find(c => c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.mesaName || c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.nome);

      if (card) card.click();

      } else {

        alert(window.agruparItens ? 'A visualização dos itens agora será agrupada por produto.' : 'A visualização dos itens agora será separada (um por linha).');

      }

    };

  }



  // --- BOTÃO VER COMISSÃO ---

  const btnComissao = document.getElementById('btn-ver-comissao');

  if (btnComissao) {

    btnComissao.onclick = () => {

      if (window.mesaAtual && window.mesaAtual.isGroup !== false) {

        const comissao = window.mesaAtual.total * 0.1;

        alert(`Comissão desta mesa (10%): R$ ${comissao.toFixed(2).replace('.', ',')}\n\nO valor já está contabilizado no painel de Resumo na barra lateral direita!`);

      } else {

        // Se nenhuma mesa selecionada, abre o relatório de comissões (Garçons)

        document.getElementById('menu-relatorios')?.click();

        alert('Aqui você pode visualizar o faturamento total por garçom (base para a comissão do turno).');

      }

    };

  }



  allRenderedItems.forEach(item => {

    const card = document.getElementById(`mesa-card-${item.uid}`);

    if (!card) return;

    

    card.addEventListener('dblclick', () => {

       card.click();

       const btnAdicionar = document.getElementById('btn-adicionar-produtos');

       if (btnAdicionar) btnAdicionar.click();

    });



    card.addEventListener('click', () => {

       document.querySelectorAll('.mesa-item').forEach(c => c.classList.remove('selected'));

       card.classList.add('selected');

       

       const nomeMesa = item.isGroup ? item.mesaName : item.nome;

       

       const updateSummaryValue = (id, val) => {

         const el = document.getElementById(id);

         if (el) el.innerText = `R$ ${val.toFixed(2).replace('.', ',')}`;

       };


       
       const infoMesa = document.getElementById('info-mesa-nome');
       const infoCliente = document.getElementById('info-cliente-nome');
       const infoPermanencia = document.getElementById('info-permanencia');
       if(infoMesa) infoMesa.innerText = nomeMesa;
       if(infoCliente) infoCliente.innerText = item.isGroup ? item.userName : '-';
       
       if (infoPermanencia) {
           if (!item.isGroup || !item.items || item.items.length === 0) {
               infoPermanencia.innerText = '0min';
           } else {
               // item.items[0].time might be "HH:MM"
               window.updatePermanencia = () => {
                   const firstTimeStr = item.items[0].time; // "14:35"
                   if (firstTimeStr && firstTimeStr.includes(':')) {
                       const [h, m] = firstTimeStr.split(':').map(Number);
                       const now = new Date();
                       let orderDate = new Date();
                       orderDate.setHours(h, m, 0, 0);
                       if (orderDate > now) {
                           // crossed midnight?
                           orderDate.setDate(orderDate.getDate() - 1);
                       }
                       const diffMs = now - orderDate;
                       const diffMin = Math.floor(diffMs / 60000);
                       infoPermanencia.innerText = diffMin + 'min';
                   } else {
                       infoPermanencia.innerText = '0min';
                   }
               };
               window.updatePermanencia();
           }
       }
       
       const tbody = document.getElementById('panel-items-tbody');
       
       const leftActionsContainer = document.getElementById('left-actions-container');
       const mesaBanner = document.getElementById('mesa-selecionada-banner');
       const mesaBannerNome = document.getElementById('mesa-selecionada-nome');
       const actMovimentos = document.getElementById('action-group-movimentos');
       const actRelatorios = document.getElementById('action-group-relatorios');

       window.mesaAtual = item;
       if (leftActionsContainer) {
          leftActionsContainer.style.opacity = '1';
          leftActionsContainer.style.pointerEvents = 'auto';
       }
       if (mesaBanner && mesaBannerNome) {
          mesaBanner.style.display = 'flex';
          mesaBannerNome.innerText = item.nome || item.mesaName;
       }

       if (!item.isGroup) {
         if(tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: gray; padding: 20px;">Mesa ${item.status === 'Reservada' ? 'Reservada' : 'Livre'}</td></tr>`;
         updateSummaryValue('resumo-produtos', 0);
         updateSummaryValue('resumo-comissao', 0);
         updateSummaryValue('resumo-subtotal', 0);
         updateSummaryValue('resumo-taxas', 0);
         document.getElementById('total-pagar-text').innerText = 'R$ 0,00';
         document.getElementById('total-pago-text').innerText = 'R$ 0,00';
         document.getElementById('falta-pagar-text').innerText = 'R$ 0,00';
         
         const btnFinalizar = document.getElementById('btn-finalizar-venda');
         if(btnFinalizar) {
           btnFinalizar.style.opacity = '0.5';
           btnFinalizar.style.pointerEvents = 'none';
         }
         
         if (actMovimentos) {
            actMovimentos.style.opacity = '0.5';
            actMovimentos.style.pointerEvents = 'none';
         }
         if (actRelatorios) {
            actRelatorios.style.opacity = '0.5';
            actRelatorios.style.pointerEvents = 'none';
         }
         return;
       }

       if (actMovimentos) {
          actMovimentos.style.opacity = '1';
          actMovimentos.style.pointerEvents = 'auto';
       }
       if (actRelatorios) {
          actRelatorios.style.opacity = '1';
          actRelatorios.style.pointerEvents = 'auto';
       }

       window.gorjetaAdicional = 0;
       window.descontoAdicional = 0;
       window.servicoAdicional = 0;
       
       let itemsToRender = item.items;
       if (window.agruparItens) {
         const grouped = {};
         item.items.forEach(order => {
           const key = order.productName;
           if (!grouped[key]) grouped[key] = { ...order, quantity: 0, totalVal: 0 };
           const totalVal = parseFloat(String(order.total).replace(',', '.'));
           grouped[key].quantity += (order.quantity || 1);
           grouped[key].totalVal += totalVal;
         });
         itemsToRender = Object.values(grouped).map(g => ({ ...g, total: g.totalVal }));
       }
       
       let itemsHTML = '';
       itemsToRender.forEach((order, idx) => {
         const totalVal = parseFloat(String(order.total).replace(',', '.'));
         const isPaid = order.status === 'Pago';
         itemsHTML += `
           <tr style="${isPaid ? 'opacity: 0.5; background: #f9f9f9;' : ''}" draggable="true" ondragstart="window.onDragStartItem(event, ${order.id})">
             <td>${String(idx+1).padStart(3, '0')}</td>
             <td style="${isPaid ? 'text-decoration: line-through;' : ''}">${order.productEmoji || ''} ${order.productName || 'Produto'}${order.mesa_comanda ? ` <span style="color:#fc4b15; font-size:12px; margin-left:8px; font-weight:600;">(${order.mesa_comanda})</span>` : ''} ${isPaid ? '<strong style="color: #3ab55b; margin-left: 8px;">(PAGO)</strong>' : ''}</td>
             <td>R$ ${(totalVal / (order.quantity || 1)).toFixed(2).replace('.', ',')}</td>
             <td>${order.quantity || 1}</td>
             <td style="font-weight: 600; color: #3ab55b;">R$ ${totalVal.toFixed(2).replace('.', ',')}</td>
             <td>${order.userName || 'Caixa'}</td>
             <td>
                ${isPaid ? '' : `<i class="ph ph-trash" style="color: #eb5757; cursor: pointer;" onclick="window.removerItemPedido('${order.id}')"></i>`}
             </td>
           </tr>
         `;
       });
       if(tbody) tbody.innerHTML = itemsHTML;

        // --- CÁLCULO E DIVISÃO POR COMANDA ---
        const divRacha = document.getElementById('div-racha-comandas');
        const listRacha = document.getElementById('racha-comandas-list');
        const chkRachaShared = document.getElementById('chk-racha-compartilhados');
        
        if (divRacha && listRacha) {
           const unpaidItems = item.items.filter(o => o.status !== 'Pago');
           
           const comandaSums = {};
           let sharedTotal = 0;
           let hasComandas = false;
           
           unpaidItems.forEach(order => {
              const val = parseFloat(String(order.total).replace(',', '.'));
              const comanda = order.mesa_comanda ? order.mesa_comanda.trim() : '';
              if (comanda) {
                 comandaSums[comanda] = (comandaSums[comanda] || 0) + val;
                 hasComandas = true;
              } else {
                 sharedTotal += val;
              }
           });
           
           if (hasComandas) {
              divRacha.style.display = 'block';
              
              const activeComandaNames = Object.keys(comandaSums);
              const numComandas = activeComandaNames.length;
              
              const isSharedSplit = chkRachaShared && chkRachaShared.checked;
              const sharePerComanda = isSharedSplit ? (sharedTotal / numComandas) : 0;
              
              let rachaHTML = '';
              activeComandaNames.forEach(cName => {
                 let total = comandaSums[cName] + sharePerComanda;
                 
                 const serviceCheckbox = document.getElementById('taxa-servico');
                 if (serviceCheckbox && serviceCheckbox.checked) {
                    total *= 1.1;
                 }
                 
                 rachaHTML += `
                    <div class="comanda-racha-row" onclick="window.abrirCheckoutComandaModal('${cName}')" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#fff; border:1px solid #ffe2d1; border-radius:6px; cursor:pointer; transition:0.2s; margin-bottom: 4px;">
                       <span style="font-weight:600; color:#fc4b15;"><i class="ph ph-user"></i> ${cName}</span>
                       <span style="font-weight:700; color:#3ab55b;">R$ ${total.toFixed(2).replace('.', ',')}</span>
                    </div>
                 `;
              });
              
              if (!isSharedSplit && sharedTotal > 0) {
                 let sharedVal = sharedTotal;
                 const serviceCheckbox = document.getElementById('taxa-servico');
                 if (serviceCheckbox && serviceCheckbox.checked) {
                    sharedVal *= 1.1;
                 }
                 rachaHTML += `
                    <div class="comanda-racha-row" onclick="window.abrirCheckoutComandaModal('')" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#f9f9f9; border:1px dashed #ccc; border-radius:6px; cursor:pointer; color:#777;">
                       <span><i class="ph ph-squares-four"></i> Itens Compartilhados</span>
                       <span style="font-weight:700;">R$ ${sharedVal.toFixed(2).replace('.', ',')}</span>
                    </div>
                 `;
              }
              
              listRacha.innerHTML = rachaHTML;
           } else {
              divRacha.style.display = 'none';
           }
        }

       updateSummaryValue('resumo-produtos', item.totalBruto || item.total);
       updateSummaryValue('resumo-comissao', item.total * 0.1);
       updateSummaryValue('resumo-subtotal', item.totalBruto || item.total);

       const taxaCheckbox = document.getElementById('taxa-servico');
       window.calcularTotal = () => {
         let totalComTaxa = (item.totalBruto || item.total) + window.servicoAdicional - window.descontoAdicional;
         let valorServicos = window.servicoAdicional;
         
         if (taxaCheckbox && taxaCheckbox.checked) {
           const baseParaTaxa = Math.max(0, (item.totalBruto || item.total) - window.descontoAdicional);
           valorServicos += baseParaTaxa * 0.10;
           totalComTaxa += baseParaTaxa * 0.10;
         }
         
         updateSummaryValue('resumo-taxas', valorServicos);
         
         const descEl = document.getElementById('resumo-descontos');
         if(descEl) descEl.innerText = `R$ ${window.descontoAdicional.toFixed(2).replace('.', ',')}`;

         document.getElementById('total-pagar-text').innerText = `R$ ${totalComTaxa.toFixed(2).replace('.', ',')}`;
         return totalComTaxa;
       };

       window.calcularTotal();
       if(taxaCheckbox) taxaCheckbox.onchange = () => { window.calcRestante(); };

       window.pagamentosParciais = item.pagamentosParciais || [];
       
       window.calcRestante = () => {
           const finalTotal = window.calcularTotal();
           const pago = window.pagamentosParciais.reduce((acc, curr) => acc + curr.valor, 0);
           const taxaMult = (taxaCheckbox && taxaCheckbox.checked) ? 1.1 : 1.0;
           const paidItemsTotal = ((window.mesaAtual.totalBruto || window.mesaAtual.total) - window.mesaAtual.total) * taxaMult;
           const falta = finalTotal - pago - paidItemsTotal;
           
           // Atualizar textos antigos (se existirem)
           const elTot = document.getElementById('total-pagar-text');
           if(elTot) elTot.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
           const elPago = document.getElementById('total-pago-text');
           if(elPago) elPago.innerText = `R$ ${pago.toFixed(2).replace('.', ',')}`;
           const elFalta = document.getElementById('falta-pagar-text');
           if(elFalta) elFalta.innerText = `R$ ${falta > 0 ? falta.toFixed(2).replace('.', ',') : '0,00'}`;
           
           // Atualizar textos do Modal Novo
           const modTotal = document.getElementById('modal-total');
           if(modTotal) modTotal.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
           const modPago = document.getElementById('modal-pago');
           if(modPago) modPago.innerText = `R$ ${pago.toFixed(2).replace('.', ',')}`;
           const modRest = document.getElementById('modal-restante');
           const modRestLabel = document.getElementById('modal-restante-label');
           if(modRestLabel && modRest) {
             if (falta < -0.01) {
                modRestLabel.innerText = 'Troco:';
                modRest.innerText = `R$ ${Math.abs(falta).toFixed(2).replace('.', ',')}`;
             } else {
                modRestLabel.innerText = 'Faltando:';
                modRest.innerText = `R$ ${falta > 0 ? falta.toFixed(2).replace('.', ',') : '0,00'}`;
             }
           }
           
           // Atualizar lista de pagamentos no Modal (e no antigo se precisar)
           const htmlLista = window.pagamentosParciais.map((p, idx) => `
               <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
                 <span style="font-size: 16px;">${p.metodo}</span>
                 <span style="font-size: 18px; font-weight: bold;">R$ ${p.valor.toFixed(2).replace('.', ',')} 
                   <i class="ph ph-trash" style="color:#e74c3c; cursor:pointer; margin-left: 12px;" onclick="window.removerPagamento(${idx}, ${p.id})"></i>
                 </span>
               </div>
           `).join('');
           
           const listaElModal = document.getElementById('modal-lista-pagamentos');
           if (listaElModal) listaElModal.innerHTML = htmlLista;
           const listaElAntiga = document.getElementById('lista-pagamentos-parciais');
           if (listaElAntiga) listaElAntiga.innerHTML = htmlLista;
           
           const btnFinalizar = document.getElementById('btn-finalizar-venda');
           if (btnFinalizar) {
             if (falta <= 0.01 && (window.pagamentosParciais.length > 0 || finalTotal === 0)) {
               btnFinalizar.style.opacity = '1';
               btnFinalizar.style.pointerEvents = 'auto';
               btnFinalizar.onclick = () => {
                 btnFinalizar.innerHTML = '<i class="ph ph-spinner-gap"></i> Processando...';
                 socket.emit('finalizar_mesa', { 
                   mesaName: nomeMesa, 
                   payments: window.pagamentosParciais,
                   totalValue: finalTotal
                 });
               }
             } else {
               btnFinalizar.style.opacity = '0.5';
               btnFinalizar.style.pointerEvents = 'none';
               btnFinalizar.onclick = null;
               btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 28px;"></i> FINALIZAR VENDA';
             }
           }
           return finalTotal;
         };
       window.calcRestante();
    });
  });

  if (typeof window.updateTimers === 'function') window.updateTimers();
}

window.removerItemPedido = (id) => {
  const senha = prompt('Digite a senha do administrador para excluir este item:');
  if (senha === 'adm') {
    socket.emit('remover_pedido_item', id);
  } else if (senha !== null) {
    alert('Senha incorreta!');
  }
};

window.removerPagamento = (idx, id) => {
  const senha = prompt('Digite a senha do administrador para remover este pagamento:');
  if (senha === 'adm') {
    if (id) {
      socket.emit('remover_pedido_item', id);
    } else {
      window.pagamentosParciais.splice(idx, 1);
      window.calcRestante();
    }
  } else if (senha !== null) {
    alert('Senha incorreta!');
  }
};

setInterval(() => {
  const now = new Date();
  const clk = document.getElementById('status-clock');
  const dt = document.getElementById('status-date');
  if(clk) clk.innerText = now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
  if(dt) dt.innerText = now.toLocaleDateString('pt-BR');
}, 1000);

window.updateTimers = () => {
  document.querySelectorAll('.time-badge[data-created]').forEach(el => {
    const createdStr = el.getAttribute('data-created');
    if (!createdStr || createdStr === 'undefined') return;
    const createdAt = new Date(createdStr);
    const diffMins = Math.floor((new Date() - createdAt) / 60000);
    el.innerHTML = `<i class="ph ph-clock"></i> ${diffMins} min`;
    if (diffMins >= 60) {
      el.style.color = '#eb5757';
      el.style.backgroundColor = '#fce8e8';
    }
  });
};
setInterval(window.updateTimers, 30000);

  function updateSummaryValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.innerText = `R$ ${value.toFixed(2).replace('.', ',')}`;
    }
  }
  
  // WebSocket Events
  socket.on('initial_data', (data) => {
    socket.emit('get_mesas'); // Ensure we fetch mesas
    ordersData = data;
    renderOrders();
  });

  socket.on('pedidos_atualizados', (pedidos) => {
    ordersData = pedidos;
    renderOrders();
  });
  
  socket.on('pedido_adicionado', (novoPedido) => {
    ordersData.push(novoPedido);
    renderOrders();
  });
  
  socket.on('status_atualizado', (pedidoAtualizado) => {
    const index = ordersData.findIndex(o => o.id === pedidoAtualizado.id);
    if (index !== -1) {
      ordersData[index] = pedidoAtualizado;
      renderOrders();
    }
});

socket.on('mesa_finalizada', ({ mesaName }) => {
    // Remove items that were closed
    ordersData = ordersData.filter(o => o.localName !== mesaName);
    renderOrders();
    
    // Sucesso Interativo e Dinâmico
    const btnFinalizarModal = document.getElementById('btn-finalizar-venda');
    if (btnFinalizarModal && btnFinalizarModal.innerHTML.includes('Processando')) {
      // Efeito de Confete
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#3ab55b', '#ffffff', '#2D9CDB']
        });
      }

      // Tocar som de sucesso (Cha-Ching)
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if(AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
          osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch (e) {}
      
      // Atualiza visual do botão para sucesso
      btnFinalizarModal.style.background = '#27ae60';
      btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 32px;"></i> VENDA CONCLUÍDA!';
      
      // Fecha o modal automaticamente após 2.5 segundos
      setTimeout(() => {
        const modalPagamento = document.getElementById('pagamento-overlay');
        if (modalPagamento) modalPagamento.style.display = 'none';
        
        // Reseta o botão para a próxima venda
        btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 28px;"></i> FINALIZAR VENDA';
        btnFinalizarModal.style.background = '#3ab55b';
      }, 2500);
    }
    
    const rightPanel = document.querySelector('.right-panel');
    if(rightPanel) {
      const itemsContainer = document.getElementById('panel-items');
      if (itemsContainer) itemsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: gray;">Mesa Paga / Finalizada</div>';
      
      const panelHeader = document.querySelector('.panel-header h2');
      if (panelHeader) panelHeader.innerText = 'Mesa Paga';
      
      const paymentVal = document.querySelector('.payment-val');
      if (paymentVal) paymentVal.innerText = 'R$ 0,00';
      
      const btnFinalizar = document.getElementById('btn-finalizar');
      if(btnFinalizar) {
        btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 20px;"></i> Finalizada';
        btnFinalizar.disabled = true;
      }
    }
  });

// Caixa Logic
  socket.on('erro_caixa', (msg) => {
    alert(msg);
    const btnFinalizar = document.getElementById('btn-finalizar-venda');
    if(btnFinalizar) btnFinalizar.innerHTML = 'FINALIZAR VENDA';
  });

  socket.on('atualizacao_caixa', () => {
    socket.emit('get_estado_caixa');
    socket.emit('get_financeiro');
    socket.emit('get_relatorios');
  });
  
  socket.on('estado_caixa', (turno) => {
  const overlay = document.getElementById('caixa-overlay');
  const span = document.getElementById('status-caixa-name');
  if (turno) {
    if (overlay) overlay.style.display = 'none';
    if (span) span.innerText = 'Caixa Aberto';
    console.log("Caixa está aberto:", turno);
  } else {
    if (overlay) overlay.style.display = 'flex';
    if (span) span.innerText = 'Caixa Fechado';
    console.log("Caixa está fechado.");
  }
});

document.addEventListener('DOMContentLoaded', () => {
  socket.emit('get_estado_caixa');
  socket.emit('get_produtos');
  socket.emit('get_funcionarios');
  
  const btnAbrir = document.getElementById('btn-abrir-caixa');
  if (btnAbrir) {
    btnAbrir.onclick = () => {
      alert("Botão clicado! Verificando conexão com o servidor...");
      let valInput = document.getElementById('fundo-troco').value;
      if (!valInput) valInput = '0';
      const fundo = parseFloat(valInput.replace(',', '.'));
      if (!isNaN(fundo)) {
        console.log("Emitindo abrir_caixa:", fundo);
        socket.emit('abrir_caixa', { fundo_troco: fundo });
      } else {
        alert('Digite um valor numérico válido para o fundo de troco.');
      }
    };
  }

  const btnNovo = document.getElementById('btn-adicionar-produtos');
  const pdvOverlay = document.getElementById('pdv-overlay');

  window.pdvCart = [];
  window.pdvCurrentCategory = 'Todas';
  window.pdvConfigs = {};

  function fetchPdvConfigs() {
    fetch('/api/config')
      .then(r => r.json())
      .then(conf => {
        window.pdvConfigs = conf;
        if (typeof window.renderPdvMenu === 'function') window.renderPdvMenu();
      })
      .catch(e => console.error("Erro fetch configs:", e));
  }
  fetchPdvConfigs();
  socket.on('configuracoes_atualizadas', fetchPdvConfigs);

  window.renderPdvMenu = () => {
    if (!window.allProducts) return;
    const catsDiv = document.getElementById('pdv-categories');
    const itemsDiv = document.getElementById('pdv-menu-items');
    if (!catsDiv || !itemsDiv) return;

    let categories = [...new Set(window.allProducts.map(p => p.categoria))];

    if (window.pdvConfigs && window.pdvConfigs.ordem_categorias) {
      try {
        const order = JSON.parse(window.pdvConfigs.ordem_categorias);
        categories.sort((a, b) => {
          let idxA = order.indexOf(a);
          let idxB = order.indexOf(b);
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
      } catch(e){}
    }
    
    if (categories.includes('Mais Pedidos')) {
      categories = ['Mais Pedidos', ...categories.filter(t => t !== 'Mais Pedidos')];
    }
    
    categories = ['Todas', ...categories];

    catsDiv.innerHTML = categories.map(c => `
      <button class="pdv-category-btn ${c === window.pdvCurrentCategory ? 'active' : ''}" 
              onclick="window.pdvCurrentCategory='${c}'; window.renderPdvMenu()"
              style="padding: 10px; border-radius: 8px; border: none; background: ${c === window.pdvCurrentCategory ? '#fc4b15' : '#eee'}; color: ${c === window.pdvCurrentCategory ? 'white' : '#333'}; font-weight: bold; cursor: pointer; text-align: left; width: 100%;">
        ${c}
      </button>
    `).join('');

    const query = window.pdvSearchQuery || '';
    let filteredProds = [];
    if (query.trim() !== '') {
      filteredProds = window.allProducts.filter(p => p.nome.toLowerCase().includes(query) || (p.categoria && p.categoria.toLowerCase().includes(query)));
    } else {
      filteredProds = window.pdvCurrentCategory === 'Todas' ? window.allProducts : window.allProducts.filter(p => p.categoria === window.pdvCurrentCategory);
    }

    itemsDiv.innerHTML = filteredProds.map(p => `
      <button class="pdv-item" onclick="window.pdvAddToCart(${p.id})"
              style="padding: 16px; border: 1px solid #eee; border-radius: 8px; cursor: pointer; text-align: left; background: white; transition: 0.2s;">
         <div style="font-weight:bold; font-size: 16px;">${p.emoji} ${p.nome}</div>
         <div style="color: gray; font-size: 14px; margin-top: 4px;">R$ ${p.preco.toFixed(2).replace('.', ',')}</div>
      </button>
    `).join('');
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
      return `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #eee;">
          <div style="flex: 1; display: flex; flex-direction: column;">
            <strong style="font-size: 16px;">${item.nome}</strong>
            <span style="color: gray; font-size: 14px;">R$ ${item.preco.toFixed(2).replace('.', ',')} x ${item.quantity}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button onclick="window.pdvRemoveFromCart(${item.id})" style="background: #eee; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">-</button>
            <span style="font-size: 14px; width: 20px; text-align: center;">${item.quantity}</span>
            <button onclick="window.pdvAddToCart(${item.id})" style="background: #3ab55b; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">+</button>
          </div>
        </li>
      `;
    }).join('');
    
    if (window.pdvCart.length === 0) cartList.innerHTML = '<li style="text-align:center; padding: 20px; color: gray;">Carrinho vazio</li>';
    
    const taxa = parseFloat(document.getElementById('pdv-taxa-entrega')?.value || 0);
    if (document.getElementById('pdv-tipo-pedido')?.value === 'Delivery') total += taxa;
    
    totalPrice.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
  };

    if (btnNovo && pdvOverlay) {
      btnNovo.onclick = () => {
        window.pdvCart = [];
        window.renderPdvCart();
        window.renderPdvMenu();
        
        const tipoPedido = document.getElementById('pdv-tipo-pedido');
        const clienteNomeInput = document.getElementById('pdv-cliente-nome');
        
        if (window.mesaAtual && tipoPedido) {
            tipoPedido.value = 'Mesa';
            tipoPedido.dispatchEvent(new Event('change'));
            tipoPedido.disabled = true;
            if (clienteNomeInput) {
               clienteNomeInput.value = window.mesaAtual.nome || window.mesaAtual.mesaName;
               clienteNomeInput.disabled = true;
            }
        } else if (tipoPedido) {
            tipoPedido.disabled = false;
            if (clienteNomeInput) clienteNomeInput.disabled = false;
            if (tipoPedido.value === 'Mesa') {
                tipoPedido.value = 'Balcão';
                tipoPedido.dispatchEvent(new Event('change'));
            }
            if (clienteNomeInput) clienteNomeInput.value = '';
        }
        
        pdvOverlay.style.display = 'flex';
      };
    }

  const btnFecharPdv = document.getElementById('btn-fechar-pdv');
  if (btnFecharPdv) {
    btnFecharPdv.onclick = () => pdvOverlay.style.display = 'none';
  }

  const tipoPedido = document.getElementById('pdv-tipo-pedido');
  if (tipoPedido) {
    tipoPedido.onchange = (e) => {
      document.getElementById('pdv-delivery-fields').style.display = e.target.value === 'Delivery' ? 'flex' : 'none';
      window.renderPdvCart();
    };
  }

  const taxaEntregaInput = document.getElementById('pdv-taxa-entrega');
  if(taxaEntregaInput) taxaEntregaInput.oninput = window.renderPdvCart;

  // --- AUTO-COMPLETE CLIENTE POR TELEFONE ---
  const pdvTelInput = document.getElementById('pdv-cliente-telefone');
  let searchTimeout = null;
  if (pdvTelInput) {
    pdvTelInput.addEventListener('input', (e) => {
       const tel = e.target.value.trim();
       if (tel.length >= 8) {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
             socket.emit('buscar_cliente_telefone', tel);
          }, 500);
       }
    });
  }

  socket.on('resultado_cliente_telefone', (cliente) => {
    if (cliente) {
       document.getElementById('pdv-cliente-id').value = cliente.id;
       document.getElementById('pdv-cliente-nome').value = cliente.nome;
       if (cliente.endereco && document.getElementById('pdv-cliente-endereco')) {
          document.getElementById('pdv-cliente-endereco').value = cliente.endereco;
       }
       if (cliente.pontos !== undefined) {
          document.getElementById('pdv-cliente-pontos').innerText = `⭐ ${cliente.pontos} pts`;
       }
       if (cliente.observacao) {
          alert(`Atenção: O cliente ${cliente.nome} possui a seguinte observação em seu cadastro:\n\n"${cliente.observacao}"`);
       }
    } else {
       document.getElementById('pdv-cliente-id').value = '';
       document.getElementById('pdv-cliente-pontos').innerText = '';
    }
  });

  // --- SCANNER DE QR CODE DE PREMIO ---
  const qrInput = document.getElementById('pdv-qr-premio');
  if (qrInput) {
    qrInput.addEventListener('keydown', (e) => {
       if (e.key === 'Enter') {
          e.preventDefault();
          const code = qrInput.value.trim();
          if (code !== '') {
             socket.emit('resgatar_premio_qr', code);
             qrInput.value = '';
          }
       }
    });
  }

  socket.on('resgate_erro', (msg) => {
    alert(msg);
  });

  socket.on('resgate_sucesso', ({ cliente, produto, custo }) => {
    alert(`Prêmio resgatado com sucesso!\nCliente: ${cliente.nome}\nCusto: ${custo} pts\nProduto: ${produto}\n\nO item foi adicionado ao carrinho com custo R$ 0,00.`);
    // Adicionar o produto no carrinho com preço 0
    window.pdvCart.push({
      id: 'premio_' + Date.now(),
      nome: produto + ' (Prêmio)',
      emoji: '🎁',
      preco: 0.00,
      quantity: 1,
      categoria: 'Prêmios'
    });
    window.renderPdvCart();
    
    // Atualizar os pontos exibidos no PDV (subtrair)
    document.getElementById('pdv-cliente-pontos').innerText = `⭐ ${cliente.pontos - custo} pts`;
  });

  const btnLancarPdv = document.getElementById('btn-lancar-pdv');
  if (btnLancarPdv) {
    btnLancarPdv.onclick = () => {
      if(window.pdvCart.length === 0) return alert('Adicione itens!');
      
      const tipo = document.getElementById('pdv-tipo-pedido').value;
      const clienteNome = document.getElementById('pdv-cliente-nome').value || 'Avulso';
      const clienteId = document.getElementById('pdv-cliente-id').value || null;
      const entregadorId = document.getElementById('pdv-entregador-select').value;
      const taxaEntrega = parseFloat(document.getElementById('pdv-taxa-entrega')?.value || 0);

      window.pdvCart.forEach(item => {
        let sector = item.setor || 'Cozinha 1';
        
        let finalLocalName = `Balcão - ${clienteNome}`;
        if (tipo === 'Delivery') {
            finalLocalName = `Delivery - ${clienteNome}`;
        } else if (tipo === 'Mesa') {
            finalLocalName = clienteNome;
        }

        const pedido = {
          productName: item.nome,
          productEmoji: item.emoji,
          quantity: item.quantity,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          localName: finalLocalName,
          userName: window.loggedInUser || 'Caixa',
          total: (item.preco * item.quantity).toFixed(2).replace('.', ','),
          status: 'Recebido',
          status_inicial: item.status_inicial,
          sector: sector,
          cliente_id: clienteId,
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
         localName: `Delivery - ${clienteNome}`,
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
  }
});


// --- ADMIN PANEL LOGIC ---
const btnAdminPanel = document.getElementById('btn-admin-panel');
const adminOverlay = document.getElementById('admin-overlay');
const btnFecharAdmin = document.getElementById('btn-fechar-admin');

// Removed if (btnAdminPanel && adminOverlay) so socket listeners can attach
  
  // Tabs logic (Kept for compatibility, now handled mainly in configuracoes.js but harmless here)
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.fontWeight = 'normal';
      });
      btn.classList.add('active');
      btn.style.background = '#eee';
      btn.style.fontWeight = 'bold';

      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
      document.getElementById('admin-tab-' + btn.dataset.tab).style.display = 'block';
    };
  });

  // Socket updates
  socket.on('mesas_atualizadas', (mesas) => {
    window.allMesas = mesas;
    if (typeof renderOrders === 'function') renderOrders();
    
    const list = document.getElementById('admin-mesas-list');
    if(!list) return;
    list.innerHTML = mesas.map(m => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${m.id}</td>
        <td style="padding: 10px;">${m.nome} <span style="font-size:12px; color:gray;">(${m.status})</span></td>
        <td style="padding: 10px;">
          <button onclick="window.deleteMesa(${m.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
  });

  socket.on('produtos_atualizados', (prods) => {
    window.allProducts = prods;
    if (typeof window.renderPdvMenu === 'function') window.renderPdvMenu();
    const list = document.getElementById('admin-produtos-list');
    if(!list) return;
    list.innerHTML = prods.map(p => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${p.categoria}</td>
        <td style="padding: 10px;">${p.emoji} ${p.nome}</td>
        <td style="padding: 10px;">R$ ${p.preco.toFixed(2)}</td>
        <td style="padding: 10px;">${p.setor || 'Cozinha 1'}</td>
        <td style="padding: 10px;">${p.status_inicial || 'Em espera'}</td>
        <td style="padding: 10px;">
          <button onclick="window.editProduto(${p.id}, '${p.categoria.replace(/'/g, "\\'")}', '${p.nome.replace(/'/g, "\\'")}', ${p.preco}, '${(p.emoji || '').replace(/'/g, "\\'")}', '${p.setor || 'Cozinha 1'}', '${p.status_inicial || 'Em espera'}')" style="color: #2D9CDB; border: none; background: none; cursor: pointer; margin-right: 8px;"><i class="ph ph-pencil"></i> Editar</button>
          <button onclick="window.deleteProduto(${p.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
  });

  socket.on('funcionarios_atualizados', (funcs) => {
    const pdvSelect = document.getElementById('pdv-entregador-select');
    if (pdvSelect) {
      pdvSelect.innerHTML = '<option value="">Nenhum</option>' + 
        funcs.filter(f => f.status !== 'Pendente')
             .map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
    }
    const listAtivos = document.getElementById('admin-funcionarios-list');
    const listPendentes = document.getElementById('admin-funcionarios-pendentes');
    if(!listAtivos || !listPendentes) return;

    window.funcionariosList = funcs;
      const pendentes = funcs.filter(f => f.status === 'Pendente');
    const ativos = funcs.filter(f => f.status !== 'Pendente');

    listPendentes.innerHTML = pendentes.map(f => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${f.nome}</td>
        <td style="padding: 10px;">${f.usuario}</td>
        <td style="padding: 10px; text-align: right;">
          <select id="cargo-pendente-${f.id}" style="padding: 6px; border-radius: 6px; border: 1px solid #ccc; margin-right: 8px; font-family: Inter;">
            <option value="Garçom">Garçom</option>
            <option value="Caixa">Caixa</option>
            <option value="Cozinha">Cozinha</option>
            <option value="Bar">Bar</option>
            <option value="Copa">Copa</option>
            <option value="Auxiliar">Auxiliar</option>
          </select>
          <button onclick="window.aprovarFuncionario(${f.id})" style="color: white; background: #3ab55b; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-right: 4px; font-weight: bold;"><i class="ph ph-check"></i> Aprovar</button>
          <button onclick="window.recusarFuncionario(${f.id})" style="color: white; background: #eb5757; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="ph ph-x"></i> Recusar</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="padding: 10px; text-align: center; color: gray;">Nenhum cadastro pendente</td></tr>`;

    listAtivos.innerHTML = ativos.map(f => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${f.nome}</td>
        <td style="padding: 10px;">${f.usuario}</td>
        <td style="padding: 10px;">${f.cargo}</td>
        <td style="padding: 10px;">
          <button onclick="window.abrirModalEditarFuncionario(${f.id})" style="color: #2b5c9e; border: none; background: none; cursor: pointer; margin-right: 10px;"><i class="ph ph-pencil"></i> Editar</button>
            <button onclick="window.deleteFuncionario(${f.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
  });

  // Global functions for inline onclicks
  window.deleteMesa = (id) => { if(confirm('Excluir mesa?')) socket.emit('delete_mesa', id); };
  window.deleteProduto = (id) => { if(confirm('Excluir produto?')) socket.emit('delete_produto', id); };
  
  window.editProduto = (id, categoria, nome, preco, emoji, setor, status_inicial) => {
    document.getElementById('admin-prod-id').value = id;
    document.getElementById('admin-prod-cat').value = categoria;
    document.getElementById('admin-prod-nome').value = nome;
    document.getElementById('admin-prod-preco').value = preco;
    document.getElementById('admin-prod-emoji').value = emoji;
    document.getElementById('admin-prod-setor').value = setor;
    const siEl = document.getElementById('admin-prod-status-inicial');
    if (siEl) siEl.value = status_inicial || 'Em espera';
    const btn = document.getElementById('btn-admin-add-prod');
    if (btn) btn.innerHTML = '<i class="ph ph-check"></i> Salvar';
  };

  window.deleteFuncionario = (id) => { if(confirm('Excluir funcionário?')) socket.emit('delete_funcionario', id); };
  window.aprovarFuncionario = (id) => { 
    if(confirm('Aprovar este colaborador?')) {
      let cargoSelect = document.getElementById('cargo-pendente-' + id);
      let cargo = cargoSelect ? cargoSelect.value : 'Garçom'; let vInput = document.getElementById('valor-pendente-' + id); let valor_hora = vInput ? parseFloat(vInput.value) || 0 : 0;
      socket.emit('aprovar_funcionario', { id: id, cargo: cargo, valor_hora: valor_hora }); 
    }
  };
  window.recusarFuncionario = (id) => { if(confirm('Recusar este colaborador?')) socket.emit('recusar_funcionario', id); };

  // Add Listeners
  const addMesaBtn = document.getElementById('btn-admin-add-mesa');
  if (addMesaBtn) addMesaBtn.onclick = () => {
    const nome = document.getElementById('admin-mesa-nome').value;
    if(nome) { socket.emit('add_mesa', nome); document.getElementById('admin-mesa-nome').value = ''; }
  };

  const addProdBtn = document.getElementById('btn-admin-add-prod');
  if (addProdBtn) addProdBtn.onclick = () => {
    const id = document.getElementById('admin-prod-id').value;
    const categoria = document.getElementById('admin-prod-cat').value;
    const nome = document.getElementById('admin-prod-nome').value;
    const preco = parseFloat(document.getElementById('admin-prod-preco').value);
    const emoji = document.getElementById('admin-prod-emoji').value;
    const setor = document.getElementById('admin-prod-setor').value || 'Cozinha 1';
    const siEl = document.getElementById('admin-prod-status-inicial');
    const status_inicial = siEl ? siEl.value : 'Em espera';
    
    if(categoria && nome && !isNaN(preco)) {
      if (id) {
        socket.emit('edit_produto', { id, categoria, nome, preco, emoji: emoji || '🍔', setor, status_inicial });
      } else {
        socket.emit('add_produto', { categoria, nome, preco, emoji: emoji || '🍔', hasAddons: false, setor, status_inicial });
      }
      document.getElementById('admin-prod-id').value = '';
      document.getElementById('admin-prod-nome').value = '';
      document.getElementById('admin-prod-preco').value = '';
      document.getElementById('admin-prod-emoji').value = '';
      if (siEl) siEl.value = 'Em espera';
      addProdBtn.innerHTML = '<i class="ph ph-plus"></i>';
    }
  };

  const addFuncBtn = document.getElementById('btn-admin-add-func');
  if (addFuncBtn) addFuncBtn.onclick = () => {
    const nome = document.getElementById('admin-func-nome').value;
    const usuario = document.getElementById('admin-func-user').value;
    const senha = document.getElementById('admin-func-pass').value;
    const cargo = document.getElementById('admin-func-cargo').value;
    if(nome && usuario && senha) {
      const valor_hora = parseFloat(document.getElementById('admin-func-valor-hora').value) || 0; socket.emit('add_funcionario', { nome, usuario, senha, cargo, valor_hora });
      document.getElementById('admin-func-nome').value = '';
      document.getElementById('admin-func-user').value = '';
      document.getElementById('admin-func-pass').value = '';
    }
  };

  // Clientes
  socket.on('clientes_atualizados', (lista) => {
    const tbody = document.getElementById('admin-clientes-list');
    if (!tbody) return;
    tbody.innerHTML = lista.map(c => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${c.id}</td>
        <td style="padding: 10px;">${c.nome}<br><small style="color:gray;">Nasc: ${c.data_nascimento ? new Date(c.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}</small></td>
        <td style="padding: 10px;">${c.telefone || '-'}<br><small style="color:gray;">End: ${c.endereco || '-'}</small></td>
        <td style="padding: 10px; max-width: 150px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${c.observacao || ''}">${c.observacao || '-'}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: #3ab55b;">⭐ ${c.pontos || 0}</td>
        <td style="padding: 10px;">
          <button onclick="window.editCliente(${c.id}, '${c.nome.replace(/'/g, "\\'")}', '${c.telefone || ''}', '${(c.observacao || '').replace(/'/g, "\\'")}', '${(c.endereco || '').replace(/'/g, "\\'")}', '${c.data_nascimento || ''}')" style="color: #2D9CDB; border: none; background: none; cursor: pointer; margin-right: 8px;"><i class="ph ph-pencil"></i></button>
          <button onclick="window.deleteCliente(${c.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i></button>
        </td>
      </tr>
    `).join('');
  });

  window.editCliente = (id, nome, telefone, observacao, endereco, nascimento) => {
    document.getElementById('admin-cli-id').value = id;
    document.getElementById('admin-cli-nome').value = nome;
    document.getElementById('admin-cli-tel').value = telefone;
    document.getElementById('admin-cli-obs').value = observacao;
    document.getElementById('admin-cli-endereco').value = endereco;
    document.getElementById('admin-cli-nascimento').value = nascimento;
    const btn = document.getElementById('btn-admin-add-cli');
    if (btn) btn.innerText = 'Atualizar';
  };

  // Promocoes
  socket.on('promocoes_atualizadas', (lista) => {
    window.PROMOCOES = lista;
    const tbody = document.getElementById('admin-promocoes-list');
    if (!tbody) return;
    tbody.innerHTML = lista.map(p => {
      let cfg = {};
      try { cfg = JSON.parse(p.config || '{}'); } catch(e){}
      
      let diasStr = cfg.dias_semana ? cfg.dias_semana.map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d]).join(', ') : 'Todos';
      let horaStr = (cfg.horario_inicio && cfg.horario_fim) ? `${cfg.horario_inicio} às ${cfg.horario_fim}` : 'Sempre';
      let regraStr = `Tipo: ${cfg.tipo_promocao}<br><small>${diasStr} | ${horaStr}</small>`;

      return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${p.nome}</td>
        <td style="padding: 10px;">${cfg.tipo_promocao === 'combo' ? 'Combo' : (cfg.tipo_promocao === 'livre' ? 'Rodízio' : 'Desconto/Preço')}</td>
        <td style="padding: 10px;">${regraStr}</td>
        <td style="padding: 10px;">
          <button onclick="window.deletePromocao(${p.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
      `;
    }).join('');
  });

  window.deleteCliente = (id) => { if(confirm('Excluir cliente?')) socket.emit('delete_cliente', id); };
  window.deletePromocao = (id) => { if(confirm('Excluir promoção?')) socket.emit('delete_promocao', id); };

  const addCliBtn = document.getElementById('btn-admin-add-cli');
  if (addCliBtn) addCliBtn.onclick = () => {
    const id = document.getElementById('admin-cli-id').value;
    const nome = document.getElementById('admin-cli-nome').value;
    const telefone = document.getElementById('admin-cli-tel').value;
    const observacao = document.getElementById('admin-cli-obs').value;
    const endereco = document.getElementById('admin-cli-endereco').value;
    const data_nascimento = document.getElementById('admin-cli-nascimento').value;

    if(nome) {
      socket.emit('add_cliente', { id: id || null, nome, telefone, observacao, endereco, data_nascimento });
      document.getElementById('admin-cli-id').value = '';
      document.getElementById('admin-cli-nome').value = '';
      document.getElementById('admin-cli-tel').value = '';
      document.getElementById('admin-cli-obs').value = '';
      document.getElementById('admin-cli-endereco').value = '';
      document.getElementById('admin-cli-nascimento').value = '';
      addCliBtn.innerText = 'Salvar';
    }
  };

  window.togglePromoFields = () => {
    const tipo = document.getElementById('admin-promo-tipo').value;
    document.getElementById('promo-fields-desconto').style.display = tipo === 'desconto_fixo' ? 'block' : 'none';
    document.getElementById('promo-fields-produto').style.display = tipo === 'preco_fixo' ? 'flex' : 'none';
    document.getElementById('promo-fields-combo').style.display = tipo === 'combo' ? 'flex' : 'none';
    document.getElementById('promo-fields-livre').style.display = tipo === 'livre' ? 'block' : 'none';
    
    // Combo tbm precisa do produto alvo
    if (tipo === 'combo') {
       document.getElementById('promo-fields-produto').style.display = 'flex';
       document.getElementById('admin-promo-novopreco').style.display = 'none'; // combo pode não alterar preço do principal
    } else {
       const elPreco = document.getElementById('admin-promo-novopreco');
       if(elPreco) elPreco.style.display = 'block';
    }
  };

  const addPromoBtn = document.getElementById('btn-admin-add-promo');
  if (addPromoBtn) addPromoBtn.onclick = () => {
    const nome = document.getElementById('admin-promo-nome').value;
    if(!nome) return alert('Nome da promoção obrigatório!');
    
    const config = {
      tipo_promocao: document.getElementById('admin-promo-tipo').value,
      dias_semana: Array.from(document.querySelectorAll('#admin-promo-dias input:checked')).map(cb => parseInt(cb.value)),
      horario_inicio: document.getElementById('admin-promo-inicio').value || null,
      horario_fim: document.getElementById('admin-promo-fim').value || null,
    };

    let desconto = 0;

    if (config.tipo_promocao === 'desconto_fixo') {
       desconto = parseFloat(document.getElementById('admin-promo-desc').value) || 0;
    } else if (config.tipo_promocao === 'preco_fixo') {
       config.produto_alvo_nome = document.getElementById('admin-promo-alvo').value.trim();
       config.novo_preco = parseFloat(document.getElementById('admin-promo-novopreco').value) || 0;
    } else if (config.tipo_promocao === 'combo') {
       config.produto_alvo_nome = document.getElementById('admin-promo-alvo').value.trim();
       config.produto_brinde_nome = document.getElementById('admin-promo-brinde').value.trim();
    } else if (config.tipo_promocao === 'livre') {
       const cats = document.getElementById('admin-promo-cats').value.split(',').map(s => s.trim()).filter(s => s);
       config.categorias_inclusas = cats;
    }

    socket.emit('add_promocao', { nome, regra: config.tipo_promocao, desconto, ativo: true, config: JSON.stringify(config) });
    
    document.getElementById('admin-promo-nome').value = '';
    document.querySelectorAll('#admin-promo-dias input').forEach(cb => cb.checked = false);
  };

// System Alert for "Pedir Conta"
socket.on('toque_pedir_conta', (mesaName) => {
  try {
    const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3', { query: { token: localStorage.getItem('chef_token') } });
    audio.play();
  } catch(e){}
  alert('🔔 A ' + mesaName + ' está pedindo a conta!');
});

document.addEventListener('DOMContentLoaded', () => {
  // --- LÓGICA DO MODAL DE PAGAMENTO ---
  let modalPaymentValue = 0; // valor em centavos
  let isPaymentModalOpen = false;

  function updatePaymentDisplay() {
    const display = document.getElementById('pagamento-display-input');
    if (!display) return;
    const reais = (modalPaymentValue / 100).toFixed(2).replace('.', ',');
    display.innerText = reais;
  }

  function appendDigit(digit) {
    const str = modalPaymentValue.toString();
    if (str.length < 9) { // max limit approx 999.999,99
      if (digit === '00') {
        modalPaymentValue = parseInt(str + '00', 10);
      } else {
        modalPaymentValue = parseInt(str + digit, 10);
      }
      updatePaymentDisplay();
    }
  }

  function backspaceDigit() {
    const str = modalPaymentValue.toString();
    if (str.length <= 1) {
      modalPaymentValue = 0;
    } else {
      modalPaymentValue = parseInt(str.slice(0, -1), 10);
    }
    updatePaymentDisplay();
  }

  const btnAbrirModal = document.getElementById('btn-abrir-modal-pagamento');
  const btnFecharModal = document.getElementById('btn-fechar-modal-pagamento');
  const modalPagamento = document.getElementById('pagamento-overlay');

  if (btnAbrirModal) {
    btnAbrirModal.onclick = () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      isPaymentModalOpen = true;
      modalPaymentValue = 0;
      updatePaymentDisplay();
      if (window.calcRestante) window.calcRestante(); // Refresh labels
      modalPagamento.style.display = 'flex';
    };
  }

  if (btnFecharModal) {
    btnFecharModal.onclick = () => {
      isPaymentModalOpen = false;
      modalPagamento.style.display = 'none';
    };
  }

  document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute('data-val');
      if (val === 'BACKSPACE') {
        backspaceDigit();
      } else {
        appendDigit(val);
      }
    };
  });

  document.addEventListener('keydown', (e) => {
    if (!isPaymentModalOpen) return;
    // Captura números do teclado físico
    if (e.key >= '0' && e.key <= '9') {
      appendDigit(e.key);
    } else if (e.key === 'Backspace') {
      backspaceDigit();
    }
  });

  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.onclick = () => {
      if (!window.pagamentosParciais) window.pagamentosParciais = [];
      const metodo = btn.getAttribute('data-method');
      const valor = modalPaymentValue / 100;
      
      if (valor > 0) {
        window.pagamentosParciais.push({ metodo, valor });
        modalPaymentValue = 0;
        updatePaymentDisplay();
        if (window.calcRestante) window.calcRestante();
      } else {
        // Se o operador clicou no método com visor zerado, e há um restante, auto-preencher?
        // Vamos permitir que ele digite o valor antes de clicar.
        const faltaTexto = document.getElementById('modal-restante').innerText.replace('R$ ', '').replace('.', '').replace(',','.');
        const falta = parseFloat(faltaTexto);
        if (falta > 0) {
           window.pagamentosParciais.push({ metodo, valor: falta });
           if (window.calcRestante) window.calcRestante();
        }
      }
    };
  });
});

window.removerPagamento = (idx) => {
  if (!window.pagamentosParciais) return;
  window.pagamentosParciais.splice(idx, 1);
  if (window.calcRestante) window.calcRestante();
};

// --- Resizable Panels Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const resizerLeft = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');

  // Load saved widths
  const savedLeftWidth = localStorage.getItem('leftPanelWidth');
  const savedRightWidth = localStorage.getItem('rightPanelWidth');
  if (savedLeftWidth && leftPanel) leftPanel.style.width = savedLeftWidth + 'px';
  if (savedRightWidth && rightPanel) rightPanel.style.width = savedRightWidth + 'px';

  // Resizer Left
  if (resizerLeft && leftPanel) {
    let isResizingLeft = false;
    resizerLeft.addEventListener('mousedown', (e) => {
      isResizingLeft = true;
      resizerLeft.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizingLeft) return;
      let newWidth = e.clientX;
      if (newWidth < 150) newWidth = 150;
      if (newWidth > 500) newWidth = 500;
      leftPanel.style.width = newWidth + 'px';
      localStorage.setItem('leftPanelWidth', newWidth);
    });
    document.addEventListener('mouseup', () => {
      if (isResizingLeft) {
        isResizingLeft = false;
        resizerLeft.classList.remove('dragging');
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    });
  }

  // Resizer Right
  if (resizerRight && rightPanel) {
    let isResizingRight = false;
    resizerRight.addEventListener('mousedown', (e) => {
      isResizingRight = true;
      resizerRight.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizingRight) return;
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 600) newWidth = 600;
      rightPanel.style.width = newWidth + 'px';
      localStorage.setItem('rightPanelWidth', newWidth);
    });
    document.addEventListener('mouseup', () => {
      if (isResizingRight) {
        isResizingRight = false;
        resizerRight.classList.remove('dragging');
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    });
  }
});

// --- Sidebar Actions Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const btnConta = document.getElementById('btn-imprimir-conta');
  const btnDesconto = document.getElementById('btn-aplicar-desconto');
  const btnServico = document.getElementById('btn-aplicar-servico');
  const btnComissao = document.getElementById('btn-ver-comissao');
  const btnAgrupar = document.getElementById('btn-agrupar-itens');

  if (btnConta) {
    btnConta.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      let itemsHtml = window.mesaAtual.items.map(i => `
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
          <span>${i.quantity||1}x ${i.productName}</span>
          <span>R$ ${parseFloat(String(i.total).replace(',','.')).toFixed(2).replace('.',',')}</span>
        </div>
      `).join('');
      
      const subtotal = window.mesaAtual.total;
      const taxaVal = window.servicoAdicional + (document.getElementById('taxa-servico')?.checked ? Math.max(0, subtotal - window.descontoAdicional)*0.1 : 0);
      const totalFinal = subtotal - window.descontoAdicional + taxaVal;

      printWindow.document.write(`
        <html><head><style>
          body { font-family: monospace; padding: 20px; width: 300px; color: #000; background: #fff; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
        </style></head><body>
          <div class="center bold" style="font-size:16px;">CHEF COZINHA</div>
          <div class="center" style="margin-bottom:10px;">CONFERÊNCIA DE MESA</div>
          <div>Mesa: <span class="bold">${window.mesaAtual.isGroup ? window.mesaAtual.mesaName : window.mesaAtual.nome}</span></div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>R$ ${subtotal.toFixed(2).replace('.',',')}</span></div>
          ${window.descontoAdicional > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Desconto:</span><span>- R$ ${window.descontoAdicional.toFixed(2).replace('.',',')}</span></div>` : ''}
          ${taxaVal > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Serviços/Taxas:</span><span>R$ ${taxaVal.toFixed(2).replace('.',',')}</span></div>` : ''}
          <div class="divider"></div>
          <div class="bold" style="display:flex; justify-content:space-between; font-size:14px;"><span>TOTAL:</span><span>R$ ${totalFinal.toFixed(2).replace('.',',')}</span></div>
          <div class="center" style="margin-top:20px; font-size:10px;">Obrigado pela preferência!</div>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    });
  }

  if (btnDesconto) {
    btnDesconto.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const val = prompt('Digite o valor do desconto em R$ (Ex: 15.50):');
      if (val) {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          window.descontoAdicional = num;
          if (window.calcularTotal) window.calcularTotal();
          if (window.calcRestante) window.calcRestante();
        }
      }
    });
  }

  if (btnServico) {
    btnServico.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const val = prompt('Digite o valor de serviço/couvert extra em R$ (Ex: 10.00):');
      if (val) {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          window.servicoAdicional = num;
          if (window.calcularTotal) window.calcularTotal();
          if (window.calcRestante) window.calcRestante();
        }
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // --- TOP MENUBAR DROPDOWNS ---
  document.querySelectorAll('.menu-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
      const dropdownId = trigger.getAttribute('data-dropdown');
      if (dropdownId) {
        document.getElementById(dropdownId).classList.toggle('show');
      }
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
  });

  const mnuAbrir = document.getElementById('menu-abrir-caixa');
  if(mnuAbrir) mnuAbrir.onclick = () => {
     const b = document.getElementById('btn-abrir-caixa');
     if(b) b.click();
     else {
        // if not in DOM, maybe we need to emit directly
        const val = prompt('Qual o valor inicial do caixa?');
        if (val !== null) socket.emit('abrir_caixa', { fundo_troco: parseFloat(val) || 0 });
     }
  };
  
  const mnuFechar = document.getElementById('menu-fechar-caixa');
  if(mnuFechar) mnuFechar.onclick = () => {
     const b = document.getElementById('btn-fechar-caixa');
     if(b) b.click();
     else socket.emit('fechar_caixa');
  };
  
  const mnuConfig = document.getElementById('menu-configuracoes');
  if(mnuConfig) mnuConfig.onclick = () => { window.location.href = '/configuracoes.html'; };
  const mnuCad = document.getElementById('menu-cadastro');
  if(mnuCad) mnuCad.onclick = () => { window.location.href = '/configuracoes.html'; };
  
  const mnuAjuda = document.getElementById('menu-ajuda');
  const ajudaOverlay = document.getElementById('ajuda-overlay');
  const btnFecharAjuda = document.getElementById('btn-fechar-ajuda');
  if(mnuAjuda && ajudaOverlay) {
    mnuAjuda.onclick = () => ajudaOverlay.style.display = 'flex';
  }
  if(btnFecharAjuda && ajudaOverlay) {
    btnFecharAjuda.onclick = () => ajudaOverlay.style.display = 'none';
  }

  // --- KEYBOARD SHORTCUTS ---
  document.addEventListener('keydown', (e) => {
    // ESC - Voltar / Fechar Telas
    if (e.key === 'Escape') {
      let closedSomething = false;
      const overlays = [
        document.getElementById('pdv-overlay'),
        document.getElementById('admin-overlay'),
        document.getElementById('ajuda-overlay'),
        document.getElementById('relatorios-overlay'),
        document.getElementById('financeiro-overlay')
      ];
      overlays.forEach(overlay => {
        if (overlay && overlay.style.display === 'flex') {
          overlay.style.display = 'none';
          closedSomething = true;
        }
      });
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if(menu.classList.contains('show')) {
          menu.classList.remove('show');
          closedSomething = true;
        }
      });
      // Se não fechou nenhum modal, pode ser que ele queira voltar a página
      if (!closedSomething && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
         // Opcional: voltar caso esteja em outra tela e use main.js
      }
    }
    // Ctrl + O - Fila de Pedidos
    else if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      window.location.href = 'fila.html';
    }
    // F2 - Venda Rapida (Balcao)
    else if (e.key === 'F2') {
      e.preventDefault();
      document.getElementById('toolbar-balcao')?.click();
    }
    // F3 - Delivery
    else if (e.key === 'F3') {
      e.preventDefault();
      document.getElementById('toolbar-delivery')?.click();
    }
    // F4 - Finalizar Venda
    else if (e.key === 'F4') {
      e.preventDefault();
      document.getElementById('btn-finalizar-venda')?.click();
    }
  });

  // --- RELATORIOS OVERLAY ---
  const relatoriosOverlay = document.getElementById('relatorios-overlay');
  const mnuRel = document.getElementById('menu-relatorios');
  if(mnuRel && relatoriosOverlay) {
    mnuRel.onclick = () => {
      relatoriosOverlay.style.display = 'flex';
      socket.emit('get_relatorios');
    };
  }
  const btnFecharRel = document.getElementById('btn-fechar-relatorios');
  if(btnFecharRel && relatoriosOverlay) {
    btnFecharRel.onclick = () => relatoriosOverlay.style.display = 'none';
  }

  // --- FINANCEIRO OVERLAY ---
  const financeiroOverlay = document.getElementById('financeiro-overlay');
  const mnuFin = document.getElementById('menu-financeiro');
  if(mnuFin && financeiroOverlay) {
    mnuFin.onclick = () => {
      financeiroOverlay.style.display = 'flex';
      socket.emit('get_financeiro');
    };
  }
  const btnFecharFin = document.getElementById('btn-fechar-financeiro');
  if(btnFecharFin && financeiroOverlay) {
    btnFecharFin.onclick = () => financeiroOverlay.style.display = 'none';
  }

  const btnAddDespesa = document.getElementById('btn-financeiro-add-despesa');
  if(btnAddDespesa) {
    btnAddDespesa.onclick = () => {
      const desc = document.getElementById('financeiro-despesa-desc').value;
      const val = parseFloat(document.getElementById('financeiro-despesa-valor').value);
      if(!desc || !val) return alert('Preencha descrição e valor!');
      socket.emit('add_despesa', { valor: val, descricao: desc });
      document.getElementById('financeiro-despesa-desc').value = '';
      document.getElementById('financeiro-despesa-valor').value = '';
    };
  }
});

socket.on('relatorios_atualizados', (data) => {
  const elTotal = document.getElementById('relatorios-total-geral');
  if(elTotal) elTotal.innerText = 'R$ ' + (data.total || 0).toFixed(2).replace('.', ',');
  const elProd = document.getElementById('relatorios-produtos-list');
  if(elProd) elProd.innerHTML = data.produtos.map(p => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${p.productName}</td>
      <td style="padding: 10px;">${p.qtd}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(p.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
  const elGarc = document.getElementById('relatorios-garcons-list');
  if(elGarc) elGarc.innerHTML = data.garcons.map(g => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${g.userName}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(g.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
  const elMesas = document.getElementById('relatorios-mesas-list');
  if(elMesas) elMesas.innerHTML = (data.mesas || []).map(m => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${m.localName || 'Avulso'}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(m.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
});

socket.on('financeiro_atualizado', (rows) => {
  const elList = document.getElementById('financeiro-extrato-list');
  if(elList) {
      elList.innerHTML = rows.map(r => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">${new Date(r.data).toLocaleString('pt-BR')}</td>
          <td style="padding: 10px;">${r.tipo === 'Entrada' ? '<span style="color:#3ab55b; font-weight:bold;">Entrada</span>' : '<span style="color:#eb5757; font-weight:bold;">Saída</span>'}</td>
          <td style="padding: 10px;">${r.descricao}</td>
          <td style="padding: 10px;">${r.forma_pagamento}</td>
          <td style="padding: 10px; text-align: right; font-weight:bold; color: ${r.tipo === 'Entrada' ? '#3ab55b' : '#eb5757'}">R$ ${(r.valor||0).toFixed(2).replace('.', ',')}</td>
        </tr>`).join('');
  }
});


// --- UPDATE STATUS BAR AND PERMANENCIA PERIODICALLY ---
setInterval(() => {
    // Permanencia
    if (window.updatePermanencia && window.mesaAtual && window.mesaAtual.isGroup) {
        window.updatePermanencia();
    }
    
    // Footer Stats
    const elMesas = document.getElementById('status-mesas-count');
    const elComandas = document.getElementById('status-comandas-count');
    const elUser = document.getElementById('status-user-name');
    const elCaixa = document.getElementById('status-caixa-name');
    
    if (elMesas && window.allMesas) {
        const ocupadas = window.allMesas.filter(m => m.status !== 'Disponível').length;
        elMesas.innerText = ocupadas + ' / ' + window.allMesas.length;
    }
    
    if (elComandas && typeof ordersData !== 'undefined') {
        const uniqueComandas = new Set(ordersData.map(o => o.mesa_grupo || o.localName || o.id));
        elComandas.innerText = uniqueComandas.size;
    }
    
    if (elUser) {
        const creds = localStorage.getItem('chef_credentials');
        if (creds) {
            try {
                const parsed = JSON.parse(creds);
                window.loggedInUser = parsed.nome || parsed.usuario;
            } catch(e) {}
        } else {
            window.loggedInUser = null;
        }
        elUser.innerText = window.loggedInUser || 'Não logado';
    }
    
    // Caixa could be updated if we receive it. 
    // Just keep it static "Caixa 1" for now or show "Aberto"/"Fechado"
}, 15000); // 15 seconds

// --- Backup & Restore (Admin Modal) ---
window.downloadBackup = () => {
  if (!confirm('Deseja baixar o arquivo de backup agora?')) return;
  // O endpoint /api/backup retorna o arquivo diretamente
  window.location.href = '/api/backup';
};

window.uploadRestore = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm(`ATENÇÃO: Você está prestes a restaurar o banco de dados usando o arquivo "${file.name}".\nIsso apagará irreversivelmente todas as vendas, alterações de produtos e mesas que ocorreram DEPOIS que este backup foi gerado.\n\nTem certeza absoluta que deseja prosseguir?`)) {
    event.target.value = ''; // reseta
    return;
  }

  const formData = new FormData();
  formData.append('dbfile', file);

  try {
    const res = await fetch('/api/restore', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      alert('Backup restaurado com sucesso! O sistema será recarregado.');
      window.location.reload();
    } else {
      const errText = await res.text();
      alert('Falha ao restaurar: ' + errText);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao tentar restaurar o backup.');
  } finally {
    event.target.value = ''; // reseta
  }
};


// --- Reserva de Mesa ---
const btnReservarMesa = document.getElementById('btn-reservar-mesa');
const modalReserva = document.getElementById('modal-reserva');
const btnSalvarReserva = document.getElementById('btn-salvar-reserva');
const btnCancelarReserva = document.getElementById('btn-cancelar-reserva');
const btnRemoverReserva = document.getElementById('btn-remover-reserva');

if (btnReservarMesa) {
  btnReservarMesa.onclick = () => {
    if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
    if (window.mesaAtual.isGroup) return alert('Não � possível reservar uma mesa que j� possui pedidos ativos.');
    
    // Check if already reserved
    if (window.mesaAtual.status === 'Reservada') {
      try {
        const obsObj = JSON.parse(window.mesaAtual.observacao || '{}');
        document.getElementById('reserva-cliente').value = obsObj.cliente || '';
        document.getElementById('reserva-data').value = obsObj.data || '';
        document.getElementById('reserva-obs').value = obsObj.obs || '';
      } catch (e) {
        document.getElementById('reserva-obs').value = window.mesaAtual.observacao || '';
      }
      btnRemoverReserva.style.display = 'block';
      document.getElementById('modal-reserva-titulo').innerText = 'Editar Reserva: ' + (window.mesaAtual.nome || window.mesaAtual.mesaName);
    } else {
      document.getElementById('reserva-cliente').value = '';
      document.getElementById('reserva-data').value = '';
      document.getElementById('reserva-obs').value = '';
      btnRemoverReserva.style.display = 'none';
      document.getElementById('modal-reserva-titulo').innerText = 'Nova Reserva: ' + (window.mesaAtual.nome || window.mesaAtual.mesaName);
    }
    
    modalReserva.style.display = 'flex';
  };
}

if (btnCancelarReserva) {
  btnCancelarReserva.onclick = () => {
    modalReserva.style.display = 'none';
  };
}

if (btnSalvarReserva) {
  btnSalvarReserva.onclick = () => {
    const cliente = document.getElementById('reserva-cliente').value;
    const data = document.getElementById('reserva-data').value;
    const obs = document.getElementById('reserva-obs').value;
    
    if (!cliente) return alert('Preencha o nome do cliente.');
    
    const obsObj = {
      cliente,
      data,
      obs
    };
    
    socket.emit('reservar_mesa', {
      mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName,
      observacao: JSON.stringify(obsObj)
    });
    
    modalReserva.style.display = 'none';
  };
}

if (btnRemoverReserva) {
  btnRemoverReserva.onclick = () => {
    if (!confirm('Tem certeza que deseja cancelar esta reserva e liberar a mesa?')) return;
    socket.emit('cancelar_reserva', {
      mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName
    });
    modalReserva.style.display = 'none';
  };
}



// --- QR Code de Ponto ---
socket.on('update_ponto_token', (data) => {
  const img = document.getElementById('qr-ponto-img');
  if (img) {
    // Generate QR code using external API
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(data.url);
  }
});


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
         if(c.querySelector('.mesa-id').innerText === nomeMesa) {
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
             if(c.querySelector('.mesa-id').innerText === nomeMesa) c.click();
           });
           const btnAdic = document.getElementById('btn-adicionar-produtos');
           if(btnAdic) btnAdic.click();
         }, 500);
       }
    }, 200);
  });


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

// Initial Footer Sync
setTimeout(() => {
  const elUser = document.getElementById('status-user-name');
  if (elUser) {
        const creds = localStorage.getItem('chef_credentials');
        if (creds) {
            try {
                const parsed = JSON.parse(creds);
                window.loggedInUser = parsed.nome || parsed.usuario;
            } catch(e) {}
        } else {
            window.loggedInUser = null;
        }
        elUser.innerText = window.loggedInUser || 'Não logado';
    }
}, 500);


window.abrirCheckoutComandaModal = (comandaName) => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
  
  window.modalComandaName = comandaName;
  const items = window.mesaAtual.items || [];
  window.modalComandaItems = items.filter(o => o.status !== 'Pago' && o.mesa_comanda === comandaName);
  window.modalSharedItems = items.filter(o => o.status !== 'Pago' && (!o.mesa_comanda || o.mesa_comanda.trim() === ''));
  
  // Set modal title
  const titleEl = document.getElementById('comanda-modal-title');
  if (titleEl) {
    titleEl.innerText = comandaName ? `Cobrar Comanda: ${comandaName}` : 'Cobrar Itens Compartilhados';
  }
  
  // Hide individual items section if checking out only shared items
  const itemsSection = document.getElementById('comanda-modal-items-section');
  if (itemsSection) {
    itemsSection.style.display = comandaName ? 'block' : 'none';
  }
  
  // Hide split-shared option if it's the shared items themselves
  const splitLabel = document.getElementById('comanda-modal-split-label');
  if (splitLabel) {
    splitLabel.style.display = comandaName ? 'flex' : 'none';
  }
  
  // Render individual comanda items
  const comandaItemsList = document.getElementById('comanda-modal-items');
  if (comandaItemsList) {
    if (window.modalComandaItems.length === 0) {
      comandaItemsList.innerHTML = '<div style="color:gray; text-align:center; padding: 10px;">Nenhum item individual pendente.</div>';
    } else {
      comandaItemsList.innerHTML = window.modalComandaItems.map(o => {
        const val = parseFloat(String(o.total).replace(',', '.'));
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f2f2f2; padding-bottom:4px;">
            <span>${o.quantity}x ${o.productEmoji || ''} ${o.productName}</span>
            <span style="font-weight:600; color:#555;">R$ ${val.toFixed(2).replace('.', ',')}</span>
          </div>
        `;
      }).join('');
    }
  }
  
  // Render shared items checkboxes
  const sharedList = document.getElementById('comanda-modal-shared-list');
  if (sharedList) {
    if (window.modalSharedItems.length === 0) {
      sharedList.innerHTML = '<div style="color:gray; text-align:center; padding: 10px;">Nenhum item compartilhado pendente.</div>';
    } else {
      sharedList.innerHTML = window.modalSharedItems.map(o => {
        const val = parseFloat(String(o.total).replace(',', '.'));
        return `
          <label style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:4px 0; cursor:pointer;">
            <span style="display:flex; align-items:center; gap:6px;">
              <input type="checkbox" class="comanda-modal-shared-chk" data-id="${o.id}" data-val="${val}" onchange="window.recalcComandaModal()">
              ${o.quantity}x ${o.productEmoji || ''} 	ext{o.productName}
            </span>
            <span style="font-weight:600; color:#fc4b15;">R$ ${val.toFixed(2).replace('.', ',')}</span>
          </label>
        `;
      }).join('');
    }
  }
  
  // Recalculate split share value
  const splitValueEl = document.getElementById('comanda-modal-split-value');
  const splitChk = document.getElementById('comanda-modal-split-shared');
  if (splitChk) splitChk.checked = false;
  
  if (splitValueEl) {
    if (comandaName) {
      // Find all unique comanda names in unpaid items
      const comandas = new Set(items.filter(o => o.status !== 'Pago' && o.mesa_comanda && o.mesa_comanda.trim() !== '').map(o => o.mesa_comanda.trim()));
      const numComandas = Math.max(1, comandas.size);
      const sharedTotal = window.modalSharedItems.reduce((acc, o) => acc + parseFloat(String(o.total).replace(',', '.')), 0);
      window.modalSplitShare = sharedTotal / numComandas;
      splitValueEl.innerText = `R$ ${window.modalSplitShare.toFixed(2).replace('.', ',')}`;
    } else {
      window.modalSplitShare = 0;
      splitValueEl.innerText = 'R$ 0,00';
    }
  }
  
  // Show modal
  const overlay = document.getElementById('comanda-checkout-overlay');
  if (overlay) overlay.style.display = 'flex';
  
  window.recalcComandaModal();
};

window.recalcComandaModal = () => {
  let subtotal = 0;
  
  // 1. Add individual items total if comandaName is set
  if (window.modalComandaName) {
    subtotal += window.modalComandaItems.reduce((acc, o) => acc + parseFloat(String(o.total).replace(',', '.')), 0);
  }
  
  // 2. Add split share if checked
  const splitChk = document.getElementById('comanda-modal-split-shared');
  if (splitChk && splitChk.checked) {
    subtotal += window.modalSplitShare || 0;
  }
  
  // 3. Add checked shared items
  document.querySelectorAll('.comanda-modal-shared-chk').forEach(chk => {
    if (chk.checked) {
      subtotal += parseFloat(chk.getAttribute('data-val')) || 0;
    }
  });
  
  // 4. Apply service fee if enabled on main screen
  const serviceCheckbox = document.getElementById('taxa-servico');
  const serviceApplied = serviceCheckbox && serviceCheckbox.checked;
  if (serviceApplied) {
    subtotal *= 1.1;
  }
  
  window.modalCheckoutTotal = subtotal;
  const totalEl = document.getElementById('comanda-modal-total');
  if (totalEl) {
    totalEl.innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
  }
};

window.finalizarComandaModal = () => {
  if (!window.mesaAtual || window.modalCheckoutTotal <= 0) {
    return alert('Não há valor a ser cobrado!');
  }
  
  const method = document.getElementById('comanda-modal-method').value;
  const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
  
  // Gather ids of items to be marked as Paid
  const pedidoIds = [];
  
  // Individual items
  if (window.modalComandaName) {
    window.modalComandaItems.forEach(o => pedidoIds.push(o.id));
  }
  
  // Checked shared items
  let checkedSharedVal = 0;
  document.querySelectorAll('.comanda-modal-shared-chk').forEach(chk => {
    if (chk.checked) {
      const id = parseInt(chk.getAttribute('data-id'), 10);
      pedidoIds.push(id);
      checkedSharedVal += parseFloat(chk.getAttribute('data-val'));
    }
  });
  
  const serviceCheckbox = document.getElementById('taxa-servico');
  const serviceApplied = serviceCheckbox && serviceCheckbox.checked;
  
  // Value corresponding to individual items + checked shared items
  const mainValue = (window.modalComandaName ? window.modalComandaItems.reduce((acc, o) => acc + parseFloat(String(o.total).replace(',', '.')), 0) : 0) + checkedSharedVal;
  const mainValueWithTax = serviceApplied ? mainValue * 1.1 : mainValue;
  
  // If we are paying some items by full, finalize them
  if (pedidoIds.length > 0) {
    socket.emit('finalizar_parcial_mesa', {
      mesaName: mesaName,
      pedidoIds: pedidoIds,
      payments: [{ metodo: method, valor: mainValueWithTax }]
    });
  }
  
  // If we split the shared items, register a partial payment for the split share portion
  const splitChk = document.getElementById('comanda-modal-split-shared');
  if (splitChk && splitChk.checked && window.modalSplitShare > 0) {
    const splitShareWithTax = serviceApplied ? window.modalSplitShare * 1.1 : window.modalSplitShare;
    
    // Register partial payment in background
    socket.emit('movimentacao_caixa', {
      tipo: 'Entrada',
      valor: splitShareWithTax,
      descricao: `Pgto Parcial (Racha Compartilhados - ${window.modalComandaName || 'Comanda'}): ${mesaName}`,
      forma_pagamento: method
    });
    
    socket.emit('pagamento_parcial_valor', {
      mesaName: mesaName,
      valor: splitShareWithTax,
      metodo: method,
      userName: 'Caixa'
    });
  }
  
  // Close modal
  document.getElementById('comanda-checkout-overlay').style.display = 'none';
  alert('Pagamento registrado com sucesso!');
};
, '').replace(/\s/g, '').replace('.', '').replace(',', '.');
      const valor = parseFloat(valorTexto);
      
      if (isNaN(valor) || valor <= 0) {
        return alert('Digite um valor de pagamento válido maior que zero.');
      }
      
      const metodo = selectMetodo.value;
      const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
      
      // Register partial payment in background
      socket.emit('movimentacao_caixa', {
        tipo: 'Entrada',
        valor: valor,
        descricao: `Pgto Parcial: ${mesaName}`,
        forma_pagamento: metodo
      });
      
      socket.emit('pagamento_parcial_valor', {
        mesaName: mesaName,
        valor: valor,
        metodo: metodo,
        userName: window.loggedInUser || 'Caixa'
      });
      
      inputValor.value = '';
    };
  }



  const btnConcluir = document.getElementById('btn-movimento-concluir');

  if (btnConcluir) {

    btnConcluir.addEventListener('click', () => {

      const btnFinalizar = document.getElementById('btn-finalizar-venda');

      if (btnFinalizar) {

        if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');

        btnFinalizar.click();

      }

    });

  }



  const btnToolbarMesas = document.getElementById('toolbar-mesas');

  const btnToolbarComandas = document.getElementById('toolbar-comandas');

  window.viewFilter = 'Mesas';

  

  if (btnToolbarMesas) {

    btnToolbarMesas.onclick = () => {

      window.viewFilter = 'Mesas';

      document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));

      btnToolbarMesas.classList.add('active');

      if (typeof renderOrders === 'function') renderOrders();

    };

  }

  if (btnToolbarComandas) {

    btnToolbarComandas.onclick = () => {

      window.viewFilter = 'Comandas';

      document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));

      btnToolbarComandas.classList.add('active');

      if (typeof renderOrders === 'function') renderOrders();

    };

  }



  const btnBalcao = document.getElementById('toolbar-balcao');

  if (btnBalcao) {

    btnBalcao.onclick = () => {

      const btnAdicionar = document.getElementById('btn-adicionar-produtos');

      if (btnAdicionar) btnAdicionar.click();

      const pdvTipo = document.getElementById('pdv-tipo-pedido');

      if (pdvTipo) {

        pdvTipo.value = 'Balcão';

        pdvTipo.dispatchEvent(new Event('change'));

      }

    };

  }



  const btnDelivery = document.getElementById('toolbar-delivery');

  if (btnDelivery) {

    btnDelivery.onclick = () => {

      const btnAdicionar = document.getElementById('btn-adicionar-produtos');

      if (btnAdicionar) btnAdicionar.click();

      const pdvTipo = document.getElementById('pdv-tipo-pedido');

      if (pdvTipo) {

        pdvTipo.value = 'Delivery';

        pdvTipo.dispatchEvent(new Event('change'));

      }

    };

  }

  

  const pdvCliSearchBtn = document.getElementById('pdv-cliente-search-btn');

  const btnAlterarMesa = document.getElementById('btn-alterar-mesa');

  if (btnAlterarMesa) {

    btnAlterarMesa.onclick = () => {

      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');

      const novaMesa = prompt('Digite o novo número ou nome da mesa:', window.mesaAtual.nome || window.mesaAtual.mesaName);

      if (novaMesa && novaMesa.trim() !== '') {

        socket.emit('transferir_mesa', {

          mesaAtual: window.mesaAtual.nome || window.mesaAtual.mesaName,

          novaMesa: novaMesa.trim()

        });

      }

    };

  }



  const btnJuntarMesa = document.getElementById('btn-juntar-mesa');

  if (btnJuntarMesa) {

    btnJuntarMesa.onclick = () => {

      if (!window.mesaAtual || window.mesaAtual.isGroup === false) return alert('Selecione uma mesa ocupada primeiro.');

      const targetMesa = prompt(`Juntar [${window.mesaAtual.nome || window.mesaAtual.mesaName}] com qual mesa?`);

      if (targetMesa && targetMesa.trim() !== '') {

        socket.emit('juntar_mesas', {

          mesaA: window.mesaAtual.nome || window.mesaAtual.mesaName,

          mesaB: targetMesa.trim()

        });

      }

    };

  }



  // --- BOTÃO AGRUPAR ITENS ---

  const btnAgrupar = document.getElementById('btn-agrupar-itens');

  if (btnAgrupar) {

    btnAgrupar.onclick = () => {

      window.agruparItens = !window.agruparItens;

      if (window.agruparItens) {

        btnAgrupar.style.backgroundColor = '#3ab55b';

        btnAgrupar.style.color = 'white';

        btnAgrupar.innerHTML = '<i class="ph ph-list-dashes"></i> Desagrupar';

      } else {

        btnAgrupar.style.backgroundColor = '';

        btnAgrupar.style.color = '';

        btnAgrupar.innerHTML = '<i class="ph ph-list-dashes"></i> Agrupar';

      }

      

      // Re-render current mesa if selected

      if (window.mesaAtual) {

        const card = Array.from(document.querySelectorAll('.mesa-item')).find(c => c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.mesaName || c.querySelector('.mesa-id') && c.querySelector('.mesa-id').innerText === window.mesaAtual.nome);

      if (card) card.click();

      } else {

        alert(window.agruparItens ? 'A visualização dos itens agora será agrupada por produto.' : 'A visualização dos itens agora será separada (um por linha).');

      }

    };

  }



  // --- BOTÃO VER COMISSÃO ---

  const btnComissao = document.getElementById('btn-ver-comissao');

  if (btnComissao) {

    btnComissao.onclick = () => {

      if (window.mesaAtual && window.mesaAtual.isGroup !== false) {

        const comissao = window.mesaAtual.total * 0.1;

        alert(`Comissão desta mesa (10%): R$ ${comissao.toFixed(2).replace('.', ',')}\n\nO valor já está contabilizado no painel de Resumo na barra lateral direita!`);

      } else {

        // Se nenhuma mesa selecionada, abre o relatório de comissões (Garçons)

        document.getElementById('menu-relatorios')?.click();

        alert('Aqui você pode visualizar o faturamento total por garçom (base para a comissão do turno).');

      }

    };

  }



  allRenderedItems.forEach(item => {

    const card = document.getElementById(`mesa-card-${item.uid}`);

    if (!card) return;

    

    card.addEventListener('dblclick', () => {

       card.click();

       const btnAdicionar = document.getElementById('btn-adicionar-produtos');

       if (btnAdicionar) btnAdicionar.click();

    });



    card.addEventListener('click', () => {

       document.querySelectorAll('.mesa-item').forEach(c => c.classList.remove('selected'));

       card.classList.add('selected');

       

       const nomeMesa = item.isGroup ? item.mesaName : item.nome;

       

       const updateSummaryValue = (id, val) => {

         const el = document.getElementById(id);

         if (el) el.innerText = `R$ ${val.toFixed(2).replace('.', ',')}`;

       };


       
       const infoMesa = document.getElementById('info-mesa-nome');
       const infoCliente = document.getElementById('info-cliente-nome');
       const infoPermanencia = document.getElementById('info-permanencia');
       if(infoMesa) infoMesa.innerText = nomeMesa;
       if(infoCliente) infoCliente.innerText = item.isGroup ? item.userName : '-';
       
       if (infoPermanencia) {
           if (!item.isGroup || !item.items || item.items.length === 0) {
               infoPermanencia.innerText = '0min';
           } else {
               // item.items[0].time might be "HH:MM"
               window.updatePermanencia = () => {
                   const firstTimeStr = item.items[0].time; // "14:35"
                   if (firstTimeStr && firstTimeStr.includes(':')) {
                       const [h, m] = firstTimeStr.split(':').map(Number);
                       const now = new Date();
                       let orderDate = new Date();
                       orderDate.setHours(h, m, 0, 0);
                       if (orderDate > now) {
                           // crossed midnight?
                           orderDate.setDate(orderDate.getDate() - 1);
                       }
                       const diffMs = now - orderDate;
                       const diffMin = Math.floor(diffMs / 60000);
                       infoPermanencia.innerText = diffMin + 'min';
                   } else {
                       infoPermanencia.innerText = '0min';
                   }
               };
               window.updatePermanencia();
           }
       }
       
       const tbody = document.getElementById('panel-items-tbody');
       
       const leftActionsContainer = document.getElementById('left-actions-container');
       const mesaBanner = document.getElementById('mesa-selecionada-banner');
       const mesaBannerNome = document.getElementById('mesa-selecionada-nome');
       const actMovimentos = document.getElementById('action-group-movimentos');
       const actRelatorios = document.getElementById('action-group-relatorios');

       window.mesaAtual = item;
       if (leftActionsContainer) {
          leftActionsContainer.style.opacity = '1';
          leftActionsContainer.style.pointerEvents = 'auto';
       }
       if (mesaBanner && mesaBannerNome) {
          mesaBanner.style.display = 'flex';
          mesaBannerNome.innerText = item.nome || item.mesaName;
       }

       if (!item.isGroup) {
         if(tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: gray; padding: 20px;">Mesa ${item.status === 'Reservada' ? 'Reservada' : 'Livre'}</td></tr>`;
         updateSummaryValue('resumo-produtos', 0);
         updateSummaryValue('resumo-comissao', 0);
         updateSummaryValue('resumo-subtotal', 0);
         updateSummaryValue('resumo-taxas', 0);
         document.getElementById('total-pagar-text').innerText = 'R$ 0,00';
         document.getElementById('total-pago-text').innerText = 'R$ 0,00';
         document.getElementById('falta-pagar-text').innerText = 'R$ 0,00';
         
         const btnFinalizar = document.getElementById('btn-finalizar-venda');
         if(btnFinalizar) {
           btnFinalizar.style.opacity = '0.5';
           btnFinalizar.style.pointerEvents = 'none';
         }
         
         if (actMovimentos) {
            actMovimentos.style.opacity = '0.5';
            actMovimentos.style.pointerEvents = 'none';
         }
         if (actRelatorios) {
            actRelatorios.style.opacity = '0.5';
            actRelatorios.style.pointerEvents = 'none';
         }
         return;
       }

       if (actMovimentos) {
          actMovimentos.style.opacity = '1';
          actMovimentos.style.pointerEvents = 'auto';
       }
       if (actRelatorios) {
          actRelatorios.style.opacity = '1';
          actRelatorios.style.pointerEvents = 'auto';
       }

       window.gorjetaAdicional = 0;
       window.descontoAdicional = 0;
       window.servicoAdicional = 0;
       
       let itemsToRender = item.items;
       if (window.agruparItens) {
         const grouped = {};
         item.items.forEach(order => {
           const key = order.productName;
           if (!grouped[key]) grouped[key] = { ...order, quantity: 0, totalVal: 0 };
           const totalVal = parseFloat(String(order.total).replace(',', '.'));
           grouped[key].quantity += (order.quantity || 1);
           grouped[key].totalVal += totalVal;
         });
         itemsToRender = Object.values(grouped).map(g => ({ ...g, total: g.totalVal }));
       }
       
       let itemsHTML = '';
       itemsToRender.forEach((order, idx) => {
         const totalVal = parseFloat(String(order.total).replace(',', '.'));
         const isPaid = order.status === 'Pago';
         itemsHTML += `
           <tr style="${isPaid ? 'opacity: 0.5; background: #f9f9f9;' : ''}" draggable="true" ondragstart="window.onDragStartItem(event, ${order.id})">
             <td>${String(idx+1).padStart(3, '0')}</td>
             <td style="${isPaid ? 'text-decoration: line-through;' : ''}">${order.productEmoji || ''} ${order.productName || 'Produto'}${order.mesa_comanda ? ` <span style="color:#fc4b15; font-size:12px; margin-left:8px; font-weight:600;">(${order.mesa_comanda})</span>` : ''} ${isPaid ? '<strong style="color: #3ab55b; margin-left: 8px;">(PAGO)</strong>' : ''}</td>
             <td>R$ ${(totalVal / (order.quantity || 1)).toFixed(2).replace('.', ',')}</td>
             <td>${order.quantity || 1}</td>
             <td style="font-weight: 600; color: #3ab55b;">R$ ${totalVal.toFixed(2).replace('.', ',')}</td>
             <td>${order.userName || 'Caixa'}</td>
             <td>
                ${isPaid ? '' : `<i class="ph ph-trash" style="color: #eb5757; cursor: pointer;" onclick="window.removerItemPedido('${order.id}')"></i>`}
             </td>
           </tr>
         `;
       });
       if(tbody) tbody.innerHTML = itemsHTML;

        // --- CÁLCULO E DIVISÃO POR COMANDA ---
        const divRacha = document.getElementById('div-racha-comandas');
        const listRacha = document.getElementById('racha-comandas-list');
        const chkRachaShared = document.getElementById('chk-racha-compartilhados');
        
        if (divRacha && listRacha) {
           const unpaidItems = item.items.filter(o => o.status !== 'Pago');
           
           const comandaSums = {};
           let sharedTotal = 0;
           let hasComandas = false;
           
           unpaidItems.forEach(order => {
              const val = parseFloat(String(order.total).replace(',', '.'));
              const comanda = order.mesa_comanda ? order.mesa_comanda.trim() : '';
              if (comanda) {
                 comandaSums[comanda] = (comandaSums[comanda] || 0) + val;
                 hasComandas = true;
              } else {
                 sharedTotal += val;
              }
           });
           
           if (hasComandas) {
              divRacha.style.display = 'block';
              
              const activeComandaNames = Object.keys(comandaSums);
              const numComandas = activeComandaNames.length;
              
              const isSharedSplit = chkRachaShared && chkRachaShared.checked;
              const sharePerComanda = isSharedSplit ? (sharedTotal / numComandas) : 0;
              
              let rachaHTML = '';
              activeComandaNames.forEach(cName => {
                 let total = comandaSums[cName] + sharePerComanda;
                 
                 const serviceCheckbox = document.getElementById('taxa-servico');
                 if (serviceCheckbox && serviceCheckbox.checked) {
                    total *= 1.1;
                 }
                 
                 rachaHTML += `
                    <div class="comanda-racha-row" onclick="window.abrirCheckoutComandaModal('${cName}')" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#fff; border:1px solid #ffe2d1; border-radius:6px; cursor:pointer; transition:0.2s; margin-bottom: 4px;">
                       <span style="font-weight:600; color:#fc4b15;"><i class="ph ph-user"></i> ${cName}</span>
                       <span style="font-weight:700; color:#3ab55b;">R$ ${total.toFixed(2).replace('.', ',')}</span>
                    </div>
                 `;
              });
              
              if (!isSharedSplit && sharedTotal > 0) {
                 let sharedVal = sharedTotal;
                 const serviceCheckbox = document.getElementById('taxa-servico');
                 if (serviceCheckbox && serviceCheckbox.checked) {
                    sharedVal *= 1.1;
                 }
                 rachaHTML += `
                    <div class="comanda-racha-row" onclick="window.abrirCheckoutComandaModal('')" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#f9f9f9; border:1px dashed #ccc; border-radius:6px; cursor:pointer; color:#777;">
                       <span><i class="ph ph-squares-four"></i> Itens Compartilhados</span>
                       <span style="font-weight:700;">R$ ${sharedVal.toFixed(2).replace('.', ',')}</span>
                    </div>
                 `;
              }
              
              listRacha.innerHTML = rachaHTML;
           } else {
              divRacha.style.display = 'none';
           }
        }

       updateSummaryValue('resumo-produtos', item.totalBruto || item.total);
       updateSummaryValue('resumo-comissao', item.total * 0.1);
       updateSummaryValue('resumo-subtotal', item.totalBruto || item.total);

       const taxaCheckbox = document.getElementById('taxa-servico');
       window.calcularTotal = () => {
         let totalComTaxa = (item.totalBruto || item.total) + window.servicoAdicional - window.descontoAdicional;
         let valorServicos = window.servicoAdicional;
         
         if (taxaCheckbox && taxaCheckbox.checked) {
           const baseParaTaxa = Math.max(0, (item.totalBruto || item.total) - window.descontoAdicional);
           valorServicos += baseParaTaxa * 0.10;
           totalComTaxa += baseParaTaxa * 0.10;
         }
         
         updateSummaryValue('resumo-taxas', valorServicos);
         
         const descEl = document.getElementById('resumo-descontos');
         if(descEl) descEl.innerText = `R$ ${window.descontoAdicional.toFixed(2).replace('.', ',')}`;

         document.getElementById('total-pagar-text').innerText = `R$ ${totalComTaxa.toFixed(2).replace('.', ',')}`;
         return totalComTaxa;
       };

       window.calcularTotal();
       if(taxaCheckbox) taxaCheckbox.onchange = () => { window.calcRestante(); };

       window.pagamentosParciais = item.pagamentosParciais || [];
       
       window.calcRestante = () => {
           const finalTotal = window.calcularTotal();
           const pago = window.pagamentosParciais.reduce((acc, curr) => acc + curr.valor, 0);
           const taxaMult = (taxaCheckbox && taxaCheckbox.checked) ? 1.1 : 1.0;
           const paidItemsTotal = ((window.mesaAtual.totalBruto || window.mesaAtual.total) - window.mesaAtual.total) * taxaMult;
           const falta = finalTotal - pago - paidItemsTotal;
           
           // Atualizar textos antigos (se existirem)
           const elTot = document.getElementById('total-pagar-text');
           if(elTot) elTot.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
           const elPago = document.getElementById('total-pago-text');
           if(elPago) elPago.innerText = `R$ ${pago.toFixed(2).replace('.', ',')}`;
           const elFalta = document.getElementById('falta-pagar-text');
           if(elFalta) elFalta.innerText = `R$ ${falta > 0 ? falta.toFixed(2).replace('.', ',') : '0,00'}`;
           
           // Atualizar textos do Modal Novo
           const modTotal = document.getElementById('modal-total');
           if(modTotal) modTotal.innerText = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;
           const modPago = document.getElementById('modal-pago');
           if(modPago) modPago.innerText = `R$ ${pago.toFixed(2).replace('.', ',')}`;
           const modRest = document.getElementById('modal-restante');
           const modRestLabel = document.getElementById('modal-restante-label');
           if(modRestLabel && modRest) {
             if (falta < -0.01) {
                modRestLabel.innerText = 'Troco:';
                modRest.innerText = `R$ ${Math.abs(falta).toFixed(2).replace('.', ',')}`;
             } else {
                modRestLabel.innerText = 'Faltando:';
                modRest.innerText = `R$ ${falta > 0 ? falta.toFixed(2).replace('.', ',') : '0,00'}`;
             }
           }
           
           // Atualizar lista de pagamentos no Modal (e no antigo se precisar)
           const htmlLista = window.pagamentosParciais.map((p, idx) => `
               <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
                 <span style="font-size: 16px;">${p.metodo}</span>
                 <span style="font-size: 18px; font-weight: bold;">R$ ${p.valor.toFixed(2).replace('.', ',')} 
                   <i class="ph ph-trash" style="color:#e74c3c; cursor:pointer; margin-left: 12px;" onclick="window.removerPagamento(${idx})"></i>
                 </span>
               </div>
           `).join('');
           
           const listaElModal = document.getElementById('modal-lista-pagamentos');
           if (listaElModal) listaElModal.innerHTML = htmlLista;
           const listaElAntiga = document.getElementById('lista-pagamentos-parciais');
           if (listaElAntiga) listaElAntiga.innerHTML = htmlLista;
           
           const btnFinalizar = document.getElementById('btn-finalizar-venda');
           if (btnFinalizar) {
             if (falta <= 0.01 && (window.pagamentosParciais.length > 0 || finalTotal === 0)) {
               btnFinalizar.style.opacity = '1';
               btnFinalizar.style.pointerEvents = 'auto';
               btnFinalizar.onclick = () => {
                 btnFinalizar.innerHTML = '<i class="ph ph-spinner-gap"></i> Processando...';
                 socket.emit('finalizar_mesa', { 
                   mesaName: nomeMesa, 
                   payments: window.pagamentosParciais,
                   totalValue: finalTotal
                 });
               }
             } else {
               btnFinalizar.style.opacity = '0.5';
               btnFinalizar.style.pointerEvents = 'none';
               btnFinalizar.onclick = null;
               btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 28px;"></i> FINALIZAR VENDA';
             }
           }
           return finalTotal;
         };
       window.calcRestante();
    });
  });

  if (typeof window.updateTimers === 'function') window.updateTimers();
}

window.removerItemPedido = (id) => {
  const senha = prompt('Digite a senha do administrador para excluir este item:');
  if (senha === 'adm') {
    socket.emit('remover_pedido_item', id);
  } else if (senha !== null) {
    alert('Senha incorreta!');
  }
};

setInterval(() => {
  const now = new Date();
  const clk = document.getElementById('status-clock');
  const dt = document.getElementById('status-date');
  if(clk) clk.innerText = now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
  if(dt) dt.innerText = now.toLocaleDateString('pt-BR');
}, 1000);

window.updateTimers = () => {
  document.querySelectorAll('.time-badge[data-created]').forEach(el => {
    const createdStr = el.getAttribute('data-created');
    if (!createdStr || createdStr === 'undefined') return;
    const createdAt = new Date(createdStr);
    const diffMins = Math.floor((new Date() - createdAt) / 60000);
    el.innerHTML = `<i class="ph ph-clock"></i> ${diffMins} min`;
    if (diffMins >= 60) {
      el.style.color = '#eb5757';
      el.style.backgroundColor = '#fce8e8';
    }
  });
};
setInterval(window.updateTimers, 30000);

  function updateSummaryValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.innerText = `R$ ${value.toFixed(2).replace('.', ',')}`;
    }
  }
  
  // WebSocket Events
  socket.on('initial_data', (data) => {
    socket.emit('get_mesas'); // Ensure we fetch mesas
    ordersData = data;
    renderOrders();
  });

  socket.on('pedidos_atualizados', (pedidos) => {
    ordersData = pedidos;
    renderOrders();
  });
  
  socket.on('pedido_adicionado', (novoPedido) => {
    ordersData.push(novoPedido);
    renderOrders();
  });
  
  socket.on('status_atualizado', (pedidoAtualizado) => {
    const index = ordersData.findIndex(o => o.id === pedidoAtualizado.id);
    if (index !== -1) {
      ordersData[index] = pedidoAtualizado;
      renderOrders();
    }
});

socket.on('mesa_finalizada', ({ mesaName }) => {
    // Remove items that were closed
    ordersData = ordersData.filter(o => o.localName !== mesaName);
    renderOrders();
    
    // Sucesso Interativo e Dinâmico
    const btnFinalizarModal = document.getElementById('btn-finalizar-venda');
    if (btnFinalizarModal && btnFinalizarModal.innerHTML.includes('Processando')) {
      // Efeito de Confete
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#3ab55b', '#ffffff', '#2D9CDB']
        });
      }

      // Tocar som de sucesso (Cha-Ching)
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if(AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
          osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch (e) {}
      
      // Atualiza visual do botão para sucesso
      btnFinalizarModal.style.background = '#27ae60';
      btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 32px;"></i> VENDA CONCLUÍDA!';
      
      // Fecha o modal automaticamente após 2.5 segundos
      setTimeout(() => {
        const modalPagamento = document.getElementById('pagamento-overlay');
        if (modalPagamento) modalPagamento.style.display = 'none';
        
        // Reseta o botão para a próxima venda
        btnFinalizarModal.innerHTML = '<i class="ph ph-check-circle" style="font-size: 28px;"></i> FINALIZAR VENDA';
        btnFinalizarModal.style.background = '#3ab55b';
      }, 2500);
    }
    
    const rightPanel = document.querySelector('.right-panel');
    if(rightPanel) {
      const itemsContainer = document.getElementById('panel-items');
      if (itemsContainer) itemsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: gray;">Mesa Paga / Finalizada</div>';
      
      const panelHeader = document.querySelector('.panel-header h2');
      if (panelHeader) panelHeader.innerText = 'Mesa Paga';
      
      const paymentVal = document.querySelector('.payment-val');
      if (paymentVal) paymentVal.innerText = 'R$ 0,00';
      
      const btnFinalizar = document.getElementById('btn-finalizar');
      if(btnFinalizar) {
        btnFinalizar.innerHTML = '<i class="ph ph-check-circle" style="font-size: 20px;"></i> Finalizada';
        btnFinalizar.disabled = true;
      }
    }
  });

// Caixa Logic
  socket.on('erro_caixa', (msg) => {
    alert(msg);
    const btnFinalizar = document.getElementById('btn-finalizar-venda');
    if(btnFinalizar) btnFinalizar.innerHTML = 'FINALIZAR VENDA';
  });

  socket.on('atualizacao_caixa', () => {
    socket.emit('get_estado_caixa');
    socket.emit('get_financeiro');
    socket.emit('get_relatorios');
  });
  
  socket.on('estado_caixa', (turno) => {
  const overlay = document.getElementById('caixa-overlay');
  const span = document.getElementById('status-caixa-name');
  if (turno) {
    if (overlay) overlay.style.display = 'none';
    if (span) span.innerText = 'Caixa Aberto';
    console.log("Caixa está aberto:", turno);
  } else {
    if (overlay) overlay.style.display = 'flex';
    if (span) span.innerText = 'Caixa Fechado';
    console.log("Caixa está fechado.");
  }
});

document.addEventListener('DOMContentLoaded', () => {
  socket.emit('get_estado_caixa');
  socket.emit('get_produtos');
  socket.emit('get_funcionarios');
  
  const btnAbrir = document.getElementById('btn-abrir-caixa');
  if (btnAbrir) {
    btnAbrir.onclick = () => {
      alert("Botão clicado! Verificando conexão com o servidor...");
      let valInput = document.getElementById('fundo-troco').value;
      if (!valInput) valInput = '0';
      const fundo = parseFloat(valInput.replace(',', '.'));
      if (!isNaN(fundo)) {
        console.log("Emitindo abrir_caixa:", fundo);
        socket.emit('abrir_caixa', { fundo_troco: fundo });
      } else {
        alert('Digite um valor numérico válido para o fundo de troco.');
      }
    };
  }

  const btnNovo = document.getElementById('btn-adicionar-produtos');
  const pdvOverlay = document.getElementById('pdv-overlay');

  window.pdvCart = [];
  window.pdvCurrentCategory = 'Todas';
  window.pdvConfigs = {};

  function fetchPdvConfigs() {
    fetch('/api/config')
      .then(r => r.json())
      .then(conf => {
        window.pdvConfigs = conf;
        if (typeof window.renderPdvMenu === 'function') window.renderPdvMenu();
      })
      .catch(e => console.error("Erro fetch configs:", e));
  }
  fetchPdvConfigs();
  socket.on('configuracoes_atualizadas', fetchPdvConfigs);

  window.renderPdvMenu = () => {
    if (!window.allProducts) return;
    const catsDiv = document.getElementById('pdv-categories');
    const itemsDiv = document.getElementById('pdv-menu-items');
    if (!catsDiv || !itemsDiv) return;

    let categories = [...new Set(window.allProducts.map(p => p.categoria))];

    if (window.pdvConfigs && window.pdvConfigs.ordem_categorias) {
      try {
        const order = JSON.parse(window.pdvConfigs.ordem_categorias);
        categories.sort((a, b) => {
          let idxA = order.indexOf(a);
          let idxB = order.indexOf(b);
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
      } catch(e){}
    }
    
    if (categories.includes('Mais Pedidos')) {
      categories = ['Mais Pedidos', ...categories.filter(t => t !== 'Mais Pedidos')];
    }
    
    categories = ['Todas', ...categories];

    catsDiv.innerHTML = categories.map(c => `
      <button class="pdv-category-btn ${c === window.pdvCurrentCategory ? 'active' : ''}" 
              onclick="window.pdvCurrentCategory='${c}'; window.renderPdvMenu()"
              style="padding: 10px; border-radius: 8px; border: none; background: ${c === window.pdvCurrentCategory ? '#fc4b15' : '#eee'}; color: ${c === window.pdvCurrentCategory ? 'white' : '#333'}; font-weight: bold; cursor: pointer; text-align: left; width: 100%;">
        ${c}
      </button>
    `).join('');

    const query = window.pdvSearchQuery || '';
    let filteredProds = [];
    if (query.trim() !== '') {
      filteredProds = window.allProducts.filter(p => p.nome.toLowerCase().includes(query) || (p.categoria && p.categoria.toLowerCase().includes(query)));
    } else {
      filteredProds = window.pdvCurrentCategory === 'Todas' ? window.allProducts : window.allProducts.filter(p => p.categoria === window.pdvCurrentCategory);
    }

    itemsDiv.innerHTML = filteredProds.map(p => `
      <button class="pdv-item" onclick="window.pdvAddToCart(${p.id})"
              style="padding: 16px; border: 1px solid #eee; border-radius: 8px; cursor: pointer; text-align: left; background: white; transition: 0.2s;">
         <div style="font-weight:bold; font-size: 16px;">${p.emoji} ${p.nome}</div>
         <div style="color: gray; font-size: 14px; margin-top: 4px;">R$ ${p.preco.toFixed(2).replace('.', ',')}</div>
      </button>
    `).join('');
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
      return `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #eee;">
          <div style="flex: 1; display: flex; flex-direction: column;">
            <strong style="font-size: 16px;">${item.nome}</strong>
            <span style="color: gray; font-size: 14px;">R$ ${item.preco.toFixed(2).replace('.', ',')} x ${item.quantity}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button onclick="window.pdvRemoveFromCart(${item.id})" style="background: #eee; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">-</button>
            <span style="font-size: 14px; width: 20px; text-align: center;">${item.quantity}</span>
            <button onclick="window.pdvAddToCart(${item.id})" style="background: #3ab55b; color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">+</button>
          </div>
        </li>
      `;
    }).join('');
    
    if (window.pdvCart.length === 0) cartList.innerHTML = '<li style="text-align:center; padding: 20px; color: gray;">Carrinho vazio</li>';
    
    const taxa = parseFloat(document.getElementById('pdv-taxa-entrega')?.value || 0);
    if (document.getElementById('pdv-tipo-pedido')?.value === 'Delivery') total += taxa;
    
    totalPrice.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
  };

    if (btnNovo && pdvOverlay) {
      btnNovo.onclick = () => {
        window.pdvCart = [];
        window.renderPdvCart();
        window.renderPdvMenu();
        
        const tipoPedido = document.getElementById('pdv-tipo-pedido');
        const clienteNomeInput = document.getElementById('pdv-cliente-nome');
        
        if (window.mesaAtual && tipoPedido) {
            tipoPedido.value = 'Mesa';
            tipoPedido.dispatchEvent(new Event('change'));
            tipoPedido.disabled = true;
            if (clienteNomeInput) {
               clienteNomeInput.value = window.mesaAtual.nome || window.mesaAtual.mesaName;
               clienteNomeInput.disabled = true;
            }
        } else if (tipoPedido) {
            tipoPedido.disabled = false;
            if (clienteNomeInput) clienteNomeInput.disabled = false;
            if (tipoPedido.value === 'Mesa') {
                tipoPedido.value = 'Balcão';
                tipoPedido.dispatchEvent(new Event('change'));
            }
            if (clienteNomeInput) clienteNomeInput.value = '';
        }
        
        pdvOverlay.style.display = 'flex';
      };
    }

  const btnFecharPdv = document.getElementById('btn-fechar-pdv');
  if (btnFecharPdv) {
    btnFecharPdv.onclick = () => pdvOverlay.style.display = 'none';
  }

  const tipoPedido = document.getElementById('pdv-tipo-pedido');
  if (tipoPedido) {
    tipoPedido.onchange = (e) => {
      document.getElementById('pdv-delivery-fields').style.display = e.target.value === 'Delivery' ? 'flex' : 'none';
      window.renderPdvCart();
    };
  }

  const taxaEntregaInput = document.getElementById('pdv-taxa-entrega');
  if(taxaEntregaInput) taxaEntregaInput.oninput = window.renderPdvCart;

  // --- AUTO-COMPLETE CLIENTE POR TELEFONE ---
  const pdvTelInput = document.getElementById('pdv-cliente-telefone');
  let searchTimeout = null;
  if (pdvTelInput) {
    pdvTelInput.addEventListener('input', (e) => {
       const tel = e.target.value.trim();
       if (tel.length >= 8) {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
             socket.emit('buscar_cliente_telefone', tel);
          }, 500);
       }
    });
  }

  socket.on('resultado_cliente_telefone', (cliente) => {
    if (cliente) {
       document.getElementById('pdv-cliente-id').value = cliente.id;
       document.getElementById('pdv-cliente-nome').value = cliente.nome;
       if (cliente.endereco && document.getElementById('pdv-cliente-endereco')) {
          document.getElementById('pdv-cliente-endereco').value = cliente.endereco;
       }
       if (cliente.pontos !== undefined) {
          document.getElementById('pdv-cliente-pontos').innerText = `⭐ ${cliente.pontos} pts`;
       }
       if (cliente.observacao) {
          alert(`Atenção: O cliente ${cliente.nome} possui a seguinte observação em seu cadastro:\n\n"${cliente.observacao}"`);
       }
    } else {
       document.getElementById('pdv-cliente-id').value = '';
       document.getElementById('pdv-cliente-pontos').innerText = '';
    }
  });

  // --- SCANNER DE QR CODE DE PREMIO ---
  const qrInput = document.getElementById('pdv-qr-premio');
  if (qrInput) {
    qrInput.addEventListener('keydown', (e) => {
       if (e.key === 'Enter') {
          e.preventDefault();
          const code = qrInput.value.trim();
          if (code !== '') {
             socket.emit('resgatar_premio_qr', code);
             qrInput.value = '';
          }
       }
    });
  }

  socket.on('resgate_erro', (msg) => {
    alert(msg);
  });

  socket.on('resgate_sucesso', ({ cliente, produto, custo }) => {
    alert(`Prêmio resgatado com sucesso!\nCliente: ${cliente.nome}\nCusto: ${custo} pts\nProduto: ${produto}\n\nO item foi adicionado ao carrinho com custo R$ 0,00.`);
    // Adicionar o produto no carrinho com preço 0
    window.pdvCart.push({
      id: 'premio_' + Date.now(),
      nome: produto + ' (Prêmio)',
      emoji: '🎁',
      preco: 0.00,
      quantity: 1,
      categoria: 'Prêmios'
    });
    window.renderPdvCart();
    
    // Atualizar os pontos exibidos no PDV (subtrair)
    document.getElementById('pdv-cliente-pontos').innerText = `⭐ ${cliente.pontos - custo} pts`;
  });

  const btnLancarPdv = document.getElementById('btn-lancar-pdv');
  if (btnLancarPdv) {
    btnLancarPdv.onclick = () => {
      if(window.pdvCart.length === 0) return alert('Adicione itens!');
      
      const tipo = document.getElementById('pdv-tipo-pedido').value;
      const clienteNome = document.getElementById('pdv-cliente-nome').value || 'Avulso';
      const clienteId = document.getElementById('pdv-cliente-id').value || null;
      const entregadorId = document.getElementById('pdv-entregador-select').value;
      const taxaEntrega = parseFloat(document.getElementById('pdv-taxa-entrega')?.value || 0);

      window.pdvCart.forEach(item => {
        let sector = item.setor || 'Cozinha 1';
        
        let finalLocalName = `Balcão - ${clienteNome}`;
        if (tipo === 'Delivery') {
            finalLocalName = `Delivery - ${clienteNome}`;
        } else if (tipo === 'Mesa') {
            finalLocalName = clienteNome;
        }

        const pedido = {
          productName: item.nome,
          productEmoji: item.emoji,
          quantity: item.quantity,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          localName: finalLocalName,
          userName: window.loggedInUser || 'Caixa',
          total: (item.preco * item.quantity).toFixed(2).replace('.', ','),
          status: 'Recebido',
          status_inicial: item.status_inicial,
          sector: sector,
          cliente_id: clienteId,
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
         localName: `Delivery - ${clienteNome}`,
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
  }
});


// --- ADMIN PANEL LOGIC ---
const btnAdminPanel = document.getElementById('btn-admin-panel');
const adminOverlay = document.getElementById('admin-overlay');
const btnFecharAdmin = document.getElementById('btn-fechar-admin');

// Removed if (btnAdminPanel && adminOverlay) so socket listeners can attach
  
  // Tabs logic (Kept for compatibility, now handled mainly in configuracoes.js but harmless here)
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.fontWeight = 'normal';
      });
      btn.classList.add('active');
      btn.style.background = '#eee';
      btn.style.fontWeight = 'bold';

      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
      document.getElementById('admin-tab-' + btn.dataset.tab).style.display = 'block';
    };
  });

  // Socket updates
  socket.on('mesas_atualizadas', (mesas) => {
    window.allMesas = mesas;
    if (typeof renderOrders === 'function') renderOrders();
    
    const list = document.getElementById('admin-mesas-list');
    if(!list) return;
    list.innerHTML = mesas.map(m => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${m.id}</td>
        <td style="padding: 10px;">${m.nome} <span style="font-size:12px; color:gray;">(${m.status})</span></td>
        <td style="padding: 10px;">
          <button onclick="window.deleteMesa(${m.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
  });

  socket.on('produtos_atualizados', (prods) => {
    window.allProducts = prods;
    if (typeof window.renderPdvMenu === 'function') window.renderPdvMenu();
    const list = document.getElementById('admin-produtos-list');
    if(!list) return;
    list.innerHTML = prods.map(p => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${p.categoria}</td>
        <td style="padding: 10px;">${p.emoji} ${p.nome}</td>
        <td style="padding: 10px;">R$ ${p.preco.toFixed(2)}</td>
        <td style="padding: 10px;">${p.setor || 'Cozinha 1'}</td>
        <td style="padding: 10px;">${p.status_inicial || 'Em espera'}</td>
        <td style="padding: 10px;">
          <button onclick="window.editProduto(${p.id}, '${p.categoria.replace(/'/g, "\\'")}', '${p.nome.replace(/'/g, "\\'")}', ${p.preco}, '${(p.emoji || '').replace(/'/g, "\\'")}', '${p.setor || 'Cozinha 1'}', '${p.status_inicial || 'Em espera'}')" style="color: #2D9CDB; border: none; background: none; cursor: pointer; margin-right: 8px;"><i class="ph ph-pencil"></i> Editar</button>
          <button onclick="window.deleteProduto(${p.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
  });

  socket.on('funcionarios_atualizados', (funcs) => {
    const pdvSelect = document.getElementById('pdv-entregador-select');
    if (pdvSelect) {
      pdvSelect.innerHTML = '<option value="">Nenhum</option>' + 
        funcs.filter(f => f.status !== 'Pendente')
             .map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
    }
    const listAtivos = document.getElementById('admin-funcionarios-list');
    const listPendentes = document.getElementById('admin-funcionarios-pendentes');
    if(!listAtivos || !listPendentes) return;

    window.funcionariosList = funcs;
      const pendentes = funcs.filter(f => f.status === 'Pendente');
    const ativos = funcs.filter(f => f.status !== 'Pendente');

    listPendentes.innerHTML = pendentes.map(f => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${f.nome}</td>
        <td style="padding: 10px;">${f.usuario}</td>
        <td style="padding: 10px; text-align: right;">
          <select id="cargo-pendente-${f.id}" style="padding: 6px; border-radius: 6px; border: 1px solid #ccc; margin-right: 8px; font-family: Inter;">
            <option value="Garçom">Garçom</option>
            <option value="Caixa">Caixa</option>
            <option value="Cozinha">Cozinha</option>
            <option value="Bar">Bar</option>
            <option value="Copa">Copa</option>
            <option value="Auxiliar">Auxiliar</option>
          </select>
          <button onclick="window.aprovarFuncionario(${f.id})" style="color: white; background: #3ab55b; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-right: 4px; font-weight: bold;"><i class="ph ph-check"></i> Aprovar</button>
          <button onclick="window.recusarFuncionario(${f.id})" style="color: white; background: #eb5757; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="ph ph-x"></i> Recusar</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="padding: 10px; text-align: center; color: gray;">Nenhum cadastro pendente</td></tr>`;

    listAtivos.innerHTML = ativos.map(f => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${f.nome}</td>
        <td style="padding: 10px;">${f.usuario}</td>
        <td style="padding: 10px;">${f.cargo}</td>
        <td style="padding: 10px;">
          <button onclick="window.abrirModalEditarFuncionario(${f.id})" style="color: #2b5c9e; border: none; background: none; cursor: pointer; margin-right: 10px;"><i class="ph ph-pencil"></i> Editar</button>
            <button onclick="window.deleteFuncionario(${f.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
    `).join('');
  });

  // Global functions for inline onclicks
  window.deleteMesa = (id) => { if(confirm('Excluir mesa?')) socket.emit('delete_mesa', id); };
  window.deleteProduto = (id) => { if(confirm('Excluir produto?')) socket.emit('delete_produto', id); };
  
  window.editProduto = (id, categoria, nome, preco, emoji, setor, status_inicial) => {
    document.getElementById('admin-prod-id').value = id;
    document.getElementById('admin-prod-cat').value = categoria;
    document.getElementById('admin-prod-nome').value = nome;
    document.getElementById('admin-prod-preco').value = preco;
    document.getElementById('admin-prod-emoji').value = emoji;
    document.getElementById('admin-prod-setor').value = setor;
    const siEl = document.getElementById('admin-prod-status-inicial');
    if (siEl) siEl.value = status_inicial || 'Em espera';
    const btn = document.getElementById('btn-admin-add-prod');
    if (btn) btn.innerHTML = '<i class="ph ph-check"></i> Salvar';
  };

  window.deleteFuncionario = (id) => { if(confirm('Excluir funcionário?')) socket.emit('delete_funcionario', id); };
  window.aprovarFuncionario = (id) => { 
    if(confirm('Aprovar este colaborador?')) {
      let cargoSelect = document.getElementById('cargo-pendente-' + id);
      let cargo = cargoSelect ? cargoSelect.value : 'Garçom'; let vInput = document.getElementById('valor-pendente-' + id); let valor_hora = vInput ? parseFloat(vInput.value) || 0 : 0;
      socket.emit('aprovar_funcionario', { id: id, cargo: cargo, valor_hora: valor_hora }); 
    }
  };
  window.recusarFuncionario = (id) => { if(confirm('Recusar este colaborador?')) socket.emit('recusar_funcionario', id); };

  // Add Listeners
  const addMesaBtn = document.getElementById('btn-admin-add-mesa');
  if (addMesaBtn) addMesaBtn.onclick = () => {
    const nome = document.getElementById('admin-mesa-nome').value;
    if(nome) { socket.emit('add_mesa', nome); document.getElementById('admin-mesa-nome').value = ''; }
  };

  const addProdBtn = document.getElementById('btn-admin-add-prod');
  if (addProdBtn) addProdBtn.onclick = () => {
    const id = document.getElementById('admin-prod-id').value;
    const categoria = document.getElementById('admin-prod-cat').value;
    const nome = document.getElementById('admin-prod-nome').value;
    const preco = parseFloat(document.getElementById('admin-prod-preco').value);
    const emoji = document.getElementById('admin-prod-emoji').value;
    const setor = document.getElementById('admin-prod-setor').value || 'Cozinha 1';
    const siEl = document.getElementById('admin-prod-status-inicial');
    const status_inicial = siEl ? siEl.value : 'Em espera';
    
    if(categoria && nome && !isNaN(preco)) {
      if (id) {
        socket.emit('edit_produto', { id, categoria, nome, preco, emoji: emoji || '🍔', setor, status_inicial });
      } else {
        socket.emit('add_produto', { categoria, nome, preco, emoji: emoji || '🍔', hasAddons: false, setor, status_inicial });
      }
      document.getElementById('admin-prod-id').value = '';
      document.getElementById('admin-prod-nome').value = '';
      document.getElementById('admin-prod-preco').value = '';
      document.getElementById('admin-prod-emoji').value = '';
      if (siEl) siEl.value = 'Em espera';
      addProdBtn.innerHTML = '<i class="ph ph-plus"></i>';
    }
  };

  const addFuncBtn = document.getElementById('btn-admin-add-func');
  if (addFuncBtn) addFuncBtn.onclick = () => {
    const nome = document.getElementById('admin-func-nome').value;
    const usuario = document.getElementById('admin-func-user').value;
    const senha = document.getElementById('admin-func-pass').value;
    const cargo = document.getElementById('admin-func-cargo').value;
    if(nome && usuario && senha) {
      const valor_hora = parseFloat(document.getElementById('admin-func-valor-hora').value) || 0; socket.emit('add_funcionario', { nome, usuario, senha, cargo, valor_hora });
      document.getElementById('admin-func-nome').value = '';
      document.getElementById('admin-func-user').value = '';
      document.getElementById('admin-func-pass').value = '';
    }
  };

  // Clientes
  socket.on('clientes_atualizados', (lista) => {
    const tbody = document.getElementById('admin-clientes-list');
    if (!tbody) return;
    tbody.innerHTML = lista.map(c => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${c.id}</td>
        <td style="padding: 10px;">${c.nome}<br><small style="color:gray;">Nasc: ${c.data_nascimento ? new Date(c.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}</small></td>
        <td style="padding: 10px;">${c.telefone || '-'}<br><small style="color:gray;">End: ${c.endereco || '-'}</small></td>
        <td style="padding: 10px; max-width: 150px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${c.observacao || ''}">${c.observacao || '-'}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: #3ab55b;">⭐ ${c.pontos || 0}</td>
        <td style="padding: 10px;">
          <button onclick="window.editCliente(${c.id}, '${c.nome.replace(/'/g, "\\'")}', '${c.telefone || ''}', '${(c.observacao || '').replace(/'/g, "\\'")}', '${(c.endereco || '').replace(/'/g, "\\'")}', '${c.data_nascimento || ''}')" style="color: #2D9CDB; border: none; background: none; cursor: pointer; margin-right: 8px;"><i class="ph ph-pencil"></i></button>
          <button onclick="window.deleteCliente(${c.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i></button>
        </td>
      </tr>
    `).join('');
  });

  window.editCliente = (id, nome, telefone, observacao, endereco, nascimento) => {
    document.getElementById('admin-cli-id').value = id;
    document.getElementById('admin-cli-nome').value = nome;
    document.getElementById('admin-cli-tel').value = telefone;
    document.getElementById('admin-cli-obs').value = observacao;
    document.getElementById('admin-cli-endereco').value = endereco;
    document.getElementById('admin-cli-nascimento').value = nascimento;
    const btn = document.getElementById('btn-admin-add-cli');
    if (btn) btn.innerText = 'Atualizar';
  };

  // Promocoes
  socket.on('promocoes_atualizadas', (lista) => {
    window.PROMOCOES = lista;
    const tbody = document.getElementById('admin-promocoes-list');
    if (!tbody) return;
    tbody.innerHTML = lista.map(p => {
      let cfg = {};
      try { cfg = JSON.parse(p.config || '{}'); } catch(e){}
      
      let diasStr = cfg.dias_semana ? cfg.dias_semana.map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d]).join(', ') : 'Todos';
      let horaStr = (cfg.horario_inicio && cfg.horario_fim) ? `${cfg.horario_inicio} às ${cfg.horario_fim}` : 'Sempre';
      let regraStr = `Tipo: ${cfg.tipo_promocao}<br><small>${diasStr} | ${horaStr}</small>`;

      return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${p.nome}</td>
        <td style="padding: 10px;">${cfg.tipo_promocao === 'combo' ? 'Combo' : (cfg.tipo_promocao === 'livre' ? 'Rodízio' : 'Desconto/Preço')}</td>
        <td style="padding: 10px;">${regraStr}</td>
        <td style="padding: 10px;">
          <button onclick="window.deletePromocao(${p.id})" style="color: red; border: none; background: none; cursor: pointer;"><i class="ph ph-trash"></i> Excluir</button>
        </td>
      </tr>
      `;
    }).join('');
  });

  window.deleteCliente = (id) => { if(confirm('Excluir cliente?')) socket.emit('delete_cliente', id); };
  window.deletePromocao = (id) => { if(confirm('Excluir promoção?')) socket.emit('delete_promocao', id); };

  const addCliBtn = document.getElementById('btn-admin-add-cli');
  if (addCliBtn) addCliBtn.onclick = () => {
    const id = document.getElementById('admin-cli-id').value;
    const nome = document.getElementById('admin-cli-nome').value;
    const telefone = document.getElementById('admin-cli-tel').value;
    const observacao = document.getElementById('admin-cli-obs').value;
    const endereco = document.getElementById('admin-cli-endereco').value;
    const data_nascimento = document.getElementById('admin-cli-nascimento').value;

    if(nome) {
      socket.emit('add_cliente', { id: id || null, nome, telefone, observacao, endereco, data_nascimento });
      document.getElementById('admin-cli-id').value = '';
      document.getElementById('admin-cli-nome').value = '';
      document.getElementById('admin-cli-tel').value = '';
      document.getElementById('admin-cli-obs').value = '';
      document.getElementById('admin-cli-endereco').value = '';
      document.getElementById('admin-cli-nascimento').value = '';
      addCliBtn.innerText = 'Salvar';
    }
  };

  window.togglePromoFields = () => {
    const tipo = document.getElementById('admin-promo-tipo').value;
    document.getElementById('promo-fields-desconto').style.display = tipo === 'desconto_fixo' ? 'block' : 'none';
    document.getElementById('promo-fields-produto').style.display = tipo === 'preco_fixo' ? 'flex' : 'none';
    document.getElementById('promo-fields-combo').style.display = tipo === 'combo' ? 'flex' : 'none';
    document.getElementById('promo-fields-livre').style.display = tipo === 'livre' ? 'block' : 'none';
    
    // Combo tbm precisa do produto alvo
    if (tipo === 'combo') {
       document.getElementById('promo-fields-produto').style.display = 'flex';
       document.getElementById('admin-promo-novopreco').style.display = 'none'; // combo pode não alterar preço do principal
    } else {
       const elPreco = document.getElementById('admin-promo-novopreco');
       if(elPreco) elPreco.style.display = 'block';
    }
  };

  const addPromoBtn = document.getElementById('btn-admin-add-promo');
  if (addPromoBtn) addPromoBtn.onclick = () => {
    const nome = document.getElementById('admin-promo-nome').value;
    if(!nome) return alert('Nome da promoção obrigatório!');
    
    const config = {
      tipo_promocao: document.getElementById('admin-promo-tipo').value,
      dias_semana: Array.from(document.querySelectorAll('#admin-promo-dias input:checked')).map(cb => parseInt(cb.value)),
      horario_inicio: document.getElementById('admin-promo-inicio').value || null,
      horario_fim: document.getElementById('admin-promo-fim').value || null,
    };

    let desconto = 0;

    if (config.tipo_promocao === 'desconto_fixo') {
       desconto = parseFloat(document.getElementById('admin-promo-desc').value) || 0;
    } else if (config.tipo_promocao === 'preco_fixo') {
       config.produto_alvo_nome = document.getElementById('admin-promo-alvo').value.trim();
       config.novo_preco = parseFloat(document.getElementById('admin-promo-novopreco').value) || 0;
    } else if (config.tipo_promocao === 'combo') {
       config.produto_alvo_nome = document.getElementById('admin-promo-alvo').value.trim();
       config.produto_brinde_nome = document.getElementById('admin-promo-brinde').value.trim();
    } else if (config.tipo_promocao === 'livre') {
       const cats = document.getElementById('admin-promo-cats').value.split(',').map(s => s.trim()).filter(s => s);
       config.categorias_inclusas = cats;
    }

    socket.emit('add_promocao', { nome, regra: config.tipo_promocao, desconto, ativo: true, config: JSON.stringify(config) });
    
    document.getElementById('admin-promo-nome').value = '';
    document.querySelectorAll('#admin-promo-dias input').forEach(cb => cb.checked = false);
  };

// System Alert for "Pedir Conta"
socket.on('toque_pedir_conta', (mesaName) => {
  try {
    const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3', { query: { token: localStorage.getItem('chef_token') } });
    audio.play();
  } catch(e){}
  alert('🔔 A ' + mesaName + ' está pedindo a conta!');
});

document.addEventListener('DOMContentLoaded', () => {
  // --- LÓGICA DO MODAL DE PAGAMENTO ---
  let modalPaymentValue = 0; // valor em centavos
  let isPaymentModalOpen = false;

  function updatePaymentDisplay() {
    const display = document.getElementById('pagamento-display-input');
    if (!display) return;
    const reais = (modalPaymentValue / 100).toFixed(2).replace('.', ',');
    display.innerText = reais;
  }

  function appendDigit(digit) {
    const str = modalPaymentValue.toString();
    if (str.length < 9) { // max limit approx 999.999,99
      if (digit === '00') {
        modalPaymentValue = parseInt(str + '00', 10);
      } else {
        modalPaymentValue = parseInt(str + digit, 10);
      }
      updatePaymentDisplay();
    }
  }

  function backspaceDigit() {
    const str = modalPaymentValue.toString();
    if (str.length <= 1) {
      modalPaymentValue = 0;
    } else {
      modalPaymentValue = parseInt(str.slice(0, -1), 10);
    }
    updatePaymentDisplay();
  }

  const btnAbrirModal = document.getElementById('btn-abrir-modal-pagamento');
  const btnFecharModal = document.getElementById('btn-fechar-modal-pagamento');
  const modalPagamento = document.getElementById('pagamento-overlay');

  if (btnAbrirModal) {
    btnAbrirModal.onclick = () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      isPaymentModalOpen = true;
      modalPaymentValue = 0;
      updatePaymentDisplay();
      if (window.calcRestante) window.calcRestante(); // Refresh labels
      modalPagamento.style.display = 'flex';
    };
  }

  if (btnFecharModal) {
    btnFecharModal.onclick = () => {
      isPaymentModalOpen = false;
      modalPagamento.style.display = 'none';
    };
  }

  document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute('data-val');
      if (val === 'BACKSPACE') {
        backspaceDigit();
      } else {
        appendDigit(val);
      }
    };
  });

  document.addEventListener('keydown', (e) => {
    if (!isPaymentModalOpen) return;
    // Captura números do teclado físico
    if (e.key >= '0' && e.key <= '9') {
      appendDigit(e.key);
    } else if (e.key === 'Backspace') {
      backspaceDigit();
    }
  });

  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.onclick = () => {
      if (!window.pagamentosParciais) window.pagamentosParciais = [];
      const metodo = btn.getAttribute('data-method');
      const valor = modalPaymentValue / 100;
      
      if (valor > 0) {
        window.pagamentosParciais.push({ metodo, valor });
        modalPaymentValue = 0;
        updatePaymentDisplay();
        if (window.calcRestante) window.calcRestante();
      } else {
        // Se o operador clicou no método com visor zerado, e há um restante, auto-preencher?
        // Vamos permitir que ele digite o valor antes de clicar.
        const faltaTexto = document.getElementById('modal-restante').innerText.replace('R$ ', '').replace('.', '').replace(',','.');
        const falta = parseFloat(faltaTexto);
        if (falta > 0) {
           window.pagamentosParciais.push({ metodo, valor: falta });
           if (window.calcRestante) window.calcRestante();
        }
      }
    };
  });
});

window.removerPagamento = (idx) => {
  if (!window.pagamentosParciais) return;
  window.pagamentosParciais.splice(idx, 1);
  if (window.calcRestante) window.calcRestante();
};

// --- Resizable Panels Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const leftPanel = document.getElementById('left-panel');
  const rightPanel = document.getElementById('right-panel');
  const resizerLeft = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');

  // Load saved widths
  const savedLeftWidth = localStorage.getItem('leftPanelWidth');
  const savedRightWidth = localStorage.getItem('rightPanelWidth');
  if (savedLeftWidth && leftPanel) leftPanel.style.width = savedLeftWidth + 'px';
  if (savedRightWidth && rightPanel) rightPanel.style.width = savedRightWidth + 'px';

  // Resizer Left
  if (resizerLeft && leftPanel) {
    let isResizingLeft = false;
    resizerLeft.addEventListener('mousedown', (e) => {
      isResizingLeft = true;
      resizerLeft.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizingLeft) return;
      let newWidth = e.clientX;
      if (newWidth < 150) newWidth = 150;
      if (newWidth > 500) newWidth = 500;
      leftPanel.style.width = newWidth + 'px';
      localStorage.setItem('leftPanelWidth', newWidth);
    });
    document.addEventListener('mouseup', () => {
      if (isResizingLeft) {
        isResizingLeft = false;
        resizerLeft.classList.remove('dragging');
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    });
  }

  // Resizer Right
  if (resizerRight && rightPanel) {
    let isResizingRight = false;
    resizerRight.addEventListener('mousedown', (e) => {
      isResizingRight = true;
      resizerRight.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizingRight) return;
      let newWidth = window.innerWidth - e.clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 600) newWidth = 600;
      rightPanel.style.width = newWidth + 'px';
      localStorage.setItem('rightPanelWidth', newWidth);
    });
    document.addEventListener('mouseup', () => {
      if (isResizingRight) {
        isResizingRight = false;
        resizerRight.classList.remove('dragging');
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    });
  }
});

// --- Sidebar Actions Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const btnConta = document.getElementById('btn-imprimir-conta');
  const btnDesconto = document.getElementById('btn-aplicar-desconto');
  const btnServico = document.getElementById('btn-aplicar-servico');
  const btnComissao = document.getElementById('btn-ver-comissao');
  const btnAgrupar = document.getElementById('btn-agrupar-itens');

  if (btnConta) {
    btnConta.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      let itemsHtml = window.mesaAtual.items.map(i => `
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
          <span>${i.quantity||1}x ${i.productName}</span>
          <span>R$ ${parseFloat(String(i.total).replace(',','.')).toFixed(2).replace('.',',')}</span>
        </div>
      `).join('');
      
      const subtotal = window.mesaAtual.total;
      const taxaVal = window.servicoAdicional + (document.getElementById('taxa-servico')?.checked ? Math.max(0, subtotal - window.descontoAdicional)*0.1 : 0);
      const totalFinal = subtotal - window.descontoAdicional + taxaVal;

      printWindow.document.write(`
        <html><head><style>
          body { font-family: monospace; padding: 20px; width: 300px; color: #000; background: #fff; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
        </style></head><body>
          <div class="center bold" style="font-size:16px;">CHEF COZINHA</div>
          <div class="center" style="margin-bottom:10px;">CONFERÊNCIA DE MESA</div>
          <div>Mesa: <span class="bold">${window.mesaAtual.isGroup ? window.mesaAtual.mesaName : window.mesaAtual.nome}</span></div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>R$ ${subtotal.toFixed(2).replace('.',',')}</span></div>
          ${window.descontoAdicional > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Desconto:</span><span>- R$ ${window.descontoAdicional.toFixed(2).replace('.',',')}</span></div>` : ''}
          ${taxaVal > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Serviços/Taxas:</span><span>R$ ${taxaVal.toFixed(2).replace('.',',')}</span></div>` : ''}
          <div class="divider"></div>
          <div class="bold" style="display:flex; justify-content:space-between; font-size:14px;"><span>TOTAL:</span><span>R$ ${totalFinal.toFixed(2).replace('.',',')}</span></div>
          <div class="center" style="margin-top:20px; font-size:10px;">Obrigado pela preferência!</div>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    });
  }

  if (btnDesconto) {
    btnDesconto.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const val = prompt('Digite o valor do desconto em R$ (Ex: 15.50):');
      if (val) {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          window.descontoAdicional = num;
          if (window.calcularTotal) window.calcularTotal();
          if (window.calcRestante) window.calcRestante();
        }
      }
    });
  }

  if (btnServico) {
    btnServico.addEventListener('click', () => {
      if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
      const val = prompt('Digite o valor de serviço/couvert extra em R$ (Ex: 10.00):');
      if (val) {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          window.servicoAdicional = num;
          if (window.calcularTotal) window.calcularTotal();
          if (window.calcRestante) window.calcRestante();
        }
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // --- TOP MENUBAR DROPDOWNS ---
  document.querySelectorAll('.menu-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
      const dropdownId = trigger.getAttribute('data-dropdown');
      if (dropdownId) {
        document.getElementById(dropdownId).classList.toggle('show');
      }
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
  });

  const mnuAbrir = document.getElementById('menu-abrir-caixa');
  if(mnuAbrir) mnuAbrir.onclick = () => {
     const b = document.getElementById('btn-abrir-caixa');
     if(b) b.click();
     else {
        // if not in DOM, maybe we need to emit directly
        const val = prompt('Qual o valor inicial do caixa?');
        if (val !== null) socket.emit('abrir_caixa', { fundo_troco: parseFloat(val) || 0 });
     }
  };
  
  const mnuFechar = document.getElementById('menu-fechar-caixa');
  if(mnuFechar) mnuFechar.onclick = () => {
     const b = document.getElementById('btn-fechar-caixa');
     if(b) b.click();
     else socket.emit('fechar_caixa');
  };
  
  const mnuConfig = document.getElementById('menu-configuracoes');
  if(mnuConfig) mnuConfig.onclick = () => { window.location.href = '/configuracoes.html'; };
  const mnuCad = document.getElementById('menu-cadastro');
  if(mnuCad) mnuCad.onclick = () => { window.location.href = '/configuracoes.html'; };
  
  const mnuAjuda = document.getElementById('menu-ajuda');
  const ajudaOverlay = document.getElementById('ajuda-overlay');
  const btnFecharAjuda = document.getElementById('btn-fechar-ajuda');
  if(mnuAjuda && ajudaOverlay) {
    mnuAjuda.onclick = () => ajudaOverlay.style.display = 'flex';
  }
  if(btnFecharAjuda && ajudaOverlay) {
    btnFecharAjuda.onclick = () => ajudaOverlay.style.display = 'none';
  }

  // --- KEYBOARD SHORTCUTS ---
  document.addEventListener('keydown', (e) => {
    // ESC - Voltar / Fechar Telas
    if (e.key === 'Escape') {
      let closedSomething = false;
      const overlays = [
        document.getElementById('pdv-overlay'),
        document.getElementById('admin-overlay'),
        document.getElementById('ajuda-overlay'),
        document.getElementById('relatorios-overlay'),
        document.getElementById('financeiro-overlay')
      ];
      overlays.forEach(overlay => {
        if (overlay && overlay.style.display === 'flex') {
          overlay.style.display = 'none';
          closedSomething = true;
        }
      });
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if(menu.classList.contains('show')) {
          menu.classList.remove('show');
          closedSomething = true;
        }
      });
      // Se não fechou nenhum modal, pode ser que ele queira voltar a página
      if (!closedSomething && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
         // Opcional: voltar caso esteja em outra tela e use main.js
      }
    }
    // Ctrl + O - Fila de Pedidos
    else if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      window.location.href = 'fila.html';
    }
    // F2 - Venda Rapida (Balcao)
    else if (e.key === 'F2') {
      e.preventDefault();
      document.getElementById('toolbar-balcao')?.click();
    }
    // F3 - Delivery
    else if (e.key === 'F3') {
      e.preventDefault();
      document.getElementById('toolbar-delivery')?.click();
    }
    // F4 - Finalizar Venda
    else if (e.key === 'F4') {
      e.preventDefault();
      document.getElementById('btn-finalizar-venda')?.click();
    }
  });

  // --- RELATORIOS OVERLAY ---
  const relatoriosOverlay = document.getElementById('relatorios-overlay');
  const mnuRel = document.getElementById('menu-relatorios');
  if(mnuRel && relatoriosOverlay) {
    mnuRel.onclick = () => {
      relatoriosOverlay.style.display = 'flex';
      socket.emit('get_relatorios');
    };
  }
  const btnFecharRel = document.getElementById('btn-fechar-relatorios');
  if(btnFecharRel && relatoriosOverlay) {
    btnFecharRel.onclick = () => relatoriosOverlay.style.display = 'none';
  }

  // --- FINANCEIRO OVERLAY ---
  const financeiroOverlay = document.getElementById('financeiro-overlay');
  const mnuFin = document.getElementById('menu-financeiro');
  if(mnuFin && financeiroOverlay) {
    mnuFin.onclick = () => {
      financeiroOverlay.style.display = 'flex';
      socket.emit('get_financeiro');
    };
  }
  const btnFecharFin = document.getElementById('btn-fechar-financeiro');
  if(btnFecharFin && financeiroOverlay) {
    btnFecharFin.onclick = () => financeiroOverlay.style.display = 'none';
  }

  const btnAddDespesa = document.getElementById('btn-financeiro-add-despesa');
  if(btnAddDespesa) {
    btnAddDespesa.onclick = () => {
      const desc = document.getElementById('financeiro-despesa-desc').value;
      const val = parseFloat(document.getElementById('financeiro-despesa-valor').value);
      if(!desc || !val) return alert('Preencha descrição e valor!');
      socket.emit('add_despesa', { valor: val, descricao: desc });
      document.getElementById('financeiro-despesa-desc').value = '';
      document.getElementById('financeiro-despesa-valor').value = '';
    };
  }
});

socket.on('relatorios_atualizados', (data) => {
  const elTotal = document.getElementById('relatorios-total-geral');
  if(elTotal) elTotal.innerText = 'R$ ' + (data.total || 0).toFixed(2).replace('.', ',');
  const elProd = document.getElementById('relatorios-produtos-list');
  if(elProd) elProd.innerHTML = data.produtos.map(p => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${p.productName}</td>
      <td style="padding: 10px;">${p.qtd}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(p.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
  const elGarc = document.getElementById('relatorios-garcons-list');
  if(elGarc) elGarc.innerHTML = data.garcons.map(g => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${g.userName}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(g.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
  const elMesas = document.getElementById('relatorios-mesas-list');
  if(elMesas) elMesas.innerHTML = (data.mesas || []).map(m => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${m.localName || 'Avulso'}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(m.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
});

socket.on('financeiro_atualizado', (rows) => {
  const elList = document.getElementById('financeiro-extrato-list');
  if(elList) {
      elList.innerHTML = rows.map(r => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">${new Date(r.data).toLocaleString('pt-BR')}</td>
          <td style="padding: 10px;">${r.tipo === 'Entrada' ? '<span style="color:#3ab55b; font-weight:bold;">Entrada</span>' : '<span style="color:#eb5757; font-weight:bold;">Saída</span>'}</td>
          <td style="padding: 10px;">${r.descricao}</td>
          <td style="padding: 10px;">${r.forma_pagamento}</td>
          <td style="padding: 10px; text-align: right; font-weight:bold; color: ${r.tipo === 'Entrada' ? '#3ab55b' : '#eb5757'}">R$ ${(r.valor||0).toFixed(2).replace('.', ',')}</td>
        </tr>`).join('');
  }
});


// --- UPDATE STATUS BAR AND PERMANENCIA PERIODICALLY ---
setInterval(() => {
    // Permanencia
    if (window.updatePermanencia && window.mesaAtual && window.mesaAtual.isGroup) {
        window.updatePermanencia();
    }
    
    // Footer Stats
    const elMesas = document.getElementById('status-mesas-count');
    const elComandas = document.getElementById('status-comandas-count');
    const elUser = document.getElementById('status-user-name');
    const elCaixa = document.getElementById('status-caixa-name');
    
    if (elMesas && window.allMesas) {
        const ocupadas = window.allMesas.filter(m => m.status !== 'Disponível').length;
        elMesas.innerText = ocupadas + ' / ' + window.allMesas.length;
    }
    
    if (elComandas && typeof ordersData !== 'undefined') {
        const uniqueComandas = new Set(ordersData.map(o => o.mesa_grupo || o.localName || o.id));
        elComandas.innerText = uniqueComandas.size;
    }
    
    if (elUser) {
        const creds = localStorage.getItem('chef_credentials');
        if (creds) {
            try {
                const parsed = JSON.parse(creds);
                window.loggedInUser = parsed.nome || parsed.usuario;
            } catch(e) {}
        } else {
            window.loggedInUser = null;
        }
        elUser.innerText = window.loggedInUser || 'Não logado';
    }
    
    // Caixa could be updated if we receive it. 
    // Just keep it static "Caixa 1" for now or show "Aberto"/"Fechado"
}, 15000); // 15 seconds

// --- Backup & Restore (Admin Modal) ---
window.downloadBackup = () => {
  if (!confirm('Deseja baixar o arquivo de backup agora?')) return;
  // O endpoint /api/backup retorna o arquivo diretamente
  window.location.href = '/api/backup';
};

window.uploadRestore = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm(`ATENÇÃO: Você está prestes a restaurar o banco de dados usando o arquivo "${file.name}".\nIsso apagará irreversivelmente todas as vendas, alterações de produtos e mesas que ocorreram DEPOIS que este backup foi gerado.\n\nTem certeza absoluta que deseja prosseguir?`)) {
    event.target.value = ''; // reseta
    return;
  }

  const formData = new FormData();
  formData.append('dbfile', file);

  try {
    const res = await fetch('/api/restore', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      alert('Backup restaurado com sucesso! O sistema será recarregado.');
      window.location.reload();
    } else {
      const errText = await res.text();
      alert('Falha ao restaurar: ' + errText);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao tentar restaurar o backup.');
  } finally {
    event.target.value = ''; // reseta
  }
};


// --- Reserva de Mesa ---
const btnReservarMesa = document.getElementById('btn-reservar-mesa');
const modalReserva = document.getElementById('modal-reserva');
const btnSalvarReserva = document.getElementById('btn-salvar-reserva');
const btnCancelarReserva = document.getElementById('btn-cancelar-reserva');
const btnRemoverReserva = document.getElementById('btn-remover-reserva');

if (btnReservarMesa) {
  btnReservarMesa.onclick = () => {
    if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
    if (window.mesaAtual.isGroup) return alert('Não � possível reservar uma mesa que j� possui pedidos ativos.');
    
    // Check if already reserved
    if (window.mesaAtual.status === 'Reservada') {
      try {
        const obsObj = JSON.parse(window.mesaAtual.observacao || '{}');
        document.getElementById('reserva-cliente').value = obsObj.cliente || '';
        document.getElementById('reserva-data').value = obsObj.data || '';
        document.getElementById('reserva-obs').value = obsObj.obs || '';
      } catch (e) {
        document.getElementById('reserva-obs').value = window.mesaAtual.observacao || '';
      }
      btnRemoverReserva.style.display = 'block';
      document.getElementById('modal-reserva-titulo').innerText = 'Editar Reserva: ' + (window.mesaAtual.nome || window.mesaAtual.mesaName);
    } else {
      document.getElementById('reserva-cliente').value = '';
      document.getElementById('reserva-data').value = '';
      document.getElementById('reserva-obs').value = '';
      btnRemoverReserva.style.display = 'none';
      document.getElementById('modal-reserva-titulo').innerText = 'Nova Reserva: ' + (window.mesaAtual.nome || window.mesaAtual.mesaName);
    }
    
    modalReserva.style.display = 'flex';
  };
}

if (btnCancelarReserva) {
  btnCancelarReserva.onclick = () => {
    modalReserva.style.display = 'none';
  };
}

if (btnSalvarReserva) {
  btnSalvarReserva.onclick = () => {
    const cliente = document.getElementById('reserva-cliente').value;
    const data = document.getElementById('reserva-data').value;
    const obs = document.getElementById('reserva-obs').value;
    
    if (!cliente) return alert('Preencha o nome do cliente.');
    
    const obsObj = {
      cliente,
      data,
      obs
    };
    
    socket.emit('reservar_mesa', {
      mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName,
      observacao: JSON.stringify(obsObj)
    });
    
    modalReserva.style.display = 'none';
  };
}

if (btnRemoverReserva) {
  btnRemoverReserva.onclick = () => {
    if (!confirm('Tem certeza que deseja cancelar esta reserva e liberar a mesa?')) return;
    socket.emit('cancelar_reserva', {
      mesaName: window.mesaAtual.nome || window.mesaAtual.mesaName
    });
    modalReserva.style.display = 'none';
  };
}



// --- QR Code de Ponto ---
socket.on('update_ponto_token', (data) => {
  const img = document.getElementById('qr-ponto-img');
  if (img) {
    // Generate QR code using external API
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(data.url);
  }
});


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
         if(c.querySelector('.mesa-id').innerText === nomeMesa) {
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
             if(c.querySelector('.mesa-id').innerText === nomeMesa) c.click();
           });
           const btnAdic = document.getElementById('btn-adicionar-produtos');
           if(btnAdic) btnAdic.click();
         }, 500);
       }
    }, 200);
  });


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

// Initial Footer Sync
setTimeout(() => {
  const elUser = document.getElementById('status-user-name');
  if (elUser) {
        const creds = localStorage.getItem('chef_credentials');
        if (creds) {
            try {
                const parsed = JSON.parse(creds);
                window.loggedInUser = parsed.nome || parsed.usuario;
            } catch(e) {}
        } else {
            window.loggedInUser = null;
        }
        elUser.innerText = window.loggedInUser || 'Não logado';
    }
}, 500);


window.abrirCheckoutComandaModal = (comandaName) => {
  if (!window.mesaAtual) return alert('Selecione uma mesa primeiro.');
  
  window.modalComandaName = comandaName;
  const items = window.mesaAtual.items || [];
  window.modalComandaItems = items.filter(o => o.status !== 'Pago' && o.mesa_comanda === comandaName);
  window.modalSharedItems = items.filter(o => o.status !== 'Pago' && (!o.mesa_comanda || o.mesa_comanda.trim() === ''));
  
  // Set modal title
  const titleEl = document.getElementById('comanda-modal-title');
  if (titleEl) {
    titleEl.innerText = comandaName ? `Cobrar Comanda: ${comandaName}` : 'Cobrar Itens Compartilhados';
  }
  
  // Hide individual items section if checking out only shared items
  const itemsSection = document.getElementById('comanda-modal-items-section');
  if (itemsSection) {
    itemsSection.style.display = comandaName ? 'block' : 'none';
  }
  
  // Hide split-shared option if it's the shared items themselves
  const splitLabel = document.getElementById('comanda-modal-split-label');
  if (splitLabel) {
    splitLabel.style.display = comandaName ? 'flex' : 'none';
  }
  
  // Render individual comanda items
  const comandaItemsList = document.getElementById('comanda-modal-items');
  if (comandaItemsList) {
    if (window.modalComandaItems.length === 0) {
      comandaItemsList.innerHTML = '<div style="color:gray; text-align:center; padding: 10px;">Nenhum item individual pendente.</div>';
    } else {
      comandaItemsList.innerHTML = window.modalComandaItems.map(o => {
        const val = parseFloat(String(o.total).replace(',', '.'));
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f2f2f2; padding-bottom:4px;">
            <span>${o.quantity}x ${o.productEmoji || ''} ${o.productName}</span>
            <span style="font-weight:600; color:#555;">R$ ${val.toFixed(2).replace('.', ',')}</span>
          </div>
        `;
      }).join('');
    }
  }
  
  // Render shared items checkboxes
  const sharedList = document.getElementById('comanda-modal-shared-list');
  if (sharedList) {
    if (window.modalSharedItems.length === 0) {
      sharedList.innerHTML = '<div style="color:gray; text-align:center; padding: 10px;">Nenhum item compartilhado pendente.</div>';
    } else {
      sharedList.innerHTML = window.modalSharedItems.map(o => {
        const val = parseFloat(String(o.total).replace(',', '.'));
        return `
          <label style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:4px 0; cursor:pointer;">
            <span style="display:flex; align-items:center; gap:6px;">
              <input type="checkbox" class="comanda-modal-shared-chk" data-id="${o.id}" data-val="${val}" onchange="window.recalcComandaModal()">
              ${o.quantity}x ${o.productEmoji || ''} 	ext{o.productName}
            </span>
            <span style="font-weight:600; color:#fc4b15;">R$ ${val.toFixed(2).replace('.', ',')}</span>
          </label>
        `;
      }).join('');
    }
  }
  
  // Recalculate split share value
  const splitValueEl = document.getElementById('comanda-modal-split-value');
  const splitChk = document.getElementById('comanda-modal-split-shared');
  if (splitChk) splitChk.checked = false;
  
  if (splitValueEl) {
    if (comandaName) {
      // Find all unique comanda names in unpaid items
      const comandas = new Set(items.filter(o => o.status !== 'Pago' && o.mesa_comanda && o.mesa_comanda.trim() !== '').map(o => o.mesa_comanda.trim()));
      const numComandas = Math.max(1, comandas.size);
      const sharedTotal = window.modalSharedItems.reduce((acc, o) => acc + parseFloat(String(o.total).replace(',', '.')), 0);
      window.modalSplitShare = sharedTotal / numComandas;
      splitValueEl.innerText = `R$ ${window.modalSplitShare.toFixed(2).replace('.', ',')}`;
    } else {
      window.modalSplitShare = 0;
      splitValueEl.innerText = 'R$ 0,00';
    }
  }
  
  // Show modal
  const overlay = document.getElementById('comanda-checkout-overlay');
  if (overlay) overlay.style.display = 'flex';
  
  window.recalcComandaModal();
};

window.recalcComandaModal = () => {
  let subtotal = 0;
  
  // 1. Add individual items total if comandaName is set
  if (window.modalComandaName) {
    subtotal += window.modalComandaItems.reduce((acc, o) => acc + parseFloat(String(o.total).replace(',', '.')), 0);
  }
  
  // 2. Add split share if checked
  const splitChk = document.getElementById('comanda-modal-split-shared');
  if (splitChk && splitChk.checked) {
    subtotal += window.modalSplitShare || 0;
  }
  
  // 3. Add checked shared items
  document.querySelectorAll('.comanda-modal-shared-chk').forEach(chk => {
    if (chk.checked) {
      subtotal += parseFloat(chk.getAttribute('data-val')) || 0;
    }
  });
  
  // 4. Apply service fee if enabled on main screen
  const serviceCheckbox = document.getElementById('taxa-servico');
  const serviceApplied = serviceCheckbox && serviceCheckbox.checked;
  if (serviceApplied) {
    subtotal *= 1.1;
  }
  
  window.modalCheckoutTotal = subtotal;
  const totalEl = document.getElementById('comanda-modal-total');
  if (totalEl) {
    totalEl.innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
  }
};

window.finalizarComandaModal = () => {
  if (!window.mesaAtual || window.modalCheckoutTotal <= 0) {
    return alert('Não há valor a ser cobrado!');
  }
  
  const method = document.getElementById('comanda-modal-method').value;
  const mesaName = window.mesaAtual.nome || window.mesaAtual.mesaName;
  
  // Gather ids of items to be marked as Paid
  const pedidoIds = [];
  
  // Individual items
  if (window.modalComandaName) {
    window.modalComandaItems.forEach(o => pedidoIds.push(o.id));
  }
  
  // Checked shared items
  let checkedSharedVal = 0;
  document.querySelectorAll('.comanda-modal-shared-chk').forEach(chk => {
    if (chk.checked) {
      const id = parseInt(chk.getAttribute('data-id'), 10);
      pedidoIds.push(id);
      checkedSharedVal += parseFloat(chk.getAttribute('data-val'));
    }
  });
  
  const serviceCheckbox = document.getElementById('taxa-servico');
  const serviceApplied = serviceCheckbox && serviceCheckbox.checked;
  
  // Value corresponding to individual items + checked shared items
  const mainValue = (window.modalComandaName ? window.modalComandaItems.reduce((acc, o) => acc + parseFloat(String(o.total).replace(',', '.')), 0) : 0) + checkedSharedVal;
  const mainValueWithTax = serviceApplied ? mainValue * 1.1 : mainValue;
  
  // If we are paying some items by full, finalize them
  if (pedidoIds.length > 0) {
    socket.emit('finalizar_parcial_mesa', {
      mesaName: mesaName,
      pedidoIds: pedidoIds,
      payments: [{ metodo: method, valor: mainValueWithTax }]
    });
  }
  
  // If we split the shared items, register a partial payment for the split share portion
  const splitChk = document.getElementById('comanda-modal-split-shared');
  if (splitChk && splitChk.checked && window.modalSplitShare > 0) {
    const splitShareWithTax = serviceApplied ? window.modalSplitShare * 1.1 : window.modalSplitShare;
    
    // Register partial payment in background
    socket.emit('movimentacao_caixa', {
      tipo: 'Entrada',
      valor: splitShareWithTax,
      descricao: `Pgto Parcial (Racha Compartilhados - ${window.modalComandaName || 'Comanda'}): ${mesaName}`,
      forma_pagamento: method
    });
    
    socket.emit('pagamento_parcial_valor', {
      mesaName: mesaName,
      valor: splitShareWithTax,
      metodo: method,
      userName: 'Caixa'
    });
  }
  
  // Close modal
  document.getElementById('comanda-checkout-overlay').style.display = 'none';
  alert('Pagamento registrado com sucesso!');
};
