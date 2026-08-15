const fs = require('fs');

// --- 1. Patch server.js ---
let server = fs.readFileSync('server.js', 'utf8');

// Add DB migrations
const dbMigration = `
    db.run("CREATE TABLE IF NOT EXISTS cupons (codigo TEXT PRIMARY KEY, itens_json TEXT, usado INTEGER DEFAULT 0, data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP)");
    // Try adding new columns if they don't exist
    db.run("ALTER TABLE cupons ADD COLUMN validade TEXT", () => {});
    db.run("ALTER TABLE cupons ADD COLUMN dias_horarios_json TEXT", () => {});
    db.run("ALTER TABLE cupons ADD COLUMN valor_tipo TEXT", () => {});
    db.run("ALTER TABLE cupons ADD COLUMN valor REAL", () => {});
`;

server = server.replace(/CREATE TABLE IF NOT EXISTS cupons[^;]+;/, dbMigration);

// Update criar_cupom logic
const criarCupomLogic = `
  // -- CRIAR CUPOM --
  socket.on('criar_cupom', (data) => {
    const itensStr = JSON.stringify(data.itens);
    db.run(
      "INSERT INTO cupons (codigo, itens_json, usado, validade, dias_horarios_json, valor_tipo, valor) VALUES (?, ?, 0, ?, ?, ?, ?)", 
      [data.codigo, itensStr, data.validade, JSON.stringify(data.dias_horarios), data.valor_tipo, data.valor], 
      function(err) {
      if (err) {
         socket.emit('cupom_criado_error', 'Código já existe ou erro no banco.');
      } else {
         socket.emit('cupom_criado_sucesso', { codigo: data.codigo, titulo: data.titulo });
      }
    });
  });
`;

server = server.replace(/\/\/ -- CRIAR CUPOM --[\s\S]*?\}\);\s*\}\);\s*\}\);/, criarCupomLogic);

// Update validar_cupom logic
const validarCupomLogic = `
  socket.on('validar_cupom', ({ mesaName, codigo, userName }) => {
    db.get(\`SELECT * FROM cupons WHERE codigo = ?\`, [codigo], (err, cupom) => {
      if (err || !cupom) return socket.emit('cupom_invalido', { error: 'Cupom não encontrado ou código inválido.' });
      if (cupom.usado === 1) return socket.emit('cupom_invalido', { error: 'Este cupom já foi resgatado!' });

      // Validar Data
      const agora = new Date();
      if (cupom.validade) {
         const dataValidade = new Date(cupom.validade + "T23:59:59");
         if (agora > dataValidade) return socket.emit('cupom_invalido', { error: 'Cupom expirado.' });
      }

      // Validar Dias/Horários
      if (cupom.dias_horarios_json) {
         try {
             const dh = JSON.parse(cupom.dias_horarios_json);
             const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
             const hojeDia = diasSemana[agora.getDay()];
             
             if (dh && dh[hojeDia]) {
                 const configHoje = dh[hojeDia];
                 if (!configHoje.ativo) return socket.emit('cupom_invalido', { error: 'Cupom não é válido para o dia de hoje (' + hojeDia + ').' });
                 
                 const horaAtualStr = agora.getHours().toString().padStart(2,'0') + ':' + agora.getMinutes().toString().padStart(2,'0');
                 if (configHoje.inicio && horaAtualStr < configHoje.inicio) return socket.emit('cupom_invalido', { error: 'Cupom só é válido a partir de ' + configHoje.inicio });
                 if (configHoje.fim && horaAtualStr > configHoje.fim) return socket.emit('cupom_invalido', { error: 'Cupom era válido apenas até as ' + configHoje.fim });
             }
         } catch(e) {}
      }

      // Cupom válido, marcar como usado
      db.run(\`UPDATE cupons SET usado = 1 WHERE codigo = ?\`, [codigo], (err) => {
        if (err) return console.error(err);

        try {
          const itens = JSON.parse(cupom.itens_json);
          const timeStr = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
          
          let hasInserted = false;
          
          // Inserir itens
          itens.forEach((item) => {
            db.run(
              \`INSERT INTO pedidos (productName, productEmoji, quantity, total, status, mesaName, userName, time, sector) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
              [item.nome + ' (Resgate)', item.emoji || '🎁', item.quantity || 1, '0,00', 'Em espera', mesaName, userName || 'Garçom', timeStr, item.sector || 'Bar']
            );
            hasInserted = true;
          });

          // Inserir lógica financeira
          if (cupom.valor_tipo === 'desconto_fixo' && cupom.valor > 0) {
              db.run(
                \`INSERT INTO pedidos (productName, productEmoji, quantity, total, status, mesaName, userName, time, sector) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
                ['Desconto Promocional', '🏷️', 1, '-' + cupom.valor.toFixed(2).replace('.',','), 'Pronto', mesaName, userName || 'Garçom', timeStr, 'Caixa']
              );
              hasInserted = true;
          } else if (cupom.valor_tipo === 'preco_fixo' && cupom.valor > 0) {
              db.run(
                \`INSERT INTO pedidos (productName, productEmoji, quantity, total, status, mesaName, userName, time, sector) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
                ['Cobrança de Combo/Cupom', '💲', 1, cupom.valor.toFixed(2).replace('.',','), 'Pronto', mesaName, userName || 'Garçom', timeStr, 'Caixa']
              );
              hasInserted = true;
          }

          if (hasInserted) {
              io.emit('pedidos_atualizados');
              db.all("SELECT * FROM mesas", (e, r) => io.emit('mesas_atualizadas', r || []));
          }
          
          socket.emit('cupom_sucesso', { mensagem: 'Cupom aplicado com sucesso!' });
        } catch (error) {
          socket.emit('cupom_invalido', { error: 'Erro ao ler os itens do cupom.' });
        }
      });
    });
  });
`;

