const crypto = require('crypto');

let ctx = {};
let connectedInstances = new Map();
let offlineDetectorInterval = null;

function hmacSign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function generateCommandId() {
  return 'cmd_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    ctx.masterDb.run(sql, params || [], function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    ctx.masterDb.get(sql, params || [], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    ctx.masterDb.all(sql, params || [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function startOfflineDetector() {
  if (offlineDetectorInterval) clearInterval(offlineDetectorInterval);
  offlineDetectorInterval = setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 90000).toISOString();
      await dbRun(
        `UPDATE instance_registry SET status = 'offline' WHERE last_heartbeat_at < ? AND status = 'online'`,
        [cutoff]
      );
    } catch (e) {
      console.error('[Sync Server] Erro no offline detector:', e.message);
    }
  }, 60000);
}

async function handleRegistration(instanceData, socket) {
  const { instance_id, tenant_id, instance_name, software_version, os_info, secret } = instanceData;
  if (!instance_id) return { error: 'instance_id obrigatório' };

  const existing = await dbGet(`SELECT * FROM instance_registry WHERE instance_id = ?`, [instance_id]);

  if (existing) {
    await dbRun(
      `UPDATE instance_registry SET status = 'online', last_heartbeat_at = datetime('now','localtime'),
       software_version = ?, os_info = ?, ip_address = ? WHERE instance_id = ?`,
      [software_version || existing.software_version, os_info || existing.os_info, socket.handshake.address, instance_id]
    );
  } else {
    await dbRun(
      `INSERT INTO instance_registry (instance_id, tenant_id, instance_name, software_version, os_info, ip_address, status)
       VALUES (?, ?, ?, ?, ?, ?, 'online')`,
      [instance_id, tenant_id || null, instance_name || 'On-Premise', software_version || '1.0.0', os_info || '', socket.handshake.address]
    );
  }

  return { ok: true, registered: true };
}

async function handleHeartbeat(instanceId, data) {
  if (!instanceId) return;
  try {
    await dbRun(
      `UPDATE instance_registry SET status = 'online', last_heartbeat_at = datetime('now','localtime'),
       software_version = COALESCE(?, software_version) WHERE instance_id = ?`,
      [data.software_version, instanceId]
    );
    connectedInstances.set(instanceId, {
      lastHeartbeat: Date.now(),
      data
    });
  } catch (e) {
    console.error('[Sync Server] Erro ao processar heartbeat:', e.message);
  }
}

async function processDataPush(instanceId, payload) {
  if (!instanceId || !payload) return;
  try {
    await dbRun(
      `UPDATE instance_registry SET last_sync_at = datetime('now','localtime') WHERE instance_id = ?`,
      [instanceId]
    );
    console.log(`[Sync Server] Data push recebido de ${instanceId}: ${payload.table || 'unknown'}`);
  } catch (e) {
    console.error('[Sync Server] Erro ao processar data_push:', e.message);
  }
}

async function processMetrics(instanceId, data) {
  if (!instanceId) return;
  try {
    const existing = await dbGet(
      `SELECT id FROM metrica_picos WHERE restaurante_id = (SELECT tenant_id FROM instance_registry WHERE instance_id = ?) AND dia = date('now','localtime') AND hora = CAST(strftime('%H','now','localtime') AS INTEGER)`,
      [instanceId]
    );
    if (existing) {
      await dbRun(
        `UPDATE metrica_picos SET sockets = ? WHERE id = ?`,
        [data.connected_clients || 0, existing.id]
      );
    }
  } catch (e) {
    console.error('[Sync Server] Erro ao processar métricas:', e.message);
  }
}

async function queueCommand(instanceId, command, params, issuedBy) {
  const commandId = generateCommandId();

  await dbRun(
    `INSERT INTO remote_commands (instance_id, command, params, issued_by, status) VALUES (?, ?, ?, ?, 'pending')`,
    [instanceId, command, JSON.stringify(params || {}), issuedBy || 'super_admin']
  );

  await dbRun(
    `INSERT INTO sync_queue (instance_id, message_type, payload, priority, status) VALUES (?, 'command', ?, ?, 'pending')`,
    [instanceId, JSON.stringify({ command_id: commandId, command, params: params || {} }), command === 'deactivate' ? 1 : 5]
  );

  return commandId;
}

async function pushConfig(instanceId, configs, issuedBy) {
  return queueCommand(instanceId, 'push_config', { configs }, issuedBy);
}

