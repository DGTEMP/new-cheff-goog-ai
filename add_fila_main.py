import sys

fpath = r'c:\Users\computer\Desktop\chef cozinha\main.js'
with open(fpath, 'r', encoding='utf-8') as f:
    text = f.read()

end_mark = '// Hide unauthorized UI elements for non-manager/non-admin roles'
end_idx = text.find(end_mark)

module_code = """// --- MÓDULO DE FILA DE ESPERA DE CLIENTES PARA MESAS ---
window.filaEsperaDados = [];

window.abrirFilaEsperaModal = function () {
  const modal = document.getElementById('modal-fila-espera');
  if (modal) modal.style.display = 'flex';
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('get_fila_espera');
  }
};

window.adicionarClienteFilaEspera = function () {
  const inpNome = document.getElementById('input-fila-nome');
  const inpTel = document.getElementById('input-fila-telefone');
  const inpPessoas = document.getElementById('input-fila-pessoas');
  const inpPref = document.getElementById('input-fila-preferencia');
  const inpObs = document.getElementById('input-fila-obs');

  const nome = inpNome ? inpNome.value.trim() : '';
  if (!nome) return alert('Informe o nome do cliente.');

  const telefone = inpTel ? inpTel.value.trim() : '';
  const pessoas = inpPessoas ? parseInt(inpPessoas.value) || 2 : 2;
  const mesa_preferida = inpPref ? inpPref.value.trim() : '';
  const observacao = inpObs ? inpObs.value.trim() : '';

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('adicionar_fila_espera', {
      cliente_nome: nome,
      cliente_telefone: telefone,
      pessoas,
      mesa_preferida,
      observacao
    });
  }

  if (inpNome) inpNome.value = '';
  if (inpTel) inpTel.value = '';
  if (inpPref) inpPref.value = '';
  if (inpObs) inpObs.value = '';
};

window.removerClienteFilaEspera = function (id) {
  if (!confirm('Deseja remover este cliente da fila de espera?')) return;
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('remover_fila_espera', id);
  }
};

window.chamarClienteWhatsapp = function (nome, telefone, pessoas) {
  if (!telefone) {
    alert('Telefone do cliente não informado.');
    return;
  }
  const telLimpo = telefone.replace(/\D/g, '');
  const numCompleto = telLimpo.length <= 11 ? '55' + telLimpo : telLimpo;
  const texto = encodeURIComponent(`Olá ${nome}! Sua mesa (${pessoas} pessoas) no restaurante está pronta! Por favor, dirija-se à recepção.`);
  window.open(`https://wa.me/${numCompleto}?text=${texto}`, '_blank');
  
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('atualizar_status_fila_espera', { id, status: 'Notificado' });
  }
};

window.acomodarClienteFilaPrompt = function (id, nomeCliente) {
  const mesasLivres = (window.todasMesas || []).filter(m => m.status === 'Disponível' || m.status === 'Livre').map(m => m.nome || m.mesaName);
  let sugestaoMsg = mesasLivres.length > 0 ? `Mesas livres disponíveis: ${mesasLivres.join(', ')}` : 'Nenhuma mesa livre no momento.';
  const mesaName = prompt(`Informe o nome da mesa para acomodar ${nomeCliente}:\n(${sugestaoMsg})`, mesasLivres[0] || 'Mesa 1');
  if (!mesaName || !mesaName.trim()) return;

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('acomodar_cliente_fila', { id, mesaName: mesaName.trim() });
  }
};

function renderFilaEsperaTabela(rows) {
  window.filaEsperaDados = rows || [];
  const tbody = document.getElementById('tbody-fila-espera');
  const countEl = document.getElementById('info-fila-espera-count');

  if (countEl) countEl.innerText = window.filaEsperaDados.length;
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum cliente na fila de espera no momento.</td></tr>';
    return;
  }

  const agora = new Date();

  tbody.innerHTML = rows.map(r => {
    let minsEspera = 0;
    if (r.criado_em) {
      const dt = new Date(r.criado_em.includes('T') ? r.criado_em : r.criado_em.replace(' ', 'T'));
      if (!isNaN(dt.getTime())) minsEspera = Math.floor((agora - dt) / 60000);
    }
    minsEspera = Math.max(0, minsEspera);
    const badgeColor = minsEspera > 30 ? '#ef4444' : (minsEspera > 15 ? '#f59e0b' : '#3b82f6');
    const statusTag = r.status === 'Notificado' 
      ? `<span style="background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">Notificado</span>` 
      : `<span style="background:${badgeColor}22; color:${badgeColor}; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">${minsEspera} min</span>`;

    const prefObs = [r.mesa_preferida ? `Pref: ${r.mesa_preferida}` : '', r.observacao || ''].filter(Boolean).join(' - ') || '—';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-weight: bold; color: #1e293b;">
          ${r.cliente_nome}
          ${r.cliente_telefone ? `<br><span style="font-weight:normal; font-size:11.5px; color:#64748b;"><i class="ph ph-whatsapp-logo" style="color:#25d366;"></i> ${r.cliente_telefone}</span>` : ''}
        </td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: #d97706;">${r.pessoas || 2}p</td>
        <td style="padding: 10px;">${statusTag}</td>
        <td style="padding: 10px; font-size: 12px; color: #475569;">${prefObs}</td>
        <td style="padding: 10px; text-align: center;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button onclick="window.acomodarClienteFilaPrompt(${r.id}, '${r.cliente_nome.replace(/'/g, "\\'")}')" title="Acomodar na Mesa" style="background: #10b981; color: white; border: none; padding: 5px 9px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 4px;">
              <i class="ph ph-armchair"></i> Sentar
            </button>
            ${r.cliente_telefone ? `
              <button onclick="window.chamarClienteWhatsapp('${r.cliente_nome.replace(/'/g, "\\'")}', '${r.cliente_telefone}', ${r.pessoas || 2})" title="Chamar no WhatsApp" style="background: #25d366; color: white; border: none; padding: 5px 9px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 4px;">
                <i class="ph ph-whatsapp-logo"></i> Chamar
              </button>
            ` : ''}
            <button onclick="window.removerClienteFilaEspera(${r.id})" title="Remover da Fila" style="background: #cbd5e1; color: #334155; border: none; padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 11px;">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

if (typeof socket !== 'undefined' && socket) {
  socket.on('fila_espera_atualizada', (rows) => {
    renderFilaEsperaTabela(rows);
  });
}

"""

if end_idx != -1:
    new_text = text[:end_idx] + module_code + '\n\n' + text[end_idx:]
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('SUCCESS: Fila de espera module added to main.js')
else:
    print('ERROR: end_idx not found in main.js')
