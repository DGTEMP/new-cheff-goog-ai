const fs = require('fs');

let code = `
// --- ADMIN RH ENDPOINTS ---
io.on('connection', (socket) => {
  socket.on('get_rh_data', () => {
    // Busca vales e pontos cruzando com funcionários
    const valesQuery = "SELECT v.*, f.nome as funcionario_nome FROM vales v JOIN funcionarios f ON v.funcionario_id = f.id ORDER BY v.data_pedido DESC";
    const pontosQuery = "SELECT p.*, f.nome as funcionario_nome FROM pontos p JOIN funcionarios f ON p.funcionario_id = f.id ORDER BY p.entrada DESC";
    
    db.all(valesQuery, (errV, vales) => {
      db.all(pontosQuery, (errP, pontos) => {
        socket.emit('rh_data', { vales: vales || [], pontos: pontos || [] });
      });
    });
  });

  socket.on('aprovar_vale', (valeId) => {
    db.get("SELECT * FROM vales WHERE id = ?", [valeId], (err, vale) => {
      if(vale && vale.status === 'Pendente') {
        db.run("UPDATE vales SET status = 'Aprovado', data_aprovacao = CURRENT_TIMESTAMP WHERE id = ?", [valeId], (errU) => {
          if(!errU) {
            // Gerar saída no caixa
            db.get("SELECT id FROM turnos_caixa WHERE status = 'Aberto' ORDER BY id DESC LIMIT 1", (errC, turno) => {
              if (turno) {
                db.run(
                  "INSERT INTO movimentacoes (turno_id, tipo, valor, descricao, data, forma_pagamento) VALUES (?, 'saida', ?, ?, CURRENT_TIMESTAMP, 'Dinheiro')",
                  [turno.id, vale.valor, "Adiantamento/Vale - Func. ID " + vale.funcionario_id]
                );
              }
            });
            // Emit update to all
            io.emit('rh_update');
            io.emit('vale_solicitado_success'); // To trigger refresh on employee panel
          }
        });
      }
    });
  });

  socket.on('recusar_vale', (valeId) => {
    db.run("UPDATE vales SET status = 'Recusado' WHERE id = ?", [valeId], (err) => {
      if(!err) {
        io.emit('rh_update');
        io.emit('vale_solicitado_success');
      }
    });
  });

  socket.on('pagar_ponto', (pontoId) => {
    db.run("UPDATE pontos SET pago = 1 WHERE id = ?", [pontoId], (err) => {
      if(!err) {
        io.emit('rh_update');
        io.emit('ponto_registrado', { acao: 'pagamento' }); // to trigger refresh if needed
      }
    });
  });
});
`;

let content = fs.readFileSync('server.js', 'utf8');
if (!content.includes('get_rh_data')) {
  // Find server.listen
  const idx = content.lastIndexOf('server.listen(');
  if (idx !== -1) {
    content = content.slice(0, idx) + code + '\n' + content.slice(idx);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("RH endpoints injetados no server.js!");
  }
} else {
  console.log("Já existe get_rh_data.");
}
