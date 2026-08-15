const fs = require('fs');

const rhScript = `
// --- RH / FOLHA LOGIC ---
socket.on('rh_data', ({ vales, pontos }) => {
  const vList = document.getElementById('admin-rh-vales-list');
  const pList = document.getElementById('admin-rh-pontos-list');
  if(!vList || !pList) return;

  // Render Vales
  let vHtml = '';
  if(vales.length === 0) {
    vHtml = '<tr><td colspan="5" style="padding:10px; text-align:center; color:#999;">Nenhum vale solicitado.</td></tr>';
  } else {
    vales.forEach(v => {
      let statusColor = v.status === 'Aprovado' ? 'green' : (v.status === 'Recusado' ? 'red' : 'orange');
      let acoes = v.status === 'Pendente' 
        ? \`<button onclick="aprovarVale(\${v.id})" style="padding:5px 10px; background:#3ab55b; color:white; border:none; border-radius:4px; cursor:pointer;">Aprovar</button>
           <button onclick="recusarVale(\${v.id})" style="padding:5px 10px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer; margin-left:5px;">Recusar</button>\`
        : \`<span style="color:#999; font-size:12px;">\${v.status} em \${new Date(v.data_aprovacao || v.data_pedido).toLocaleDateString()}</span>\`;
      
      vHtml += \`
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding:10px;">\${new Date(v.data_pedido).toLocaleDateString()}</td>
          <td style="padding:10px;">\${v.funcionario_nome || 'Desconhecido'}</td>
          <td style="padding:10px; font-weight:bold;">R$ \${v.valor.toFixed(2).replace('.',',')}</td>
          <td style="padding:10px; color:\${statusColor};">\${v.status}</td>
          <td style="padding:10px;">\${acoes}</td>
        </tr>
      \`;
    });
  }
  vList.innerHTML = vHtml;

  // Render Pontos (Folha)
  let pHtml = '';
  if(pontos.length === 0) {
    pHtml = '<tr><td colspan="5" style="padding:10px; text-align:center; color:#999;">Nenhum turno registrado.</td></tr>';
  } else {
    pontos.forEach(p => {
      let valorPagoStr = p.pago ? \`<span style="color:green; font-weight:bold;">PAGO</span>\` : \`<span style="color:red; font-weight:bold;">PENDENTE</span>\`;
      let acoes = p.pago 
        ? \`-\`
        : \`<button onclick="pagarPonto(\${p.id})" style="padding:5px 10px; background:#3ab55b; color:white; border:none; border-radius:4px; cursor:pointer;">Marcar Pago</button>\`;
      
      pHtml += \`
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding:10px;">\${new Date(p.data).toLocaleDateString()}</td>
          <td style="padding:10px;">\${p.funcionario_nome || 'Desconhecido'}</td>
          <td style="padding:10px;">\${(p.total_horas || 0).toFixed(2)}h</td>
          <td style="padding:10px; font-weight:bold;">R$ \${(p.valor_pagar || 0).toFixed(2).replace('.',',')} <br>\${valorPagoStr}</td>
          <td style="padding:10px;">\${acoes}</td>
        </tr>
      \`;
    });
  }
  pList.innerHTML = pHtml;
});

socket.on('rh_update', () => {
  socket.emit('get_rh_data');
});

window.aprovarVale = function(id) {
  if(confirm("Confirmar aprovação do vale? O valor será lançado como saída no caixa atual.")) {
    socket.emit('aprovar_vale', id);
  }
};

window.recusarVale = function(id) {
  if(confirm("Deseja recusar esta solicitação?")) {
    socket.emit('recusar_vale', id);
  }
};

window.pagarPonto = function(id) {
  if(confirm("Marcar este turno como pago?")) {
    socket.emit('pagar_ponto', id);
  }
};

// Quando clicar na tab RH, recarregar os dados
document.addEventListener('click', (e) => {
  if(e.target.closest('.admin-tab-btn') && e.target.closest('.admin-tab-btn').getAttribute('data-tab') === 'rh') {
    socket.emit('get_rh_data');
  }
});

// Pedir os dados no init se a tab rh estiver aberta ou só pedir geral
socket.emit('get_rh_data');
`;

let content = fs.readFileSync('configuracoes.js', 'utf8');
if (!content.includes('get_rh_data')) {
  fs.appendFileSync('configuracoes.js', rhScript);
  console.log("RH script appended to configuracoes.js");
} else {
  console.log("rh script already exists in configuracoes.js");
}
