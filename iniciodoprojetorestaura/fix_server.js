const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
code = code.replace(/\r\n/g, '\n');

const oldText = `          });
        pedidoId,
        mesa,
        produto,
        mensagem: \`Garçom vai oferecer entrada para Mesa \${mesa}. Cozinha: preparar "\${produto}" em paralelo!\`
      });
    } else {
      iaState.manobrasAtivas.set(chaveManobra, { timestamp: Date.now(), status: 'recusada' });
    }
  });
});`;

const newText = `          });
        }
      } else if (resposta.includes('informar') || resposta.includes('atraso')) {
        // Apenas marcar como cliente informado
        if (pedidoId) {
          io.emit('ia_pedido_especial', {
            pedidoId,
            tipo: 'informado',
            cor: '#3b82f6',
            urgencia: 'media',
            mensagem: \`CLIENTE INFORMADO\`
          });
        }
      }
    }
  });

  // ── MANOBRA: Caixa confirma solicitação de entrada ao garçom ──
  socket.on('ia_manobra_confirmar', (data) => {
    const { pedidoId, mesa, produto, minutos, acao } = data || {};
    const chaveManobra = \`manobra_\${pedidoId}\`;

    if (acao === 'solicitar_entrada') {
      io.emit('ia_manobra_aceita', {
        tipo: 'manobra_aceita',
        pedidoId,
        mesa,
        produto,
        minutos,
        mensagem: \`Oferecer entrada cortesia para Mesa \${mesa}. Cliente aguardando "\${produto}" há \${minutos}min.\`,
        opcoes: ['Vou oferecer entrada', 'Cliente recusou']
      });

      iaState.manobrasAtivas.set(chaveManobra, { timestamp: Date.now(), status: 'encaminhada' });
    }

    if (acao === 'informar_cliente') {
      io.emit('ia_pedido_especial', {
        pedidoId,
        tipo: 'informado',
        cor: '#3b82f6',
        urgencia: 'media',
        mensagem: \`CLIENTE INFORMADO - \${minutos}min de espera\`
      });
      iaState.manobrasAtivas.set(chaveManobra, { timestamp: Date.now(), status: 'informado' });
    }
  });

  // ── MANOBRA: Garçom confirma que vai oferecer entrada ──
  socket.on('ia_manobra_executar', (data) => {
    const { pedidoId, mesa, produto, resposta } = data || {};
    const chaveManobra = \`manobra_\${pedidoId}\`;

    if (resposta === 'sim') {
      io.emit('ia_pedido_especial', {
        pedidoId,
        tipo: 'manobra',
        cor: '#ff6b35',
        urgencia: 'manobra_ativa',
        mensagem: \`MANOBRA - preparar em paralelo\`
      });

      iaState.manobrasAtivas.set(chaveManobra, { timestamp: Date.now(), status: 'executada' });

      io.emit('ia_manobra_executada', {
        pedidoId,
        mesa,
        produto,
        mensagem: \`Garçom vai oferecer entrada para Mesa \${mesa}. Cozinha: preparar "\${produto}" em paralelo!\`
      });
    } else {
      iaState.manobrasAtivas.set(chaveManobra, { timestamp: Date.now(), status: 'recusada' });
    }
  });`;

if (code.includes(oldText)) {
  code = code.replace(oldText, newText);
  fs.writeFileSync('server.js', code);
  console.log('Fixed successfully');
} else {
  console.log('oldText not found in server.js');
}
