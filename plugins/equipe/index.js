/**
 * plugin: equipe — CRUD de equipe de suporte + atribuições
 * Extraído de server.js linhas 2769-2900
 */
const bcrypt = require('bcrypt');

module.exports = function({ app, masterDb, options }) {
  const { superAdminAuth } = options;

  app.get('/api/super/equipe', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT id, nome, email, telefone, cargo, especialidade, status, data_cadastro FROM equipe_suporte ORDER BY nome`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      res.json({ ok: true, equipe: rows || [] });
    });
  });

  app.post('/api/super/equipe', superAdminAuth, (req, res) => {
    try {
      const { nome, email, telefone, senha, cargo, especialidade } = req.body;
      if (!nome || !email || !senha) return res.json({ ok: false, erro: 'Nome, email e senha são obrigatórios.' });
      bcrypt.hash(senha, 10).then(hash => {
        masterDb.run(`INSERT INTO equipe_suporte (nome, email, telefone, password_hash, cargo, especialidade) VALUES (?, ?, ?, ?, ?, ?)`,
          [nome, email.trim().toLowerCase(), telefone || '', hash, cargo || 'Suporte', especialidade || 'Remoto'],
          function(err) { if (err) return res.json({ ok: false, erro: err.message }); res.json({ ok: true, id: this.lastID, mensagem: 'Membro cadastrado!' }); }
        );
      });
    } catch (e) { res.json({ ok: false, erro: e.message }); }
  });

  app.put('/api/super/equipe/:id', superAdminAuth, (req, res) => {
    try {
      const { nome, email, telefone, senha, cargo, especialidade, status } = req.body;
      const id = parseInt(req.params.id);
      if (!id) return res.json({ ok: false, erro: 'ID inválido.' });
      const updates = []; const params = [];
      if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
      if (email !== undefined) { updates.push('email = ?'); params.push(email.trim().toLowerCase()); }
      if (telefone !== undefined) { updates.push('telefone = ?'); params.push(telefone); }
      if (cargo !== undefined) { updates.push('cargo = ?'); params.push(cargo); }
      if (especialidade !== undefined) { updates.push('especialidade = ?'); params.push(especialidade); }
      if (status !== undefined) { updates.push('status = ?'); params.push(status); }
      if (senha) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(senha, 10)); }
      if (updates.length === 0) return res.json({ ok: false, erro: 'Nenhum campo para atualizar.' });
      params.push(id);
      masterDb.run(`UPDATE equipe_suporte SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
        if (err) return res.json({ ok: false, erro: err.message });
        res.json({ ok: true, mensagem: 'Membro atualizado!' });
      });
    } catch (e) { res.json({ ok: false, erro: e.message }); }
  });

  app.delete('/api/super/equipe/:id', superAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.json({ ok: false, erro: 'ID inválido.' });
    masterDb.run(`DELETE FROM suporte_restaurantes WHERE suporte_id = ?`, [id], () => {
      masterDb.run(`DELETE FROM equipe_suporte WHERE id = ?`, [id], function(err) {
        if (err) return res.json({ ok: false, erro: err.message });
        res.json({ ok: true, mensagem: 'Membro removido!' });
      });
    });
  });

  app.get('/api/super/equipe/:id/restaurantes', superAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    masterDb.all(`SELECT sr.*, r.nome as restaurante_nome FROM suporte_restaurantes sr LEFT JOIN restaurantes r ON sr.restaurante_id = r.id WHERE sr.suporte_id = ? ORDER BY r.nome`, [id], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      res.json({ ok: true, atribuicoes: rows || [] });
    });
  });

  app.post('/api/super/equipe/:id/restaurantes', superAdminAuth, (req, res) => {
    const suporteId = parseInt(req.params.id);
    const { restaurante_ids, tipo_suporte } = req.body;
    if (!restaurante_ids || !Array.isArray(restaurante_ids) || restaurante_ids.length === 0) return res.json({ ok: false, erro: 'Lista de restaurantes é obrigatória.' });
    const tipo = tipo_suporte || 'remoto';
    let pendentes = restaurante_ids.length; let erros = [];
    restaurante_ids.forEach(rid => {
      masterDb.run(`INSERT OR IGNORE INTO suporte_restaurantes (suporte_id, restaurante_id, tipo_suporte) VALUES (?, ?, ?)`,
        [suporteId, rid, tipo], function(err) {
          if (err) erros.push(err.message);
          pendentes--;
          if (pendentes <= 0) res.json({ ok: erros.length === 0, mensagem: `${restaurante_ids.length - erros.length} restaurante(s) atribuído(s).` });
        });
    });
  });

  app.delete('/api/super/equipe/:id/restaurantes/:restId', superAdminAuth, (req, res) => {
    masterDb.run(`DELETE FROM suporte_restaurantes WHERE suporte_id = ? AND restaurante_id = ?`,
      [parseInt(req.params.id), parseInt(req.params.restId)], function(err) {
        if (err) return res.json({ ok: false, erro: err.message });
        res.json({ ok: true, mensagem: 'Atribuição removida.' });
      });
  });

  // POST /api/super/equipe/tasks — Super Admin atribui task para membro do suporte
  app.post('/api/super/equipe/tasks', superAdminAuth, (req, res) => {
    const { suporte_id, tipo, descricao, restaurante_id, pontos } = req.body || {};
    if (!suporte_id || !tipo || !descricao) return res.json({ ok: false, erro: 'Atendante de suporte, título e descrição são obrigatórios.' });
    const xpPontos = parseInt(pontos) || 10;
    masterDb.run(`INSERT INTO tarefas_suporte (suporte_id, tipo, descricao, restaurante_id, pontos, status, criada_em) VALUES (?, ?, ?, ?, ?, 'pendente', datetime('now','localtime'))`,
      [parseInt(suporte_id), tipo, descricao, restaurante_id ? parseInt(restaurante_id) : null, xpPontos],
      function(err) {
        if (err) return res.json({ ok: false, erro: err.message });
        res.json({ ok: true, id: this.lastID, mensagem: 'Task criada e atribuída com sucesso ao atendente!' });
      }
    );
  });

  // POST /api/super/equipe/avisos — Super Admin envia aviso
  app.post('/api/super/equipe/avisos', superAdminAuth, (req, res) => {
    const { destino, suporte_ids, titulo, tipo, corpo } = req.body || {};
    if (!titulo || !corpo) return res.json({ ok: false, erro: 'Título e mensagem do aviso são obrigatórios.' });
    const tipoAviso = tipo || 'aviso';
    const prefix = tipoAviso === 'urgente' ? '🚨 [URGENTE SUPORTE] ' : (tipoAviso === 'importante' ? '⚠️ [ALERTA SUPORTE] ' : '📢 [AVISO SUPORTE] ');
    const tituloFinal = prefix + titulo;
    if (destino === 'selecionados' && Array.isArray(suporte_ids) && suporte_ids.length > 0) {
      let pendentes = suporte_ids.length; let erros = [];
      suporte_ids.forEach(sid => {
        masterDb.run(`INSERT INTO tarefas_suporte (suporte_id, tipo, descricao, pontos, status, criada_em) VALUES (?, ?, ?, 0, 'aviso', datetime('now','localtime'))`,
          [sid, 'aviso_super', `${tituloFinal}: ${corpo}`], function(err) {
            if (err) erros.push(err.message);
            pendentes--;
            if (pendentes <= 0) res.json({ ok: erros.length === 0, mensagem: `Aviso transmitido para ${suporte_ids.length - erros.length} atendente(s)!` });
          }
        );
      });
    } else {
      masterDb.run(`INSERT INTO mensagens (titulo, corpo, tipo) VALUES (?, ?, ?)`,
        [tituloFinal, corpo, tipoAviso], function(err) {
          if (err) return res.json({ ok: false, erro: err.message });
          res.json({ ok: true, mensagem: 'Aviso transmitido com sucesso para toda a equipe de suporte!' });
        }
      );
    }
  });
};
