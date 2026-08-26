/**
 * Plugin: tarefas
 * Sistema de tarefas: Super Admin atribui → Suporte executa → Status rastreado
 */
module.exports = function({ app, db, masterDb, io, options, log }) {
  const { verificarToken, superAdminAuth } = options;

  /* ══════ SUPER ADMIN: CRUD de Tarefas ══════ */

  // GET /api/super/tarefas — Listar todas as tarefas
  app.get('/api/super/tarefas', superAdminAuth, (req, res) => {
    const { status, atribuido_a, limite } = req.query;
    let sql = 'SELECT * FROM tarefas_suporte WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (atribuido_a) { sql += ' AND atribuido_a = ?'; params.push(atribuido_a); }
    sql += ' ORDER BY criado_em DESC';
    if (limite) { sql += ' LIMIT ?'; params.push(parseInt(limite)); }
    else { sql += ' LIMIT 200'; }
    masterDb.all(sql, params, (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      res.json({ ok: true, tarefas: rows || [] });
    });
  });

  // POST /api/super/tarefas — Criar nova tarefa
  app.post('/api/super/tarefas', superAdminAuth, (req, res) => {
    const { titulo, descricao, prioridade, atribuido_a, restaurante_id, categoria } = req.body || {};
    if (!titulo) return res.json({ ok: false, erro: 'Título é obrigatório.' });
    masterDb.run(
      `INSERT INTO tarefas_suporte (titulo, descricao, prioridade, status, criado_por, atribuido_a, restaurante_id, categoria)
       VALUES (?, ?, ?, 'pendente', 'super_admin', ?, ?, ?)`,
      [titulo, descricao || '', prioridade || 'normal', atribuido_a || '', restaurante_id || null, categoria || 'geral'],
      function(err) {
        if (err) return res.json({ ok: false, erro: err.message });
        const novaId = this.lastID;
        if (atribuido_a) {
          masterDb.run(`UPDATE tarefas_suporte SET status = 'atribuida', atribuido_em = datetime('now','localtime') WHERE id = ?`, [novaId]);
        }
        io.emit('tarefa_nova', { id: novaId, titulo, atribuido_a });
        if (atribuido_a) io.to('suporte_' + atribuido_a).emit('tarefa_recebida', { id: novaId, titulo, descricao, prioridade });
        res.json({ ok: true, id: novaId });
      }
    );
  });

  // PATCH /api/super/tarefas/:id — Atualizar tarefa
  app.patch('/api/super/tarefas/:id', superAdminAuth, (req, res) => {
    const { id } = req.params;
    const { status, atribuido_a, prioridade, resposta } = req.body || {};
    const sets = ['atualizado_em = datetime(\'now\',\'localtime\')'];
    const params = [];
    if (status) { sets.push('status = ?'); params.push(status); if (status === 'concluida') sets.push('concluido_em = datetime(\'now\',\'localtime\')'); }
    if (atribuido_a !== undefined) { sets.push('atribuido_a = ?'); params.push(atribuido_a); if (atribuido_a) { sets.push('atribuido_em = datetime(\'now\',\'localtime\')'); if (status === 'pendente') { sets.push('status = \'atribuida\''); } } }
    if (prioridade) { sets.push('prioridade = ?'); params.push(prioridade); }
    if (resposta !== undefined) { sets.push('resposta = ?'); params.push(resposta); }
    params.push(id);
    masterDb.run(`UPDATE tarefas_suporte SET ${sets.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) return res.json({ ok: false, erro: err.message });
      io.emit('tarefa_atualizada', { id: parseInt(id), status, atribuido_a });
      if (atribuido_a) io.to('suporte_' + atribuido_a).emit('tarefa_atualizada', { id: parseInt(id), status });
      res.json({ ok: true });
    });
  });

  // DELETE /api/super/tarefas/:id
  app.delete('/api/super/tarefas/:id', superAdminAuth, (req, res) => {
    masterDb.run(`DELETE FROM tarefas_suporte WHERE id = ?`, [req.params.id], function(err) {
      if (err) return res.json({ ok: false, erro: err.message });
      io.emit('tarefa_removida', { id: parseInt(req.params.id) });
      res.json({ ok: true });
    });
  });

  // GET /api/super/tarefas/stats — Estatísticas para dashboard
  app.get('/api/super/tarefas/stats', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT status, COUNT(*) as total FROM tarefas_suporte GROUP BY status`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      const stats = { pendente: 0, atribuida: 0, em_andamento: 0, concluida: 0, cancelada: 0, total: 0 };
      (rows || []).forEach(r => { stats[r.status] = r.total; stats.total += r.total; });
      res.json({ ok: true, stats });
    });
  });

  /* ══════ SUPORTE: Ver e executar tarefas ══════ */

  // GET /api/suporte/tarefas — Tarefas atribuidas ao suporte logado
  app.get('/api/suporte/tarefas', verificarToken, (req, res) => {
    const nome = (req.user && req.user.nome) || (req.suporteNome) || '';
    if (!nome) return res.json({ ok: true, tarefas: [] });
    masterDb.all(
      `SELECT * FROM tarefas_suporte WHERE atribuido_a = ? AND status IN ('atribuida','em_andamento') ORDER BY
        CASE prioridade WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, criado_em DESC`,
      [nome], (err, rows) => {
        if (err) return res.json({ ok: false, erro: err.message });
        res.json({ ok: true, tarefas: rows || [] });
      }
    );
  });

  // PATCH /api/suporte/tarefas/:id — Suporte atualiza status (aceitar, em andamento, concluir)
  app.patch('/api/suporte/tarefas/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { status, resposta } = req.body || {};
    const nome = (req.user && req.user.nome) || (req.suporteNome) || '';
    const sets = ['atualizado_em = datetime(\'now\',\'localtime\')'];
    const params = [];
    if (status) {
      sets.push('status = ?'); params.push(status);
      if (status === 'em_andamento') sets.push('atribuido_em = datetime(\'now\',\'localtime\')');
      if (status === 'concluida') sets.push('concluido_em = datetime(\'now\',\'localtime\')');
    }
    if (resposta !== undefined) { sets.push('resposta = ?'); params.push(resposta); }
    params.push(id);
    masterDb.run(`UPDATE tarefas_suporte SET ${sets.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) return res.json({ ok: false, erro: err.message });
      io.emit('tarefa_atualizada', { id: parseInt(id), status, atribuido_a: nome });
      res.json({ ok: true });
    });
  });

  // Socket: suporte entra na sala
  io.on('connection', (socket) => {
    socket.on('suporte_join', (data) => {
      const nome = (data && data.nome) || '';
      if (nome) socket.join('suporte_' + nome);
    });
  });

  log('Tarefas: routes + sockets registered.');
};