server = server.replace(/socket\.on\('validar_cupom'[\s\S]*?socket\.emit\('cupom_invalido', \{ error: 'Erro ao ler os itens do cupom\.' \}\);\s*\}\s*\}\);\s*\}\);\s*\}\);/, validarCupomLogic);

fs.writeFileSync('server.js', server, 'utf8');
console.log("Server patched.");

// --- 2. Patch configuracoes.html ---
let html = fs.readFileSync('configuracoes.html', 'utf8');

const advancedUI = `
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
              <h4 style="margin-top:0; margin-bottom: 10px; color: #166534;"><i class="ph ph-qr-code"></i> Gerador de Cupons QR Code (Combos)</h4>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                 <div>
                    <label style="font-size:12px; font-weight:bold; color:#166534;">Código do Cupom</label>
                    <input type="text" id="admin-cupom-codigo" placeholder="Deixe vazio para aleatório" style="width:100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                 </div>
                 <div>
                    <label style="font-size:12px; font-weight:bold; color:#166534;">Data de Validade (Opcional)</label>
                    <input type="date" id="admin-cupom-validade" style="width:100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                 </div>
              </div>

              <!-- ITENS DO COMBO -->
              <div style="background: white; border: 1px solid #ccc; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                  <h5 style="margin: 0 0 10px 0; font-size: 14px;">Itens Inclusos (Combo)</h5>
                  <div id="cupom-itens-list" style="margin-bottom: 10px; display:flex; flex-direction:column; gap:5px;">
                     <div style="font-size: 12px; color: #666; font-style: italic;" id="cupom-no-items">Nenhum item adicionado. Use abaixo para adicionar. (Pode deixar vazio se for apenas um cupom de Desconto).</div>
                  </div>
                  
                  <div style="display: flex; gap: 10px; align-items: center;">
                      <select id="admin-cupom-produto-sel" style="flex:1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                         <option value="">-- Carregando produtos... --</option>
                      </select>
                      <input type="number" id="admin-cupom-qtd" value="1" min="1" style="width: 60px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                      <button class="btn-action" style="padding: 8px; font-size:12px;" onclick="window.addCupomItem()">Adicionar</button>
                  </div>
              </div>

              <!-- VALOR -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                 <div>
                    <label style="font-size:12px; font-weight:bold; color:#166534;">Regra Financeira na Mesa</label>
                    <select id="admin-cupom-valor-tipo" style="width:100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                       <option value="gratuito">Cupom 100% Gratuito</option>
                       <option value="preco_fixo">Cobrar Preço Fixo pelo Combo</option>
                       <option value="desconto_fixo">Dar Desconto Fixo no final da Mesa</option>
                    </select>
                 </div>
                 <div>
                    <label style="font-size:12px; font-weight:bold; color:#166534;">Valor (R$)</label>
                    <input type="number" id="admin-cupom-valor" placeholder="Ex: 15.00" step="0.01" style="width:100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                 </div>
              </div>

              <!-- DIAS E HORÁRIOS -->
              <div style="background: white; border: 1px solid #ccc; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                  <h5 style="margin: 0 0 10px 0; font-size: 14px;">Restrição de Dias e Horários</h5>
                  <div id="cupom-dias-grid" style="display: flex; flex-direction: column; gap: 8px;">
                      <!-- JS vai popular os 7 dias aqui -->
                  </div>
              </div>

              <button class="btn-action" style="width: 100%; background: #22c55e; color: white; border: none; padding: 15px; font-weight: bold; border-radius: 6px; font-size: 16px; justify-content:center;" onclick="window.gerarCupomQrAvançado()">
                <i class="ph ph-qr-code"></i> CRIAR CUPOM E GERAR QR
              </button>
              
              <div id="cupom-qr-result" style="margin-top: 15px; display: none; flex-direction: column; align-items: center; background: white; padding: 20px; border-radius: 8px; border: 2px dashed #ccc;">
                  <h3 style="margin:0 0 10px 0; color: #333;" id="cupom-qr-title"></h3>
                  <img id="cupom-qr-image" src="" alt="QR Code" style="width: 200px; height: 200px; margin-bottom: 15px;">
                  <p style="font-size: 24px; font-weight: bold; margin: 0 0 15px 0; letter-spacing: 2px; color: #fc4b15;" id="cupom-qr-code-text"></p>
                  <button onclick="window.printCupomAvançado()" style="padding: 10px 20px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;"><i class="ph ph-printer"></i> Imprimir Cupom</button>
              </div>
            </div>
`;

// Replace the old Gerador block completely
html = html.replace(/<div style="background: #f0fdf4[\s\S]*?Gerador de Cupons QR Code[\s\S]*?window\.printCupom\(\)[\s\S]*?<\/div>\s*<\/div>/, advancedUI);
fs.writeFileSync('configuracoes.html', html, 'utf8');
console.log("HTML patched.");
