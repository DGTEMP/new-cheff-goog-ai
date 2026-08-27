/**
 * Backend do Módulo de Pesagem Automática & Autoatendimento Buffet
 */
const fs = require('fs');
const path = require('path');

module.exports = function ({ app, db, io, log }) {
  log('Módulo de Pesagem Automática & Buffet inicializado com sucesso.');

  const configFile = path.join(__dirname, 'config.json');

  function carregarConfig() {
    let padrao = {
      precoKg: 69.90,
      precoLivre: 35.00,
      taraPratoKg: 0.450,
      modoPadrao: 'peso', // 'peso' | 'livre' | 'hibrido'
      autoImprimirTicket: true,
      exigirQrComanda: false,
      nomeProdutoBalanca: 'Buffet por Quilo',
      nomeProdutoLivre: 'Buffet Livre'
    };
    if (fs.existsSync(configFile)) {
      try {
        const salvos = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        return Object.assign(padrao, salvos);
      } catch (e) {}
    }
    return padrao;
  }

  function salvarConfig(cfg) {
    fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf8');
  }

  // 1. Obter configurações de pesagem
  app.get('/api/modulo/pesagem-selfservice/config', (req, res) => {
    try {
      res.json({ sucesso: true, config: carregarConfig() });
    } catch (e) {
      res.status(500).json({ sucesso: false, error: e.message });
    }
  });

  // 2. Salvar configurações de pesagem
  app.post('/api/modulo/pesagem-selfservice/config', (req, res) => {
    try {
      const cfg = carregarConfig();
      if (req.body.precoKg !== undefined) cfg.precoKg = parseFloat(req.body.precoKg) || 0;
      if (req.body.precoLivre !== undefined) cfg.precoLivre = parseFloat(req.body.precoLivre) || 0;
      if (req.body.taraPratoKg !== undefined) cfg.taraPratoKg = parseFloat(req.body.taraPratoKg) || 0;
      if (req.body.modoPadrao !== undefined) cfg.modoPadrao = req.body.modoPadrao;
      if (req.body.autoImprimirTicket !== undefined) cfg.autoImprimirTicket = !!req.body.autoImprimirTicket;
      if (req.body.exigirQrComanda !== undefined) cfg.exigirQrComanda = !!req.body.exigirQrComanda;

      salvarConfig(cfg);
      log(`Configurações de pesagem atualizadas: R$ ${cfg.precoKg}/kg | Livre R$ ${cfg.precoLivre}`);
      res.json({ sucesso: true, config: cfg });
    } catch (e) {
      res.status(500).json({ sucesso: false, error: e.message });
    }
  });

  // 3. Registrar Pesagem (por Balança Serial/USB, Totem ou Simulação)
  app.post('/api/modulo/pesagem-selfservice/pesar', (req, res) => {
    try {
      const { pesoBruto, modo, comandaId, mesaId, clienteNome } = req.body;
      const cfg = carregarConfig();

      let pesoLiquido = 0;
      let valorTotal = 0;
      let descricaoItem = '';

      if (modo === 'livre') {
        valorTotal = cfg.precoLivre;
        descricaoItem = `${cfg.nomeProdutoLivre} (R$ ${cfg.precoLivre.toFixed(2)})`;
      } else {
        const bruto = parseFloat(pesoBruto) || 0;
        pesoLiquido = Math.max(0, bruto - cfg.taraPratoKg);
        valorTotal = parseFloat((pesoLiquido * cfg.precoKg).toFixed(2));
        descricaoItem = `${cfg.nomeProdutoBalanca} (${pesoLiquido.toFixed(3)}kg @ R$ ${cfg.precoKg.toFixed(2)}/kg)`;
      }

      const timestamp = new Date().toISOString();
      const registro = {
        id: 'PESO-' + Date.now().toString().slice(-6),
        timestamp,
        modo: modo || 'peso',
        pesoBruto: parseFloat(pesoBruto) || 0,
        tara: cfg.taraPratoKg,
        pesoLiquido: parseFloat(pesoLiquido.toFixed(3)),
        precoKg: cfg.precoKg,
        valorTotal,
        descricaoItem,
        comandaId: comandaId || null,
        mesaId: mesaId || null,
        clienteNome: clienteNome || (comandaId ? `Comanda #${comandaId}` : 'Cliente Avulso')
      };

      // Se houver comanda ou mesa especificada, lança na conta
      if (comandaId || mesaId) {
        try {
          if (db && typeof db.run === 'function') {
            db.run(
              `INSERT INTO itens_pedidos (pedido_id, produto_nome, quantidade, preco_unitario, subtotal, criado_em)
               VALUES (?, ?, ?, ?, ?, datetime('now'))`,
              [comandaId || mesaId, descricaoItem, 1, valorTotal, valorTotal],
              function (errDb) {
                if (errDb) log(`Erro ao inserir item na comanda: ${errDb.message}`);
              }
            );
          }
        } catch (eDb) {
          log(`Aviso DB itens: ${eDb.message}`);
        }
      }

      // Notificar todas as telas conectadas via Socket.io
      if (io) {
        io.emit('pesagem_realizada', registro);
      }

      log(`Pesagem registrada: ${registro.id} - ${descricaoItem} -> R$ ${valorTotal.toFixed(2)}`);

      res.json({
        sucesso: true,
        registro,
        ticketQr: `PESO|${registro.id}|${registro.valorTotal}|${registro.pesoLiquido}|${timestamp}`
      });
    } catch (e) {
      res.status(500).json({ sucesso: false, error: e.message });
    }
  });

  // 4. Servir a página do Totem de Pesagem
  app.get('/plugins/pesagem-selfservice/totem', (req, res) => {
    res.sendFile(path.join(__dirname, 'totem.html'));
  });
};
