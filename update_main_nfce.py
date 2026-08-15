import sys

fpath = r'c:\Users\computer\Desktop\chef cozinha\main.js'
with open(fpath, 'r', encoding='utf-8') as f:
    text = f.read()

start_mark = '// --- MÓDULO FISCAL NFC-E CLIENTE ---'
end_mark = '// Hide unauthorized UI elements for non-manager/non-admin roles'

start_idx = text.find(start_mark)
if start_idx == -1:
    start_mark = '// --- MÃ“DULO FISCAL NFC-E CLIENTE ---'
    start_idx = text.find(start_mark)

end_idx = text.find(end_mark)

print('start_idx:', start_idx, 'end_idx:', end_idx)

clean_module = """// --- MÓDULO FISCAL NFC-E CLIENTE ---
window.todasNotasNfce = [];

window.abrirModalNfce = function () {
  const modal = document.getElementById('nfce-overlay');
  if (modal) modal.style.display = 'flex';
  window.carregarNotasNfce();
};

window.carregarNotasNfce = function () {
  let creds = {};
  try { creds = JSON.parse(localStorage.getItem('chef_app_creds') || '{}'); } catch (e) { }
  const role = (creds.cargo || '').toLowerCase();
  const isAdmin = ['admin', 'administrador', 'gerente'].includes(role);
  const opts = isAdmin ? { period: 'semana' } : {};
  const limit = isAdmin ? 300 : 50;

  if (typeof socket !== 'undefined' && socket) {
    socket.emit('get_nfce_notas', opts);
  } else {
    fetch('/api/nfce/notas?limit=' + limit)
      .then(r => r.json())
      .then(data => {
        window.todasNotasNfce = data || [];
        window.filtrarNotasNfce();
      })
      .catch(e => console.error('Erro ao buscar NFC-e:', e));
  }
};

if (typeof socket !== 'undefined' && socket) {
  socket.on('nfce_lista_atualizada', (rows) => {
    window.todasNotasNfce = rows || [];
    window.filtrarNotasNfce();
  });

  socket.on('nfce_emitida_sucesso', (res) => {
    if (res && res.ok) {
      const printBtn = document.createElement('button');
      printBtn.innerHTML = '<i class="ph ph-printer"></i> Imprimir DANFE NFC-e';
      printBtn.style.cssText = 'padding: 10px 16px; background: #27ae60; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; font-size: 13px; display: flex; align-items: center; gap: 6px;';
      printBtn.onclick = () => window.imprimirDanfeNfce(res.notaId);

      const popup = document.createElement('div');
      popup.style.cssText = 'position: fixed; bottom: 25px; right: 25px; background: white; border-left: 6px solid #27ae60; border-radius: 12px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); z-index: 100000; font-family: sans-serif; max-width: 380px; animation: slideIn 0.3s ease;';
      popup.innerHTML = '<h4 style="margin:0 0 8px 0; color:#1e293b; font-size:16px;">✅ NFC-e Emitida!</h4><p style="margin:0; font-size:14px; color:#475569;">A Nota Fiscal foi autorizada pela SEFAZ.</p>';
      popup.appendChild(printBtn);
      document.body.appendChild(popup);

      setTimeout(() => popup.remove(), 10000);
    }
  });
}

window.filtrarNotasNfce = function () {
  const tbody = document.getElementById('nfce-tabela-body');
  const searchInput = document.getElementById('nfce-search-input');
  const statusFilter = document.getElementById('nfce-status-filter');

  if (!tbody) return;

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const statusSel = statusFilter ? statusFilter.value : 'TODOS';

  const filtradas = (window.todasNotasNfce || []).filter(n => {
    if (statusSel !== 'TODOS' && n.status !== statusSel) return false;
    if (query) {
      const matchNum = String(n.numero_nota || '').includes(query);
      const matchCpf = (n.cpf_cnpj || '').toLowerCase().includes(query);
      const matchMesa = (n.localName || '').toLowerCase().includes(query);
      const matchChave = (n.chave_acesso || '').toLowerCase().includes(query);
      const matchCliente = (n.cliente_nome || '').toLowerCase().includes(query);
      return matchNum || matchCpf || matchMesa || matchChave || matchCliente;
    }
    return true;
  });

  let totalEmitido = 0;
  let countAut = 0;
  let countCanc = 0;

  (window.todasNotasNfce || []).forEach(n => {
    if (n.status === 'Autorizada') {
      totalEmitido += parseFloat(n.valor_total || 0);
      countAut++;
    } else if (n.status === 'Cancelada') {
      countCanc++;
    }
  });

  const elTot = document.getElementById('nfce-total-valor');
  const elAut = document.getElementById('nfce-count-autorizadas');
  const elCanc = document.getElementById('nfce-count-canceladas');

  if (elTot) elTot.innerText = 'R$ ' + totalEmitido.toFixed(2).replace('.', ',');
  if (elAut) elAut.innerText = countAut;
  if (elCanc) elCanc.innerText = countCanc;

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #888;">Nenhuma Nota Fiscal (NFC-e) encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = filtradas.map(n => {
    const dataFmt = n.created_at ? new Date(n.created_at).toLocaleString('pt-BR') : '---';
    const cpfFmt = n.cpf_cnpj ? n.cpf_cnpj : 'Consumidor Não Identificado';
    const valFmt = 'R$ ' + parseFloat(n.valor_total || 0).toFixed(2).replace('.', ',');
    const badgeColor = n.status === 'Autorizada' ? '#27ae60' : (n.status === 'Cancelada' ? '#eb5757' : '#f39c12');

    return `
      <tr style="border-bottom: 1px solid #edf2f7;">
        <td style="padding: 10px; font-weight: bold;">Nº ${String(n.numero_nota).padStart(6, '0')}</td>
        <td style="padding: 10px; font-size: 12px; color: #555;">${dataFmt}</td>
        <td style="padding: 10px; font-weight: 500;">${n.localName || 'Mesa'}</td>
        <td style="padding: 10px; font-size: 12px; color: #333;">${cpfFmt}</td>
        <td style="padding: 10px; font-weight: bold; color: #2d3748;">${valFmt}</td>
        <td style="padding: 10px; text-align: center;">
          <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">
            ${n.status || 'Autorizada'}
          </span>
        </td>
        <td style="padding: 10px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
            <button onclick="window.imprimirDanfeNfce(${n.id})" title="Imprimir DANFE" style="background: #27ae60; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <i class="ph ph-printer"></i> DANFE
            </button>
            <button onclick="window.baixarXmlNfce(${n.id})" title="Download XML" style="background: #2563eb; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <i class="ph ph-file-code"></i> XML
            </button>
            ${n.status === 'Autorizada' ? `
              <button onclick="window.cancelarNotaNfce(${n.id}, ${n.numero_nota})" title="Cancelar Nota" style="background: #eb5757; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <i class="ph ph-x"></i> Cancelar
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

window.imprimirDanfeNfce = function(id) {
  if (!id) return;
  window.open('/api/nfce/danfe/' + id, '_blank', 'width=420,height=650,scrollbars=yes');
};

window.baixarXmlNfce = function(id) {
  if (!id) return;
  window.open('/api/nfce/xml/' + id, '_blank');
};

window.cancelarNotaNfce = function(id, numero_nota) {
  const notaMsg = numero_nota ? `Nº ${numero_nota}` : `ID ${id}`;
  const motivo = prompt(`Informe o motivo do cancelamento da NFC-e (${notaMsg}) - mínimo 15 caracteres:`);
  if (!motivo || motivo.trim().length < 15) {
    alert('O motivo do cancelamento deve ter no mínimo 15 caracteres.');
    return;
  }
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('cancelar_nfce', { id, motivo: motivo.trim() }, (res) => {
      if (res && res.ok) {
        alert('NFC-e cancelada com sucesso!');
        if (typeof window.carregarNotasNfce === 'function') {
          window.carregarNotasNfce();
        }
      } else {
        alert('Erro ao cancelar NFC-e: ' + (res?.error || 'Erro desconhecido.'));
      }
    });
  }
};\n\n\n"""

if start_idx != -1 and end_idx != -1:
    new_text = text[:start_idx] + clean_module + text[end_idx:]
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("SUCCESS: Cleaned up main.js NFC-e module!")