async function pushPlan(instanceId, plan, features, validade, issuedBy) {
  return queueCommand(instanceId, 'update_plan', { plan, features, validade }, issuedBy);
}

function initialize(deps) {
  ctx = deps;

  const syncNsp = ctx.io.of('/sync');

  syncNsp.use((socket, next) => {
    const { instance_id, secret } = socket.handshake.auth || {};
    if (!instance_id || !secret) {
      return next(new Error('Autenticação obrigatória'));
    }
    socket.instanceId = instance_id;
    next();
  });

  syncNsp.on('connection', (socket) => {
    const instanceId = socket.instanceId;
    console.log(`[Sync Server] Instância conectada: ${instanceId}`);

    socket.on('instance:register', async (msg) => {
      const result = await handleRegistration(msg.payload || msg, socket);
      socket.emit('server:sync_ack', { type: 'register', result });
    });

    socket.on('instance:heartbeat', async (msg) => {
      await handleHeartbeat(instanceId, msg.payload || {});
    });

    socket.on('instance:data_push', async (msg) => {
      await processDataPush(instanceId, msg.payload);
      socket.emit('server:sync_ack', { msg_id: msg.msg_id, status: 'received' });
    });

    socket.on('instance:metrics', async (msg) => {
      await processMetrics(instanceId, msg.payload || {});
    });

    socket.on('instance:command_ack', async (msg) => {
      if (msg && msg.payload && msg.payload.command_id) {
        const { command_id, status, result } = msg.payload;
        try {
          await dbRun(
            `UPDATE remote_commands SET status = ?, result = ?, acknowledged_at = datetime('now','localtime') WHERE instance_id = ? AND command = ? AND status = 'pending'`,
            [status || 'completed', JSON.stringify(result || {}), instanceId, command_id]
          );
          await dbRun(
            `UPDATE sync_queue SET status = 'acked', acked_at = datetime('now','localtime') WHERE instance_id = ? AND message_type = 'command' AND status IN ('pending', 'sent')`,
            [instanceId]
          );
        } catch (e) {
          console.error('[Sync Server] Erro ao processar command_ack:', e.message);
        }
      }
    });

    socket.on('instance:sync_request', async (msg) => {
      try {
        const pending = await dbAll(
          `SELECT * FROM sync_queue WHERE instance_id = ? AND status IN ('pending') ORDER BY priority ASC, id ASC`,
          [instanceId]
        );
        for (const item of pending) {
          socket.emit('server:command', {
            msg_id: item.id,
            type: 'command',
            payload: JSON.parse(item.payload)
          });
          await dbRun(
            `UPDATE sync_queue SET status = 'sent', sent_at = datetime('now','localtime') WHERE id = ?`,
            [item.id]
          );
        }
      } catch (e) {
        console.error('[Sync Server] Erro ao processar sync_request:', e.message);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`[Sync Server] Instância desconectada: ${instanceId}`);
      connectedInstances.delete(instanceId);
      try {
        await dbRun(
          `UPDATE instance_registry SET status = 'offline' WHERE instance_id = ?`,
          [instanceId]
        );
      } catch (e) {}
    });
  });

  startOfflineDetector();

  // ── HTTP FALLBACK ENDPOINTS ──────────────────────────────────────
  // On-premise instances use these when WebSocket is unavailable.

  if (ctx.app && ctx.app.post) {
    // POST /api/sync/register — instance registration via HTTP
    ctx.app.post('/api/sync/register', (req, res) => {
      const { instance_id, tenant_id, instance_name, software_version, os_info, secret } = req.body;
      if (!instance_id) return res.status(400).json({ ok: false, error: 'instance_id obrigatório' });

      dbGet(`SELECT * FROM instance_registry WHERE instance_id = ?`, [instance_id], (err, existing) => {
        if (existing) {
          dbRun(
            `UPDATE instance_registry SET status = 'online', last_heartbeat_at = datetime('now','localtime'),
             software_version = ?, os_info = ?, ip_address = ? WHERE instance_id = ?`,
            [software_version || existing.software_version, os_info || existing.os_info, req.ip, instance_id]
          ).then(() => {
            res.json({ ok: true, registered: true, instance_id });
          }).catch(e => {
            res.status(500).json({ ok: false, error: e.message });
          });
        } else {
          dbRun(
            `INSERT INTO instance_registry (instance_id, tenant_id, instance_name, software_version, os_info, ip_address, status)
             VALUES (?, ?, ?, ?, ?, ?, 'online')`,
            [instance_id, tenant_id || null, instance_name || 'On-Premise', software_version || '1.0.0', os_info || '', req.ip]
          ).then(() => {
            res.json({ ok: true, registered: true, instance_id });
          }).catch(e => {
            res.status(500).json({ ok: false, error: e.message });
          });
        }
      });
    });

    // GET /api/sync/poll — on-premise polls for pending commands/data
    ctx.app.get('/api/sync/poll', (req, res) => {
      const { instance_id, ts, sig } = req.query;
      if (!instance_id) return res.status(400).json({ ok: false, error: 'instance_id obrigatório' });

      dbRun(
        `UPDATE instance_registry SET status = 'online', last_heartbeat_at = datetime('now','localtime') WHERE instance_id = ?`,
        [instance_id]
      ).catch(() => {});

      dbAll(
        `SELECT id as command_id, command, params FROM sync_queue WHERE instance_id = ? AND status = 'pending' ORDER BY priority ASC, id ASC LIMIT 20`,
        [instance_id]
      ).then(rows => {
        const commands = rows.map(r => ({
          command_id: r.command_id,
          command: r.command,
          params: r.params ? JSON.parse(r.params) : {}
        }));
        res.json({ ok: true, commands });
      }).catch(e => {
        res.status(500).json({ ok: false, error: e.message });
      });
    });

    // POST /api/sync/push — on-premise pushes data up
    ctx.app.post('/api/sync/push', (req, res) => {
      const { instance_id, message_type, payload } = req.body;
      if (!instance_id) return res.status(400).json({ ok: false, error: 'instance_id obrigatório' });

      dbRun(
        `UPDATE instance_registry SET last_sync_at = datetime('now','localtime') WHERE instance_id = ?`,
        [instance_id]
      ).catch(() => {});

      console.log(`[Sync Server] HTTP push de ${instance_id}: ${message_type || 'unknown'}`);
      res.json({ ok: true, received: true });
    });

    // POST /api/sync/ack — on-premise acknowledges command execution
    ctx.app.post('/api/sync/ack', (req, res) => {
      const { instance_id, command_id, status, result } = req.body;
      if (!instance_id || !command_id) return res.status(400).json({ ok: false, error: 'instance_id e command_id obrigatórios' });

      dbRun(
        `UPDATE remote_commands SET status = ?, result = ?, acknowledged_at = datetime('now','localtime') WHERE instance_id = ? AND id = ?`,
        [status || 'completed', JSON.stringify(result || {}), instance_id, command_id]
      ).then(() => {
        dbRun(
          `UPDATE sync_queue SET status = 'acked', acked_at = datetime('now','localtime') WHERE instance_id = ? AND message_type = 'command' AND status IN ('pending', 'sent')`,
          [instance_id]
        );
        res.json({ ok: true, acked: true });
      }).catch(e => {
        res.status(500).json({ ok: false, error: e.message });
      });
    });
  }

  console.log('[Sync Server] Inicializado. Namespace /sync + HTTP fallback ativos.');
}

async function getAllInstances() {
  return dbAll(`SELECT * FROM instance_registry ORDER BY last_heartbeat_at DESC`);
}

async function getInstance(instanceId) {
  return dbGet(`SELECT * FROM instance_registry WHERE instance_id = ?`, [instanceId]);
}

async function getPendingCommands(instanceId) {
  return dbAll(
    `SELECT * FROM remote_commands WHERE instance_id = ? AND status IN ('pending', 'acknowledged') ORDER BY issued_at DESC`,
    [instanceId]
  );
}

async function getSyncConflicts(instanceId, limit) {
  const l = limit || 50;
  return dbAll(
    `SELECT * FROM sync_conflicts WHERE instance_id = ? ORDER BY resolved_at DESC LIMIT ?`,
    [instanceId, l]
  );
}

async function getSyncQueue(instanceId) {
  return dbAll(
    `SELECT * FROM sync_queue WHERE instance_id = ? ORDER BY created_at DESC LIMIT 100`,
    [instanceId]
  );
}

module.exports = {
  initialize,
  queueCommand,
  pushConfig,
  pushPlan,
  getAllInstances,
  getInstance,
  getPendingCommands,
  getSyncConflicts,
  getSyncQueue,
  getConnectedInstances: () => connectedInstances
};
