
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

document.getElementById('menu-abrir-caixa').onclick = () => document.getElementById('btn-abrir-caixa').click();
document.getElementById('menu-fechar-caixa').onclick = () => document.getElementById('btn-fechar-caixa').click();
document.getElementById('menu-cadastro').onclick = () => { document.getElementById('admin-overlay').style.display='flex'; };
document.getElementById('menu-configuracoes').onclick = () => { document.getElementById('admin-overlay').style.display='flex'; };
document.getElementById('menu-ajuda').onclick = () => alert('Sistema GrandChef Cozinha\nVersão 1.0\nAtalhos:\nF5 - Atualizar\nObrigado por usar!');

// --- RELATORIOS OVERLAY ---
const relatoriosOverlay = document.getElementById('relatorios-overlay');
document.getElementById('menu-relatorios').onclick = () => {
  relatoriosOverlay.style.display = 'flex';
  socket.emit('get_relatorios');
};
document.getElementById('btn-fechar-relatorios').onclick = () => relatoriosOverlay.style.display = 'none';

socket.on('relatorios_atualizados', (data) => {
  document.getElementById('relatorios-total-geral').innerText = 'R$ ' + (data.total || 0).toFixed(2).replace('.', ',');
  document.getElementById('relatorios-produtos-list').innerHTML = data.produtos.map(p => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${p.productName}</td>
      <td style="padding: 10px;">${p.qtd}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(p.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
  document.getElementById('relatorios-garcons-list').innerHTML = data.garcons.map(g => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${g.userName}</td>
      <td style="padding: 10px; color: #3ab55b; font-weight: bold;">R$ ${(g.total || 0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
});

// --- FINANCEIRO OVERLAY ---
const financeiroOverlay = document.getElementById('financeiro-overlay');
document.getElementById('menu-financeiro').onclick = () => {
  financeiroOverlay.style.display = 'flex';
  socket.emit('get_financeiro');
};
document.getElementById('btn-fechar-financeiro').onclick = () => financeiroOverlay.style.display = 'none';

document.getElementById('btn-financeiro-add-despesa').onclick = () => {
  const desc = document.getElementById('financeiro-despesa-desc').value;
  const val = parseFloat(document.getElementById('financeiro-despesa-valor').value);
  if(!desc || !val) return alert('Preencha descrição e valor!');
  socket.emit('add_despesa', { valor: val, descricao: desc });
  document.getElementById('financeiro-despesa-desc').value = '';
  document.getElementById('financeiro-despesa-valor').value = '';
};

socket.on('financeiro_atualizado', (rows) => {
  document.getElementById('financeiro-extrato-list').innerHTML = rows.map(r => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px;">${new Date(r.data).toLocaleString('pt-BR')}</td>
      <td style="padding: 10px;">${r.tipo === 'Entrada' ? '<span style="color:#3ab55b; font-weight:bold;">Entrada</span>' : '<span style="color:#eb5757; font-weight:bold;">Saída</span>'}</td>
      <td style="padding: 10px;">${r.descricao}</td>
      <td style="padding: 10px;">${r.forma_pagamento}</td>
      <td style="padding: 10px; text-align: right; font-weight:bold; color: ${r.tipo === 'Entrada' ? '#3ab55b' : '#eb5757'}">R$ ${(r.valor||0).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
});
