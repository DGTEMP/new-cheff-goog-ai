const crypto = require('crypto');

function ensureTable(db) {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS instance_identity (
      key TEXT PRIMARY KEY,
      value TEXT
    )`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function get(db, key) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM instance_identity WHERE key = ?`, [key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value : null);
    });
  });
}

function set(db, key, value) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT OR REPLACE INTO instance_identity (key, value) VALUES (?, ?)`, [key, value], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getAll(db) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT key, value FROM instance_identity`, [], (err, rows) => {
      if (err) reject(err);
      else {
        const map = {};
        (rows || []).forEach(r => { map[r.key] = r.value; });
        resolve(map);
      }
    });
  });
}

async function getOrCreateInstanceId(db) {
  await ensureTable(db);
  let id = await get(db, 'instance_id');
  if (!id) {
    id = crypto.randomUUID();
    await set(db, 'instance_id', id);
  }
  return id;
}

async function initializeIdentity(db, softwareVersion, tenantId) {
  await ensureTable(db);
  const instanceId = await getOrCreateInstanceId(db);
  await set(db, 'software_version', softwareVersion);
  await set(db, 'tenant_id', String(tenantId || ''));
  await set(db, 'registered_at', await get(db, 'registered_at') || new Date().toISOString());
  return instanceId;
}

module.exports = {
  ensureTable,
  get,
  set,
  getAll,
  getOrCreateInstanceId,
  initializeIdentity
};
