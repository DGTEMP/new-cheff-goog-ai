/**
 * Plugin: tarefas
 * Sistema de tarefas: Super Admin atribui → Suporte executa → Status rastreado
 */
module.exports = function({ app, db, masterDb, io, options, log }) {
  const authSuper = (options && typeof options.superAdminAuth === 'function') ? options.superAdminAuth : (req, res, next) => next();
  const authUser = (options && typeof options.verificarToken === 'function') ? options.verificarToken : (req, res, next) => next();

  // Migração de schema e compatibilidade para tarefas_suporte
  try {
    const requiredCols = [
      'titulo TEXT',
      'descricao TEXT',
      'prioridade TEXT',
      'status TEXT',
      'criado_por TEXT',
      'atribuido_a TEXT',
      'restaurante_id INTEGER',
      'categoria TEXT',
      'resposta TEXT',
      'criado_em DATETIME',
      'criada_em DATETIME',
      'atribuido_em DATETIME',
      'atualizado_em DATETIME',
      'concluido_em DATETIME',
      'pontos INTEGER',
      'tipo TEXT'
    ];

    masterDb.all('PRAGMA table_info(tarefas_suporte)', [], (err, cols) => {
      if (!err && Array.isArray(cols)) {
        const existing = new Set(cols.map(c => c.name));
        const missing = requiredCols.filter(colDef => !existing.has(colDef.split(' ')[0]));
        
        function addNext() {
          if (missing.length === 0) {
            masterDb.run("UPDATE tarefas_suporte SET titulo = COALESCE(NULLIF(titulo, ''), tipo, 'Demanda #' || id) WHERE titulo IS NULL OR titulo = ''", () => {});
            masterDb.run("UPDATE tarefas_suporte SET prioridade = 'normal' WHERE prioridade IS NULL OR prioridade = ''", () => {});
            masterDb.run("UPDATE tarefas_suporte SET status = 'pendente' WHERE status IS NULL OR status = '' OR status = 'aviso'", () => {});
            masterDb.run("UPDATE tarefas_suporte SET criado_em = COALESCE(criado_em, criada_em, datetime('now','localtime')) WHERE criado_em IS NULL", () => {});
            return;
          }
          const colDef = missing.shift();
          masterDb.run(`ALTER TABLE tarefas_suporte ADD COLUMN ${colDef}`, () => {
            addNext();
          });
        }
        addNext();
      }
    });
  } catch (e) {
    console.error('[Tarefas] Erro na migração de schema:', e);
  }

  /* ══════ SUPER ADMIN: CRUD de Tarefas ══════ */

  // GET /api/super/tarefas — Listar todas as tarefas
  app.get('/api/super/tarefas', authSuper, (req, res) => {
    const { status, atribuido_a, limite } = req.query;
    let sql = `SELECT id,
      CASE
        WHEN titulo IS NOT NULL AND titulo != '' AND titulo != tipo AND titulo NOT IN ('falha_automatica','design_tema','relato_restaurante','aviso_super') THEN titulo
        WHEN tipo = 'falha_automatica' THEN '🚨 Falha Automática do Servidor #' || id
        WHEN tipo = 'design_tema' THEN '🎨 Solicitação de Design de Tema #' || id
        WHEN tipo = 'relato_restaurante' THEN '📝 Relato de Restaurante #' || id
        WHEN tipo = 'aviso_super' THEN '📢 Comunicado do Super Admin #' || id
        ELSE COALESCE(NULLIF(titulo, ''), tipo, 'Demanda #' || id)
      END AS titulo,
      descricao,
      COALESCE(NULLIF(prioridade, ''), CASE WHEN tipo = 'falha_automatica' THEN 'urgente' WHEN tipo = 'relato_restaurante' THEN 'alta' ELSE 'normal' END) AS prioridade,
      CASE WHEN status = 'aviso' THEN 'pendente' ELSE COALESCE(status, 'pendente') END AS status,
      criado_por,
      atribuido_a,
      restaurante_id,
      COALESCE(NULLIF(categoria, ''), CASE WHEN tipo = 'falha_automatica' THEN 'servidor' WHEN tipo = 'design_tema' THEN 'design' WHEN tipo = 'relato_restaurante' THEN 'suporte' ELSE 'geral' END) AS categoria,
      resposta,
      COALESCE(criado_em, criada_em, datetime('now','localtime')) AS criado_em,
      atribuido_em,
      atualizado_em,
      concluido_em,
      COALESCE(pontos, 10) AS pontos,
      tipo
      FROM tarefas_suporte WHERE 1=1`;
    const params = [];
    if (status) {
      if (status === 'pendente') {
        sql += " AND (status = 'pendente' OR status = 'aviso' OR status IS NULL)";
      } else {
        sql += ' AND status = ?';
        params.push(status);
      }
    }
    if (atribuido_a) {
      sql += ' AND atribuido_a = ?';
      params.push(atribuido_a);
    }
    sql += " ORDER BY COALESCE(criado_em, criada_em, id) DESC";
    if (limite) {
      sql += ' LIMIT ?';
      params.push(parseInt(limite));
    } else {
      sql += ' LIMIT 200';
    }
    masterDb.all(sql, params, (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message, tarefas: [] });
      res.json({ ok: true, tarefas: rows || [] });
    });
  });

  // POST /api/super/tarefas — Criar nova tarefa
  app.post('/api/super/tarefas', authSuper, (req, res) => {
    const { titulo, descricao, prioridade, atribuido_a, restaurante_id, categoria } = req.body || {};
    if (!titulo) return res.json({ ok: false, erro: 'Título é obrigatório.' });
    masterDb.run(
      `INSERT INTO tarefas_suporte (titulo, descricao, prioridade, status, criado_por, atribuido_a, restaurante_id, categoria, criado_em)
       VALUES (?, ?, ?, 'pendente', 'super_admin', ?, ?, ?, datetime('now','localtime'))`,
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
  app.patch('/api/super/tarefas/:id', authSuper, (req, res) => {
    const { id } = req.params;
    const { status, atribuido_a, prioridade, resposta } = req.body || {};
    const sets = ['atualizado_em = datetime(\'now\',\'localtime\')'];
    const params = [];
    if (status) {
      sets.push('status = ?');
      params.push(status);
      if (status === 'concluida') sets.push('concluido_em = datetime(\'now\',\'localtime\')');
    }
    if (atribuido_a !== undefined) {
      sets.push('atribuido_a = ?');
      params.push(atribuido_a);
      if (atribuido_a) {
        sets.push('atribuido_em = datetime(\'now\',\'localtime\')');
        if (status === 'pendente') sets.push('status = \'atribuida\'');
      }
    }
    if (prioridade) {
      sets.push('prioridade = ?');
      params.push(prioridade);
    }
    if (resposta !== undefined) {
      sets.push('resposta = ?');
      params.push(resposta);
    }
    params.push(id);
    masterDb.run(`UPDATE tarefas_suporte SET ${sets.join(', ')} WHERE id = ?`, params, function(err) {
      if (err) return res.json({ ok: false, erro: err.message });
      io.emit('tarefa_atualizada', { id: parseInt(id), status, atribuido_a });
      if (atribuido_a) io.to('suporte_' + atribuido_a).emit('tarefa_atualizada', { id: parseInt(id), status });
      res.json({ ok: true });
    });
  });

  // DELETE /api/super/tarefas/:id
  app.delete('/api/super/tarefas/:id', authSuper, (req, res) => {
    masterDb.run(`DELETE FROM tarefas_suporte WHERE id = ?`, [req.params.id], function(err) {
      if (err) return res.json({ ok: false, erro: err.message });
      io.emit('tarefa_removida', { id: parseInt(req.params.id) });
      res.json({ ok: true });
    });
  });

  // GET /api/super/tarefas/stats — Estatísticas para dashboard
  app.get('/api/super/tarefas/stats', authSuper, (req, res) => {
    masterDb.all(`SELECT CASE WHEN status = 'aviso' THEN 'pendente' ELSE COALESCE(status, 'pendente') END as st, COUNT(*) as total FROM tarefas_suporte GROUP BY st`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      const stats = { pendente: 0, atribuida: 0, em_andamento: 0, concluida: 0, cancelada: 0, total: 0 };
      (rows || []).forEach(r => {
        if (r.st) stats[r.st] = (stats[r.st] || 0) + r.total;
        stats.total += r.total;
      });
      res.json({ ok: true, stats });
    });
  });

  /* ══════ SUPORTE: Ver e executar tarefas ══════ */

  // GET /api/suporte/tarefas — Tarefas atribuidas ao suporte logado
  app.get('/api/suporte/tarefas', authUser, (req, res) => {
    const nome = (req.user && req.user.nome) || (req.suporteNome) || '';
    if (!nome) return res.json({ ok: true, tarefas: [] });
    masterDb.all(
      `SELECT id,
        CASE
          WHEN titulo IS NOT NULL AND titulo != '' AND titulo != tipo AND titulo NOT IN ('falha_automatica','design_tema','relato_restaurante','aviso_super') THEN titulo
          WHEN tipo = 'falha_automatica' THEN '🚨 Falha Automática do Servidor #' || id
          WHEN tipo = 'design_tema' THEN '🎨 Solicitação de Design de Tema #' || id
          WHEN tipo = 'relato_restaurante' THEN '📝 Relato de Restaurante #' || id
          WHEN tipo = 'aviso_super' THEN '📢 Comunicado do Super Admin #' || id
          ELSE COALESCE(NULLIF(titulo, ''), tipo, 'Demanda #' || id)
        END AS titulo,
        descricao,
        COALESCE(NULLIF(prioridade, ''), CASE WHEN tipo = 'falha_automatica' THEN 'urgente' WHEN tipo = 'relato_restaurante' THEN 'alta' ELSE 'normal' END) AS prioridade,
        status,
        criado_por,
        atribuido_a,
        restaurante_id,
        COALESCE(NULLIF(categoria, ''), CASE WHEN tipo = 'falha_automatica' THEN 'servidor' WHEN tipo = 'design_tema' THEN 'design' WHEN tipo = 'relato_restaurante' THEN 'suporte' ELSE 'geral' END) AS categoria,
        resposta,
        COALESCE(criado_em, criada_em, datetime('now','localtime')) AS criado_em,
        atribuido_em,
        atualizado_em,
        concluido_em,
        COALESCE(pontos, 10) AS pontos
        FROM tarefas_suporte WHERE atribuido_a = ? AND status IN ('atribuida','em_andamento') ORDER BY
        CASE prioridade WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, COALESCE(criado_em, criada_em, id) DESC`,
      [nome], (err, rows) => {
        if (err) return res.json({ ok: false, erro: err.message });
        res.json({ ok: true, tarefas: rows || [] });
      }
    );
  });

  // PATCH /api/suporte/tarefas/:id — Suporte atualiza status (aceitar, em andamento, concluir)
  app.patch('/api/suporte/tarefas/:id', authUser, (req, res) => {
    const { id } = req.params;
    const { status, resposta } = req.body || {};
    const nome = (req.user && req.user.nome) || (req.suporteNome) || '';
    const sets = ['atualizado_em = datetime(\'now\',\'localtime\')'];
    const params = [];
    if (status) {
      sets.push('status = ?');
      params.push(status);
      if (status === 'em_andamento') sets.push('atribuido_em = datetime(\'now\',\'localtime\')');
      if (status === 'concluida') sets.push('concluido_em = datetime(\'now\',\'localtime\')');
    }
    if (resposta !== undefined) {
      sets.push('resposta = ?');
      params.push(resposta);
    }
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

  log('Tarefas: routes + sockets registered with backward compatibility.');
};
