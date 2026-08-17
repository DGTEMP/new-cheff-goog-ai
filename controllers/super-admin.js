/**
 * controllers/super-admin.js
 * Endpoints e regras de negócio completas para o Painel Super Admin
 */
'use strict';

const fsSync = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { exec } = require('child_process');

module.exports = function (app, masterDb, sqlite3, options) {
  const { JWT_SECRET, superAdminAuth, io } = options;
  const featurePlans = options.featurePlans;
  const loadAllTenantFeatures = options.loadAllTenantFeatures;
  const getTenantFeaturesSync = options.getTenantFeaturesSync;
  const isTenantFeatureEnabled = options.isTenantFeatureEnabled;
  const metricSocketCount = options.metricSocketCount;
  const ifoodApi = options.ifoodApi;
  const ifoodDeps = options.ifoodDeps;

  function getTenantDbPath(tenantId) {
    const tid = parseInt(tenantId) || 1;
    return path.join(__dirname, '..', `database_${tid}.sqlite`);
  }

  function listarBancosTenant() {
    try {
      const rootDir = path.join(__dirname, '..');
      const files = fsSync.readdirSync(rootDir)
        .filter(f => /^database_\d+\.sqlite$/.test(f))
        .map(f => path.join(rootDir, f));
      if (files.length === 0 && fsSync.existsSync(path.join(rootDir, 'database_1.sqlite'))) {
        return [path.join(rootDir, 'database_1.sqlite')];
      }
      return files;
    } catch (e) {
      return [];
    }
  }

  function trimStr(v, maxLen = 500) {
    return typeof v === 'string' ? v.trim().substring(0, maxLen) : '';
  }

  function safeInt(v, min = 0, max = Infinity) {
    const n = parseInt(v, 10);
    return isNaN(n) ? min : Math.max(min, Math.min(max, n));
  }

  function getClientIp(req) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
    return String(rawIp).replace('::ffff:', '');
  }

  // ═══════════════════════════════════════════════════════════════
  // USUÁRIOS
  // ═══════════════════════════════════════════════════════════════

  // GET /api/super/usuarios — lista todos os usuários dos bancos
  app.get('/api/super/usuarios', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT id, restaurante_id, username, role, ativo, data_cadastro FROM usuarios ORDER BY id`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      res.json({ ok: true, usuarios: rows || [] });
    });
  });

  // POST /api/super/reset-credenciais — reseta email e/ou senha de um usuário
  app.post('/api/super/reset-credenciais', superAdminAuth, async (req, res) => {
    try {
      const { userId, novoEmail, novaSenha } = req.body;
      if (!userId) return res.json({ ok: false, erro: 'ID do usuário é obrigatório.' });
      if (!novoEmail && !novaSenha) return res.json({ ok: false, erro: 'Informe pelo menos o novo email ou a nova senha.' });

      const updates = [];
      const params = [];

      if (novoEmail) {
        const emailTrimmed = novoEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
          return res.json({ ok: false, erro: 'Formato de email inválido.' });
        }
        updates.push('username = ?');
        params.push(emailTrimmed);
      }

      if (novaSenha) {
        if (novaSenha.length < 4) return res.json({ ok: false, erro: 'A senha deve ter no mínimo 4 caracteres.' });
        const hash = await bcrypt.hash(novaSenha, 10);
        updates.push('password_hash = ?');
        params.push(hash);
      }

      params.push(parseInt(userId));

      masterDb.run(
        `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function (err) {
          if (err) return res.json({ ok: false, erro: err.message });
          if (this.changes === 0) return res.json({ ok: false, erro: 'Usuário não encontrado.' });
          res.json({ ok: true, mensagem: 'Credenciais atualizadas com sucesso!' });
        }
      );
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // POST /api/super/criar-usuario — cria novo usuário admin
  app.post('/api/super/criar-usuario', superAdminAuth, async (req, res) => {
    try {
      const { email, senha, restauranteId } = req.body;
      if (!email || !senha) return res.json({ ok: false, erro: 'Email e senha são obrigatórios.' });
      const emailTrimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        return res.json({ ok: false, erro: 'Formato de email inválido.' });
      }
      if (senha.length < 4) return res.json({ ok: false, erro: 'A senha deve ter no mínimo 4 caracteres.' });

      const hash = await bcrypt.hash(senha, 10);
      const rid = parseInt(restauranteId) || 1;
      const agora = new Date().toISOString().replace('T', ' ').substring(0, 19);

      masterDb.run(
        `INSERT INTO usuarios (restaurante_id, username, password_hash, role, ativo, data_cadastro) VALUES (?, ?, ?, 'admin', 1, ?)`,
        [rid, emailTrimmed, hash, agora],
        function (err) {
          if (err) {
            if (err.message && err.message.includes('UNIQUE')) return res.json({ ok: false, erro: 'Este email já está cadastrado.' });
            return res.json({ ok: false, erro: err.message });
          }
          res.json({ ok: true, mensagem: 'Usuário criado com sucesso!', id: this.lastID });
        }
      );
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // DELETE /api/super/usuario/:id — desativa usuário
  app.delete('/api/super/usuario/:id', superAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.json({ ok: false, erro: 'ID inválido.' });
    masterDb.run(`UPDATE usuarios SET ativo = 0 WHERE id = ?`, [id], function (err) {
      if (err) return res.json({ ok: false, erro: err.message });
      if (this.changes === 0) return res.json({ ok: false, erro: 'Usuário não encontrado.' });
      res.json({ ok: true, mensagem: 'Usuário desativado com sucesso.' });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESTAURANTES
  // ═══════════════════════════════════════════════════════════════

  // GET /api/super/restaurantes — lista todos os restaurantes
  app.get('/api/super/restaurantes', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT * FROM restaurantes ORDER BY id DESC`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });

      const lista = rows || [];
      if (lista.length === 0) return res.json({ ok: true, clients: [] });

      let pendentes = lista.length;
      const mapped = lista.map(r => ({
        id: String(r.id),
        restaurante: r.nome,
        status: r.ativo ? (r.licenca || 'ativo') : 'bloqueado',
        plano: r.licenca === 'premium' ? 'Premium' : (r.licenca === 'trial' ? 'Trial' : (r.licenca || 'Ativo')),
        login_mode: r.login_mode || 'multi',
        chave: r.chave_ativacao || ('CHEF-LOCAL-' + String(r.id).padStart(4, '0')),
        validade: r.validade_licenca || null,
        maxDisp: r.max_dispositivos || 0,
        ultimaVer: r.data_cadastro,
        versao: 'Local-1.0',
        ip: '127.0.0.1',
        regiao: 'Local Server',
        obs: 'Restaurante do sistema.',
        total_funcionarios: 0
      }));

      function finalizar() {
        res.json({ ok: true, clients: mapped });
      }

      mapped.forEach(item => {
        const restId = parseInt(item.id);
        const tenantDbPath = getTenantDbPath(restId);
        if (!fsSync.existsSync(tenantDbPath)) {
          pendentes--;
          if (pendentes <= 0) finalizar();
          return;
        }
        const tDb = new sqlite3.Database(tenantDbPath, sqlite3.OPEN_READONLY, errOpen => {
          if (errOpen) {
            pendentes--;
            if (pendentes <= 0) finalizar();
            return;
          }
          tDb.get("SELECT COUNT(*) as c FROM funcionarios WHERE status = 'Ativo'", [], (errCount, rowCount) => {
            if (!errCount && rowCount) item.total_funcionarios = rowCount.c;
            tDb.close();
            pendentes--;
            if (pendentes <= 0) finalizar();
          });
        });
      });
    });
  });

  // POST /api/super/criar-restaurante-completo — setup inicial completo
  app.post('/api/super/criar-restaurante-completo', superAdminAuth, async (req, res) => {
    try {
      const body = req.body || {};
      const nome = (body.nome || '').trim();
      if (!nome) return res.json({ ok: false, erro: 'Nome do restaurante é obrigatório.' });

      const alertas = [];

      // 1) Validar chave de ativação (se fornecida)
      let licencaVal = (body.licenca || 'trial').trim().toLowerCase();
      let validade = null;
      let maxDisp = 0;
      const chave = (body.chave_ativacao || '').trim().toUpperCase();

      if (chave) {
        const lic = await new Promise((resolve) => {
          masterDb.get(`SELECT * FROM licencas WHERE chave = ?`, [chave], (e, r) => resolve(e ? null : r));
        });
        if (!lic) {
          return res.json({ ok: false, erro: 'Chave de ativação inválida.' });
        }
        if (lic.status === 'revogada') {
          return res.json({ ok: false, erro: 'Chave de ativação revogada.' });
        }
        const hoje = new Date().toISOString().split('T')[0];
        if (lic.validade && lic.validade < hoje) {
          return res.json({ ok: false, erro: 'Chave de ativação expirada.' });
        }
        if (lic.status === 'usada' && lic.install_id) {
          return res.json({ ok: false, erro: 'Chave já utilizada em outra instalação.' });
        }
        licencaVal = lic.plano || 'premium';
        validade = lic.validade || null;
        maxDisp = lic.max_dispositivos || 0;
      }

      const activeVal = body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1;
      const modeVal = body.login_mode || 'multi';
      const slug = (body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || null;
      const customDomain = (body.custom_domain || '').trim().toLowerCase() || null;

      // 2) Criar restaurante
      const newId = await new Promise((resolve, reject) => {
        masterDb.run(
          `INSERT INTO restaurantes (nome, licenca, ativo, login_mode, chave_ativacao, validade_licenca, max_dispositivos, slug, custom_domain, data_cadastro)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
          [nome, licencaVal, activeVal, modeVal, chave || null, validade, maxDisp, slug, customDomain],
          function(err) { err ? reject(err) : resolve(this.lastID); }
        );
      });

      // 3) Copiar template do banco do tenant
      const tenantDbPath = path.join(__dirname, '..', `database_${newId}.sqlite`);
      if (!fsSync.existsSync(tenantDbPath)) {
        const templateDb = path.join(__dirname, '..', 'database_1.sqlite');
        if (fsSync.existsSync(templateDb)) {
          try { fsSync.copyFileSync(templateDb, tenantDbPath); } catch (e) { }
        }
      }

      // 4) Marcar chave como usada
      if (chave) {
        const agora = new Date().toLocaleString();
        masterDb.run(
          `UPDATE licencas SET status = 'usada', usada_em = ?, usada_por = ?, install_id = ? WHERE chave = ?`,
          [agora, nome, 'super-admin-' + newId, chave], () => {}
        );
      }

      // 5) Criar usuário admin/dono
      let adminUserId = null;
      const adminEmail = (body.email || '').trim();
      const adminSenha = body.senha || '';
      const adminNome = (body.admin_nome || '').trim();

      if (adminEmail && adminSenha) {
        const hash = await bcrypt.hash(adminSenha, 10);
        adminUserId = await new Promise((resolve, reject) => {
          masterDb.run(
            `INSERT INTO usuarios (restaurante_id, username, password_hash, role, ativo) VALUES (?, ?, ?, 'admin', 1)`,
            [newId, adminEmail, hash],
            function(err) { err ? reject(err) : resolve(this.lastID); }
          );
        }).catch((e) => {
          alertas.push('Erro ao criar admin: ' + e.message);
          return null;
        });
      }

      // 6) Criar funcionários iniciais
      const funcs = body.funcionarios_iniciais || [];
      let funcsCriados = 0;
      for (const f of funcs) {
        const fNome = (f.nome || '').trim();
        if (!fNome) continue;
        const fCargo = (f.cargo || 'Garçom').trim();
        const fValor = parseFloat(f.valor_hora) || 0;
        const fEmail = (f.email || '').trim() || (fNome.toLowerCase().replace(/\s+/g, '.') + '@temp.local');
        const fSenha = f.senha || '1234';
        const fHash = await bcrypt.hash(fSenha, 10).catch(() => null);
        if (fHash) {
          await new Promise((resolve) => {
            masterDb.run(
              `INSERT INTO usuarios (restaurante_id, username, password_hash, role, ativo) VALUES (?, ?, ?, ?, 1)`,
              [newId, fEmail, fHash, fCargo === 'Admin' || fCargo === 'admin' ? 'admin' : fCargo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')],
              function() { resolve(); }
            );
          });
          funcsCriados++;
        }
      }
      if (funcs.length > 0) {
        alertas.push(funcsCriados + ' funcionário(s) criado(s)');
      }

      // 7) Configurações iniciais do tenant
      const cfg = body.config_iniciais || {};
      const cfgEntries = Object.entries(cfg);
      if (cfgEntries.length > 0) {
        try {
          const tenantDb = await new Promise((resolve, reject) => {
            const dbPath = path.join(__dirname, '..', `database_${newId}.sqlite`);
            const sqlite3 = require('sqlite3').verbose();
            const db = new sqlite3.Database(dbPath, (err) => err ? reject(err) : resolve(db));
          });
          await new Promise((resolve) => {
            tenantDb.serialize(() => {
              tenantDb.run(`CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)`, () => {});
              for (const [k, v] of cfgEntries) {
                tenantDb.run(`INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)`, [k, String(v)], () => {});
              }
              tenantDb.close(() => resolve());
            });
          });
        } catch (eCfg) {
          alertas.push('Erro ao salvar config: ' + eCfg.message);
        }
      }

      // 8) Aplicar features do plano
      if (typeof options.reloadDomainMaps === 'function') {
        await options.reloadDomainMaps();
      }
      if (typeof options.loadAllTenantFeatures === 'function') {
        await options.loadAllTenantFeatures();
      }

      res.json({
        ok: true,
        id: newId,
        nome: nome,
        licenca: licencaVal,
        admin_criado: !!adminUserId,
        alertas: alertas,
        mensagem: 'Restaurante "' + nome + '" criado com sucesso!'
      });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // POST /api/super/criar-restaurante — cria novo restaurante (simples)
  app.post('/api/super/criar-restaurante', superAdminAuth, async (req, res) => {
    try {
      const { nome, licenca, ativo, login_mode } = req.body;
      if (!nome) return res.json({ ok: false, erro: 'Nome do restaurante é obrigatório.' });

      const activeVal = ativo !== undefined ? (ativo ? 1 : 0) : 1;
      const licencaVal = licenca || 'ativo';
      const modeVal = login_mode || 'multi';

      masterDb.run(
        `INSERT INTO restaurantes (nome, licenca, ativo, login_mode, data_cadastro) VALUES (?, ?, ?, ?, datetime('now','localtime'))`,
        [nome, licencaVal, activeVal, modeVal],
        function (err) {
          if (err) return res.json({ ok: false, erro: err.message });
          const newId = this.lastID;
          const tenantDbPath = getTenantDbPath(newId);
          if (!fsSync.existsSync(tenantDbPath)) {
            const templateDb = getTenantDbPath(1);
            if (fsSync.existsSync(templateDb)) {
              try { fsSync.copyFileSync(templateDb, tenantDbPath); } catch (e) { }
            }
          }
          res.json({ ok: true, mensagem: 'Restaurante criado com sucesso!', id: newId });
        }
      );
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // POST /api/super/atualizar-restaurante — atualiza dados do restaurante
  app.post('/api/super/atualizar-restaurante', superAdminAuth, async (req, res) => {
    try {
      const { id, nome, licenca, ativo, login_mode, validade_licenca, max_dispositivos } = req.body;
      if (!id) return res.json({ ok: false, erro: 'ID do restaurante é obrigatório.' });

      const updates = [];
      const params = [];

      if (nome) { updates.push('nome = ?'); params.push(nome); }
      if (licenca) { updates.push('licenca = ?'); params.push(licenca); }
      if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }
      if (login_mode) { updates.push('login_mode = ?'); params.push(login_mode); }
      if (validade_licenca !== undefined) { updates.push('validade_licenca = ?'); params.push(validade_licenca); }
      if (max_dispositivos !== undefined) { updates.push('max_dispositivos = ?'); params.push(parseInt(max_dispositivos) || 0); }

      if (updates.length === 0) return res.json({ ok: false, erro: 'Nenhum campo para atualizar.' });

      params.push(parseInt(id));

      masterDb.run(
        `UPDATE restaurantes SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function (err) {
          if (err) return res.json({ ok: false, erro: err.message });
          res.json({ ok: true, mensagem: 'Restaurante atualizado com sucesso!' });
        }
      );
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // DELETE /api/super/restaurante/:id — desativa restaurante
  app.delete('/api/super/restaurante/:id', superAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.json({ ok: false, erro: 'ID inválido.' });
    masterDb.run(`UPDATE restaurantes SET ativo = 0 WHERE id = ?`, [id], function (err) {
      if (err) return res.json({ ok: false, erro: err.message });
      res.json({ ok: true, mensagem: 'Restaurante desativado com sucesso.' });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD STATS & BI
  // ═══════════════════════════════════════════════════════════════

  // GET /api/super/dashboard-stats — estatísticas gerais
  app.get('/api/super/dashboard-stats', superAdminAuth, async (req, res) => {
    try {
      const counts = await new Promise((resolve) => {
        masterDb.all(`SELECT licenca, ativo FROM restaurantes`, [], (err, rows) => {
          const stats = { ativas: 0, trials: 0, expiradas: 0, bloqueadas: 0 };
          if (err || !rows) return resolve(stats);
          rows.forEach(r => {
            if (!r.ativo) stats.bloqueadas++;
            else if (r.licenca === 'trial') stats.trials++;
            else if (r.licenca === 'expirado') stats.expiradas++;
            else stats.ativas++;
          });
          resolve(stats);
        });
      });

      const userCount = await new Promise((resolve) => {
        masterDb.get(`SELECT COUNT(*) as count FROM usuarios WHERE ativo = 1`, [], (err, row) => {
          resolve(row ? row.count : 0);
        });
      });

      let totalSales = 0;
      try {
        const dbFiles = listarBancosTenant();
        for (const dbPath of dbFiles) {
          const sales = await new Promise((resolve) => {
            const tenantDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
              if (err) return resolve(0);
            });
            tenantDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='pedidos'", [], (errTable, tableRow) => {
              if (errTable || !tableRow) {
                try { tenantDb.close(); } catch (e) { }
                return resolve(0);
              }
              tenantDb.get("SELECT SUM(CAST(REPLACE(COALESCE(total,'0'), ',', '.') AS REAL)) as total_sales FROM pedidos WHERE status IN ('Finalizado', 'Pago')", [], (errQuery, rowQuery) => {
                try { tenantDb.close(); } catch (e) { }
                if (errQuery || !rowQuery) resolve(0);
                else resolve(rowQuery.total_sales || 0);
              });
            });
          });
          totalSales += sales;
        }
      } catch (e) {
        console.error('[Dashboard-Stats] Erro ao calcular vendas:', e);
      }

      res.json({
        ok: true,
        stats: {
          ativas: counts.ativas,
          trials: counts.trials,
          expiradas: counts.expiradas,
          bloqueadas: counts.bloqueadas,
          usuarios: userCount,
          totalSales: parseFloat(totalSales.toFixed(2))
        }
      });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // GET /api/super/bi-franquias — BI consolidado
  app.get('/api/super/bi-franquias', superAdminAuth, async (req, res) => {
    try {
      const dias = Math.min(365, Math.max(1, parseInt(req.query.dias) || 30));
      const ate = req.query.ate || new Date().toISOString().slice(0, 10);
      const de = req.query.de || new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10);

      const restNames = await new Promise((resolve) => {
        masterDb.all(`SELECT id, nome FROM restaurantes`, [], (err, rows) => {
          const map = {};
          if (!err && rows) rows.forEach(r => map[String(r.id)] = r.nome);
          resolve(map);
        });
      });

      const dbFiles = listarBancosTenant();
      const restaurantes = [];
      let totalVendas = 0, totalPedidos = 0;

      for (const dbPath of dbFiles) {
        const idMatch = dbPath.match(/database_(\d+)\.sqlite$/);
        const restId = idMatch ? idMatch[1] : '1';
        const nome = (restId && restNames[restId]) || ('Restaurante #' + restId);

        await new Promise((resolveOpen) => {
          const tDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (errOpen) => {
            if (errOpen) return resolveOpen();
          });
          tDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='pedidos'", [], (errTable, tableRow) => {
            if (errTable || !tableRow) { try { tDb.close(); } catch (e) { } return resolveOpen(); }
            const SQL_TOTAL = `CAST(REPLACE(CAST(total AS TEXT), ',', '.') AS REAL)`;
            tDb.all(
              `SELECT substr(createdAt,1,10) as dia, SUM(${SQL_TOTAL}) as total, COUNT(*) as qtd
               FROM pedidos WHERE status IN ('Finalizado','Pago') AND substr(createdAt,1,10) BETWEEN ? AND ?
               GROUP BY dia ORDER BY dia`,
              [de, ate], (errDias, diasRows) => {
                const vendas_por_dia = (diasRows || []).map(r => ({ dia: r.dia, total: parseFloat(r.total || 0).toFixed(2) }));
                const total = (diasRows || []).reduce((a, r) => a + (parseFloat(r.total) || 0), 0);
                const qtd = (diasRows || []).reduce((a, r) => a + (r.qtd || 0), 0);

                tDb.all(
                  `SELECT productName, SUM(quantity) as qty, SUM(${SQL_TOTAL}) as total
                   FROM pedidos
                   WHERE status IN ('Finalizado','Pago') AND substr(createdAt,1,10) BETWEEN ? AND ?
                     AND productName NOT LIKE 'Pgto %'
                   GROUP BY productName ORDER BY total DESC LIMIT 5`,
                  [de, ate], (errTop, topRows) => {
                    const top_produtos = (topRows || []).map(r => ({ nome: r.productName, qtd: r.qty || 0, total: parseFloat(r.total || 0).toFixed(2) }));
                    tDb.all(
                      `SELECT sector, SUM(${SQL_TOTAL}) as total FROM pedidos
                       WHERE status IN ('Finalizado','Pago') AND substr(createdAt,1,10) BETWEEN ? AND ?
                         AND productName NOT LIKE 'Pgto %'
                       GROUP BY sector ORDER BY total DESC`,
                      [de, ate], (errSet, setRows) => {
                        try { tDb.close(); } catch (e) { }
                        restaurantes.push({
                          id: restId,
                          nome,
                          total_vendas: parseFloat(total.toFixed(2)),
                          pedidos: qtd,
                          ticket_medio: qtd > 0 ? parseFloat((total / qtd).toFixed(2)) : 0,
                          vendas_por_dia,
                          top_produtos,
                          setores: (setRows || []).map(s => ({ setor: s.sector || 'Geral', total: parseFloat(s.total || 0).toFixed(2) }))
                        });
                        totalVendas += total;
                        totalPedidos += qtd;
                        resolveOpen();
                      }
                    );
                  }
                );
              }
            );
          });
        });
      }

      const ranking = restaurantes.slice().sort((a, b) => b.total_vendas - a.total_vendas);
      res.json({
        ok: true,
        de, ate, dias,
        total_vendas: parseFloat(totalVendas.toFixed(2)),
        total_pedidos: totalPedidos,
        ticket_medio_geral: totalPedidos > 0 ? parseFloat((totalVendas / totalPedidos).toFixed(2)) : 0,
        qtd_restaurantes: restaurantes.length,
        restaurantes,
        ranking
      });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // LICENÇAS
  // ═══════════════════════════════════════════════════════════════

  function gerarChaveAtivacao() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = (len) => { let s = ''; for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length)); return s; };
    return `CHEF-${part(4)}-${part(4)}-${part(4)}`;
  }

  // GET /api/super/licencas — listar todas as chaves
  app.get('/api/super/licencas', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT * FROM licencas ORDER BY id DESC`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      res.json({ ok: true, licencas: rows || [] });
    });
  });

  // POST /api/super/licencas/gerar — gerar nova chave
  app.post('/api/super/licencas/gerar', superAdminAuth, (req, res) => {
    const { restaurante_nome, dias, plano, max_dispositivos, obs } = req.body || {};
    const nome = trimStr(restaurante_nome, 120) || 'Restaurante';
    const qtdDias = safeInt(dias, 30, 3650) || 365;
    const planoVal = ['premium', 'pro', 'plus'].includes(plano) ? plano : 'premium';
    const maxDisp = safeInt(max_dispositivos, 0, 1000) || 0;
    const validade = new Date(Date.now() + qtdDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const chave = gerarChaveAtivacao();
    masterDb.run(
      `INSERT INTO licencas (chave, restaurante_nome, plano, dias, validade, max_dispositivos, obs) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chave, nome, planoVal, qtdDias, validade, maxDisp, trimStr(obs, 300) || ''],
      function (err) {
        if (err) return res.json({ ok: false, erro: err.message });
        res.json({ ok: true, licenca: { id: this.lastID, chave, restaurante_nome: nome, plano: planoVal, dias: qtdDias, validade, max_dispositivos: maxDisp, obs: trimStr(obs, 300) || '', status: 'disponivel' } });
      }
    );
  });

  // POST /api/super/licencas/:id/revogar — revogar chave
  app.post('/api/super/licencas/:id/revogar', superAdminAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.json({ ok: false, erro: 'ID inválido.' });
    masterDb.run(`UPDATE licencas SET status = 'revogada' WHERE id = ?`, [id], (err) => {
      if (err) return res.json({ ok: false, erro: err.message });
      res.json({ ok: true });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TELEMETRIA E LOGS
  // ═══════════════════════════════════════════════════════════════

  // GET /api/super/telemetria — lista telemetria consolidada
  app.get('/api/super/telemetria', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT t.*, r.nome as rest_nome FROM telemetria t LEFT JOIN restaurantes r ON r.id = t.restaurante_id ORDER BY t.ultima_atividade DESC`, [], (err, rows) => {
      if (err) return res.json({ ok: true, telemetria: [] });
      res.json({ ok: true, telemetria: rows || [] });
    });
  });

  // GET /api/super/logs-sistema — logs de auditoria e api
  app.get('/api/super/logs-sistema', superAdminAuth, (req, res) => {
    const search = req.query.search || '';
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const offset = Math.max(0, parseInt(req.query.offset) || 0);

    const tDb = new sqlite3.Database(getTenantDbPath(1), sqlite3.OPEN_READONLY, (errOpen) => {
      if (errOpen) return res.json({ ok: true, rows: [], total: 0 });

      let query = `SELECT * FROM auditoria`;
      const params = [];
      if (search) {
        query += ` WHERE operador LIKE ? OR acao LIKE ? OR detalhes LIKE ? OR motivo LIKE ?`;
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
      }
      query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      tDb.all(query, params, (err, rows) => {
        tDb.close();
        if (err) return res.json({ ok: true, rows: [], total: 0 });
        res.json({ ok: true, rows: rows || [], total: (rows || []).length });
      });
    });
  });

  // GET /api/super/server-status — status e uso de memória
  app.get('/api/super/server-status', superAdminAuth, (req, res) => {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const dbFiles = listarBancosTenant();
    if (fsSync.existsSync(path.join(__dirname, '..', 'master.sqlite'))) {
      dbFiles.push(path.join(__dirname, '..', 'master.sqlite'));
    }
    let totalDbSize = 0;
    dbFiles.forEach(f => {
      try { totalDbSize += fsSync.statSync(f).size; } catch (e) { }
    });
    res.json({
      ok: true,
      status: {
        uptime: Math.floor(uptime),
        memoria: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal
        },
        disco: {
          arquivos_banco: dbFiles.length,
          tamanho_total: totalDbSize
        },
        node: process.version,
        plataforma: process.platform,
        pid: process.pid,
        dataHora: new Date().toISOString()
      }
    });
  });

  // POST /api/super/backup — criar backup de bancos de dados
  app.post('/api/super/backup', superAdminAuth, (req, res) => {
    try {
      const rootDir = path.join(__dirname, '..');
      const backupDir = path.join(rootDir, 'backups');
      if (!fsSync.existsSync(backupDir)) fsSync.mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const files = listarBancosTenant();
      if (fsSync.existsSync(path.join(rootDir, 'master.sqlite'))) files.push(path.join(rootDir, 'master.sqlite'));
      const copied = [];
      files.forEach(src => {
        const f = path.basename(src);
        const dst = path.join(backupDir, f.replace(/\.sqlite$|\.db$/, '_backup_' + timestamp + (f.endsWith('.sqlite') ? '.sqlite' : '.db')));
        try { fsSync.copyFileSync(src, dst); copied.push(path.relative(rootDir, src)); } catch (e) { }
      });
      res.json({ ok: true, mensagem: 'Backup criado com sucesso!', arquivos: copied, timestamp });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // GET /api/super/config-global — listar configurações globais
  app.get('/api/super/config-global', superAdminAuth, (req, res) => {
    masterDb.all("SELECT chave, valor FROM configuracoes_global", [], (err, rows) => {
      if (err) return res.json({ ok: true, configs: {} });
      const cfgs = {};
      (rows || []).forEach(r => { cfgs[r.chave] = r.valor; });
      res.json({ ok: true, configs: cfgs });
    });
  });

  // POST /api/super/config-global — salvar configurações globais
  app.post('/api/super/config-global', superAdminAuth, (req, res) => {
    const configs = req.body || {};
    if (!Object.keys(configs).length) return res.json({ ok: false, erro: 'Nenhuma configuração informada.' });
    masterDb.serialize(() => {
      Object.keys(configs).forEach(chave => {
        const valor = typeof configs[chave] === 'object' ? JSON.stringify(configs[chave]) : String(configs[chave]);
        masterDb.run("INSERT INTO configuracoes_global (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", [chave, valor]);
      });
    });
    res.json({ ok: true, mensagem: 'Configurações salvas com sucesso!' });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLIENTES (CRM GLOBAL)
  // ═══════════════════════════════════════════════════════════════

  // GET /api/super/clientes — lista clientes de todos os estabelecimentos
  app.get('/api/super/clientes', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT id, nome FROM restaurantes ORDER BY id`, [], (err, restaurantes) => {
      if (err) return res.json({ ok: false, erro: err.message });

      const restList = restaurantes || [];
      if (restList.length === 0) return res.json({ ok: true, clientes: [] });

      const todosClientes = [];
      let pendentes = restList.length;

      function finalizar() {
        todosClientes.sort((a, b) => a.restaurante_id - b.restaurante_id || String(a.nome).localeCompare(String(b.nome)));
        res.json({ ok: true, clientes: todosClientes });
      }

      restList.forEach(r => {
        const tenantDbPath = getTenantDbPath(r.id);
        if (!fsSync.existsSync(tenantDbPath)) {
          pendentes--;
          if (pendentes <= 0) finalizar();
          return;
        }

        const tDb = new sqlite3.Database(tenantDbPath, sqlite3.OPEN_READONLY, errOpen => {
          if (errOpen) {
            pendentes--;
            if (pendentes <= 0) finalizar();
            return;
          }

          tDb.all(`SELECT * FROM clientes ORDER BY nome`, [], (errC, rows) => {
            const clientes = (!errC && rows) || [];
            if (clientes.length === 0) {
              try { tDb.close(); } catch (e) { }
              pendentes--;
              if (pendentes <= 0) finalizar();
              return;
            }

            let subPendentes = clientes.length;
            clientes.forEach(c => {
              tDb.get(`SELECT COUNT(*) as total_pedidos, COALESCE(SUM(CAST(REPLACE(COALESCE(total,'0'), ',', '.') AS REAL)), 0) as total_gasto FROM pedidos WHERE cliente_id = ? AND status IN ('Finalizado','Pago','Entregue')`, [c.id], (errP, stats) => {
                todosClientes.push({
                  id: c.id,
                  restaurante_id: r.id,
                  restaurante_nome: r.nome,
                  nome: c.nome,
                  telefone: c.telefone,
                  endereco: c.endereco,
                  data_nascimento: c.data_nascimento,
                  observacao: c.observacao || '',
                  pontos: c.pontos || 0,
                  total_pedidos: stats ? stats.total_pedidos || 0 : 0,
                  total_gasto: stats ? stats.total_gasto || 0 : 0
                });
                subPendentes--;
                if (subPendentes <= 0) {
                  try { tDb.close(); } catch (e) { }
                  pendentes--;
                  if (pendentes <= 0) finalizar();
                }
              });
            });
          });
        });
      });
    });
  });

  // GET /api/super/restaurantes/:id/funcionarios
  app.get('/api/super/restaurantes/:id/funcionarios', superAdminAuth, (req, res) => {
    const restauranteId = parseInt(req.params.id) || 1;
    const tenantDbPath = getTenantDbPath(restauranteId);

    if (!fsSync.existsSync(tenantDbPath)) {
      return res.json({ ok: true, funcionarios: [], restaurante_id: restauranteId });
    }

    const tDb = new sqlite3.Database(tenantDbPath, sqlite3.OPEN_READONLY, (errOpen) => {
      if (errOpen) return res.json({ ok: false, erro: 'Erro ao abrir banco.' });

      tDb.all(`SELECT * FROM funcionarios ORDER BY nome`, [], (err, rows) => {
        try { tDb.close(); } catch (e) { }
        if (err) return res.json({ ok: false, erro: err.message });

        const seguros = (rows || []).map(f => ({
          id: f.id,
          nome: f.nome,
          usuario: f.usuario,
          cargo: f.cargo,
          status: f.status || 'Ativo',
          valor_hora: f.valor_hora || 0,
          tipo_remuneracao: f.tipo_remuneracao || 'hora',
          valor_dia: f.valor_dia || 0,
          valor_semana: f.valor_semana || 0,
          valor_mes: f.valor_mes || 0,
          chave_pix: f.chave_pix || '',
          cpf: f.cpf || '',
          telefone: f.telefone || '',
          observacao_rh: f.observacao_rh || ''
        }));

        res.json({ ok: true, funcionarios: seguros, restaurante_id: restauranteId });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FUNÇÕES POR TENANT / PLANO (economia de recursos do servidor)
  // ═══════════════════════════════════════════════════════════════

  // GET /api/super/features — lista features, planos e estado de cada tenant
  app.get('/api/super/features', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT id, nome, licenca, ativo FROM restaurantes ORDER BY id`, [], (err, rests) => {
      if (err) return res.json({ ok: false, erro: err.message });
      masterDb.all(`SELECT restaurante_id, overrides_json FROM tenant_features`, [], (err2, ovs) => {
        const ovMap = {};
        (ovs || []).forEach(o => {
          try { ovMap[o.restaurante_id] = JSON.parse(o.overrides_json) || {}; } catch (e) { ovMap[o.restaurante_id] = {}; }
        });
        const tenants = (rests || []).map(r => ({
          id: r.id,
          nome: r.nome,
          licenca: r.licenca || 'ativo',
          plano: featurePlans.planoParaChave(r.licenca),
          ativo: !!r.ativo,
          overrides: ovMap[r.id] || {},
          features: featurePlans.resolveFeatures(r.licenca, ovMap[r.id])
        }));
        res.json({ ok: true, features: featurePlans.FEATURES, planos: featurePlans.FEATURE_PLANS, tenants });
      });
    });
  });

  // POST /api/super/features — altera feature, reseta padrões ou muda o plano de um tenant
  app.post('/api/super/features', superAdminAuth, async (req, res) => {
    const body = req.body || {};
    const rid = parseInt(body.restaurante_id, 10);
    if (!rid) return res.json({ ok: false, erro: 'ID do restaurante é obrigatório.' });

    try {
      if (typeof body.licenca === 'string') {
        const lic = body.licenca.trim().toLowerCase();
        if (!['trial', 'pro', 'premium', 'plus', 'ativo'].includes(lic)) {
          return res.json({ ok: false, erro: 'Plano inválido. Use trial, pro ou premium.' });
        }
        await new Promise((resolve) => {
          masterDb.run(`UPDATE restaurantes SET licenca = ? WHERE id = ?`, [lic, rid], resolve);
        });
      }

      if (body.reset) {
        await new Promise((resolve) => {
          masterDb.run(`DELETE FROM tenant_features WHERE restaurante_id = ?`, [rid], resolve);
        });
      } else if (body.feature) {
        const conhecida = featurePlans.FEATURES.some(f => f.chave === body.feature);
        if (!conhecida) return res.json({ ok: false, erro: 'Feature desconhecida.' });
        const enabled = !!body.enabled;

        const existing = await new Promise((resolve) => {
          masterDb.get(`SELECT overrides_json FROM tenant_features WHERE restaurante_id = ?`, [rid], (e, row) => resolve(e ? null : row));
        });
        let overrides = {};
        if (existing && existing.overrides_json) {
          try { overrides = JSON.parse(existing.overrides_json) || {}; } catch (e) { overrides = {}; }
        }
        overrides[body.feature] = enabled;

        await new Promise((resolve) => {
          masterDb.run(
            `INSERT INTO tenant_features (restaurante_id, overrides_json, updated_at) VALUES (?, ?, datetime('now','localtime'))
             ON CONFLICT(restaurante_id) DO UPDATE SET overrides_json = excluded.overrides_json, updated_at = excluded.updated_at`,
            [rid, JSON.stringify(overrides)],
            resolve
          );
        });

        // Efeito imediato no runtime
        if (body.feature === 'ifood' && ifoodApi) {
          if (enabled) {
            if (ifoodDeps && typeof ifoodDeps.isFeatureEnabled === 'function') {
              ifoodApi.ensurePoller(rid, ifoodDeps);
            }
          } else {
            ifoodApi.stopPoller(rid);
          }
        }
      } else {
        return res.json({ ok: false, erro: 'Informe feature+enabled, reset ou licenca.' });
      }

      if (typeof loadAllTenantFeatures === 'function') {
        await loadAllTenantFeatures();
      }
      res.json({ ok: true, mensagem: 'Funções atualizadas com sucesso!' });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // PICO & CAPACIDADE DO SERVIDOR
  // ═══════════════════════════════════════════════════════════════

  // GET /api/super/capacidade — picos por hora + estimativa de tenants restantes
  app.get('/api/super/capacidade', superAdminAuth, async (req, res) => {
    try {
      const os = require('os');
      const mem = process.memoryUsage();
      const totalRamMB = Math.round(os.totalmem() / 1048576);
      const freeRamMB = Math.round(os.freemem() / 1048576);
      const processMB = Math.round(mem.rss / 1048576);

      const cfgs = await new Promise((resolve) => {
        masterDb.all(`SELECT chave, valor FROM configuracoes_global`, [], (err, rows) => {
          const m = {};
          (rows || []).forEach(r => { m[r.chave] = r.valor; });
          resolve(m);
        });
      });
      const ramPorTenantMB = parseInt(cfgs['capacidade_ram_tenant_mb'], 10) || 80;
      const maxTenantsHard = parseInt(cfgs['capacidade_max_tenants'], 10) || 0;

      const rests = await new Promise((resolve) => {
        masterDb.all(`SELECT id, nome, licenca, ativo FROM restaurantes ORDER BY id`, [], (e, r) => resolve(e ? [] : (r || [])));
      });
      const tenantsTotal = rests.length;
      const tenantsAtivos = rests.filter(r => r.ativo).length;

      let socketsAtivos = 0;
      const tenantsLoad = rests.map(r => {
        const c = (typeof metricSocketCount === 'function') ? (metricSocketCount(r.id) || 0) : 0;
        socketsAtivos += c;
        return { id: r.id, nome: r.nome, licenca: r.licenca || 'ativo', ativo: !!r.ativo, sockets: c };
      });

      // Heatmap: últimos 7 dias, pico de sockets por hora (0-23)
      const hoje = new Date();
      const diaIni = new Date(hoje.getTime() - 6 * 86400000);
      const pad = (n) => String(n).padStart(2, '0');
      const iniStr = `${diaIni.getFullYear()}-${pad(diaIni.getMonth() + 1)}-${pad(diaIni.getDate())}`;

      const picos = await new Promise((resolve) => {
        masterDb.all(`SELECT restaurante_id, dia, hora, sockets FROM metrica_picos WHERE dia >= ?`, [iniStr], (e, r) => resolve(e ? [] : (r || [])));
      });

      const horaMax = new Array(24).fill(0);
      const horaDias = new Array(24).fill(0);
      const diasSet = {};
      const tenantPico = {};
      (picos || []).forEach(p => {
        if (p.hora >= 0 && p.hora <= 23) {
          const h = p.hora;
          if (p.sockets > horaMax[h]) horaMax[h] = p.sockets;
          if (!diasSet[p.dia]) { diasSet[p.dia] = true; horaDias[h]++; }
          const tKey = String(p.restaurante_id);
          if (!tenantPico[tKey] || p.sockets > tenantPico[tKey].sockets) {
            tenantPico[tKey] = { hora: h, sockets: p.sockets };
          }
        }
      });
      const numDias = Math.max(1, Object.keys(diasSet).length);
      const heatmap = [];
      for (let h = 0; h < 24; h++) {
        heatmap.push({
          hora: h,
          sockets: horaMax[h],
          dias: horaDias[h]
        });
      }
      const tenantsHeat = tenantsLoad.map(t => Object.assign({}, t, tenantPico[String(t.id)] || { hora: null, sockets: 0 }));

      // Estimativa de capacidade
      const maxTenantsEstimado = Math.max(1, Math.floor((totalRamMB * 0.8) / ramPorTenantMB));
      const maxTenants = maxTenantsHard > 0 ? Math.min(maxTenantsHard, maxTenantsEstimado) : maxTenantsEstimado;
      const restantes = Math.max(0, maxTenants - tenantsAtivos);
      const percentual = maxTenants > 0 ? Math.round((tenantsAtivos / maxTenants) * 100) : 0;

      res.json({
        ok: true,
        server: {
          totalRamMB, freeRamMB, usedRamMB: totalRamMB - freeRamMB, processMB,
          socketsAtivos, tenantsTotal, tenantsAtivos,
          node: process.version, plataforma: process.platform,
          uptime: Math.floor(process.uptime())
        },
        capacidade: { maxTenants, ramPorTenantMB, restantes, percentual, maxTenantsHard },
        heatmap,
        tenants: tenantsHeat
      });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // DOMÍNIOS POR TENANT (subdomínio + domínio próprio)
  // ═══════════════════════════════════════════════════════════════

  // GET /api/super/dominios — lista domínios de todos os tenants
  app.get('/api/super/dominios', superAdminAuth, (req, res) => {
    masterDb.all(`SELECT id, nome, slug, custom_domain, licenca, ativo FROM restaurantes ORDER BY id`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      res.json({ ok: true, tenants: rows || [], baseDomain: options.baseDomain || 'chefcozinha.com.br' });
    });
  });

  // POST /api/super/dominios — define slug e/ou domínio próprio para um tenant
  app.post('/api/super/dominios', superAdminAuth, async (req, res) => {
    const body = req.body || {};
    const rid = parseInt(body.restaurante_id, 10);
    if (!rid) return res.json({ ok: false, erro: 'ID do restaurante é obrigatório.' });

    try {
      const slug = (body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const customDomain = (body.custom_domain || '').trim().toLowerCase();

      // Valida slug
      if (body.slug !== undefined && slug !== '') {
        if (slug.length < 2 || slug.length > 40) {
          return res.json({ ok: false, erro: 'Slug deve ter entre 2 e 40 caracteres (letras, números, hífen).' });
        }
        // Verifica unicidade
        const existing = await new Promise((resolve) => {
          masterDb.get(`SELECT id FROM restaurantes WHERE slug = ? AND id != ?`, [slug, rid], (e, r) => resolve(e ? null : r));
        });
        if (existing) return res.json({ ok: false, erro: 'Este slug já está em uso por outro restaurante.' });
      }

      // Valida domínio próprio
      if (body.custom_domain !== undefined && customDomain !== '') {
        if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(customDomain)) {
          return res.json({ ok: false, erro: 'Domínio inválido.' });
        }
        const existingDom = await new Promise((resolve) => {
          masterDb.get(`SELECT id FROM restaurantes WHERE custom_domain = ? AND id != ?`, [customDomain, rid], (e, r) => resolve(e ? null : r));
        });
        if (existingDom) return res.json({ ok: false, erro: 'Este domínio já está em uso por outro restaurante.' });
      }

      // Atualiza
      await new Promise((resolve, reject) => {
        masterDb.run(
          `UPDATE restaurantes SET slug = ?, custom_domain = ? WHERE id = ?`,
          [slug || null, customDomain || null, rid],
          function(err) { err ? reject(err) : resolve(); }
        );
      });

      // Recarrega mapas de domínios
      if (typeof options.reloadDomainMaps === 'function') {
        await options.reloadDomainMaps();
      }

      res.json({ ok: true, mensagem: 'Domínios atualizados com sucesso!', slug: slug || null, custom_domain: customDomain || null });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // DELETE /api/super/dominios — limpa slug e domínio de um tenant
  app.delete('/api/super/dominios', superAdminAuth, async (req, res) => {
    const body = req.body || {};
    const rid = parseInt(body.restaurante_id, 10);
    if (!rid) return res.json({ ok: false, erro: 'ID do restaurante é obrigatório.' });
    try {
      await new Promise((resolve, reject) => {
        masterDb.run(`UPDATE restaurantes SET slug = NULL, custom_domain = NULL WHERE id = ?`, [rid], function(err) { err ? reject(err) : resolve(); });
      });
      if (typeof options.reloadDomainMaps === 'function') {
        await options.reloadDomainMaps();
      }
      res.json({ ok: true, mensagem: 'Domínios removidos com sucesso!' });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // POST /api/super/exec — executar comando no servidor
  app.post('/api/super/exec', superAdminAuth, (req, res) => {
    const { command, restaurante_id } = req.body;
    if (!command || typeof command !== 'string') {
      return res.json({ ok: false, erro: 'Comando é obrigatório.' });
    }
    const timeout = 30000;
    exec(command, { cwd: path.join(__dirname, '..'), timeout }, (error, stdout, stderr) => {
      res.json({
        ok: !error,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error ? (error.code || 1) : 0,
        command: command.substring(0, 500)
      });
    });
  });
};
