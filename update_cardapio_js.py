import sys

fpath = r'c:\Users\computer\Desktop\chef cozinha\cardapio.html'
with open(fpath, 'r', encoding='utf-8') as f:
    text = f.read()

target = "const urlParams = new URLSearchParams(window.location.search);"

replacement = """const urlParams = new URLSearchParams(window.location.search);
    const isFilaModo = (urlParams.get('modo') === 'fila' || urlParams.get('fila') === 'true');
    let mesaNome = isFilaModo ? 'Fila de Espera' : (urlParams.get('mesa') || 'Mesa');

    setTimeout(() => {
      const badge = document.getElementById('mesa-badge');
      if (badge) {
        badge.innerText = isFilaModo ? '⏳ Fila de Espera' : mesaNome;
        if (isFilaModo) {
          badge.style.background = '#fffbeb';
          badge.style.color = '#d97706';
          badge.style.border = '1px solid #fde68a';
        }
      }
    }, 100);

    function checarStatusFilaCliente() {
      if (!crmPerfil || !crmPerfil.telefone) return;
      socket.emit('buscar_cliente_fila_telefone', crmPerfil.telefone, (res) => {
        const banner = document.getElementById('banner-fila-espera');
        if (!banner) return;
        banner.style.display = 'block';
        if (res && res.ok && res.item) {
          mesaNome = 'Fila - ' + (res.item.cliente_nome || crmPerfil.nome);
          document.getElementById('text-fila-status-titulo').innerText = `Olá, ${res.item.cliente_nome}!`;
          document.getElementById('text-fila-status-sub').innerText = `Aguardando mesa (${res.item.pessoas || 2} pessoas). Peça porções e bebidas enquanto aguarda!`;
          document.getElementById('badge-fila-posicao').innerText = `Posição: ${res.posicao}º de ${res.totalFila}`;
        } else {
          document.getElementById('text-fila-status-titulo').innerText = `Olá, ${crmPerfil.nome}!`;
          document.getElementById('text-fila-status-sub').innerText = `Você pode escolher porções e bebidas e chamar o garçom!`;
          document.getElementById('badge-fila-posicao').innerText = isFilaModo ? `Fila Digital` : `Mesa`;
        }
      });
    }

    window.chamarGarcomFilaGrande = function() {
      const nomeCliente = crmPerfil ? crmPerfil.nome : 'Cliente na Fila';
      socket.emit('chamar_garcom', {
        localName: mesaNome || ('Fila - ' + nomeCliente),
        productName: '🔔 Chamada de Atendimento na Fila de Espera',
        mensagem: `Garçom solicitado na Fila de Espera por ${nomeCliente}`
      });

      const btn = document.getElementById('btn-big-chamar-garcom-fila');
      if (btn) {
        btn.innerHTML = '<i class="ph ph-check-circle" style="font-size:20px;"></i> GARÇOM NOTIFICADO! AGUARDE...';
        btn.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
        setTimeout(() => {
          btn.innerHTML = '<i class="ph ph-bell-ringing" style="font-size:20px;"></i> 🔔 CHAMAR GARÇOM NA ESPERA';
          btn.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
        }, 4000);
      }
    };"""

if target in text:
    new_text = text.replace(target, replacement, 1)
    # Also hook checarStatusFilaCliente inside associarClienteMesa
    new_text = new_text.replace("associarClienteMesa();", "associarClienteMesa(); checarStatusFilaCliente();")
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("SUCCESS: Updated cardapio.html JS logic for Fila de Espera!")
else:
    print("ERROR: target string not found.")
