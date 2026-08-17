const SYNCABLE_TABLES = [
  'produtos', 'configuracoes', 'clientes', 'funcionarios',
  'mesas', 'promocoes', 'cupons', 'formas_pagamento'
];

const TABLE_PATTERN = new RegExp(
  '(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+(\\w+)',
  'i'
);

function extractTableName(sql) {
  if (!sql || typeof sql !== 'string') return null;
  const m = sql.match(TABLE_PATTERN);
  if (!m) return null;
  const table = m[1].toLowerCase();
  return SYNCABLE_TABLES.includes(table) ? table : null;
}

function extractRowId(result, sql) {
  if (result && typeof result.lastID === 'number' && result.lastID > 0) {
    return result.lastID;
  }
  return null;
}

function createSyncProxy(db, syncOutboxFn) {
  if (!db || !syncOutboxFn) return db;

  const origRun = db.run.bind(db);

  db.run = function (...args) {
    const sql = typeof args[0] === 'string' ? args[0] : '';
    const tableName = extractTableName(sql);
    const params = args.length > 1 && Array.isArray(args[1]) ? args[1] : [];
    const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;

    if (!tableName) {
      return origRun(...args);
    }

    const wrappedCallback = function (err) {
      if (err) {
        if (callback) return callback.call(this, err);
        return;
      }

      try {
        const operation = sql.trim().toUpperCase().startsWith('INSERT') ? 'INSERT'
          : sql.trim().toUpperCase().startsWith('UPDATE') ? 'UPDATE'
          : sql.trim().toUpperCase().startsWith('DELETE') ? 'DELETE'
          : 'UNKNOWN';

        const payload = {
          table: tableName,
          operation,
          row_id: extractRowId(this, sql),
          sql_template: sql.replace(/\s+/g, ' ').substring(0, 500),
          timestamp: new Date().toISOString()
        };

        syncOutboxFn(tableName, payload);
      } catch (syncErr) {
        console.error('[DB Proxy] Erro ao enfileirar sync:', syncErr.message);
      }

      if (callback) return callback.call(this);
    };

    const newArgs = [...args];
    if (callback) {
      newArgs[newArgs.length - 1] = wrappedCallback;
    } else {
      newArgs.push(wrappedCallback);
    }

    return origRun(...newArgs);
  };

  return db;
}

module.exports = {
  createSyncProxy,
  SYNCABLE_TABLES,
  extractTableName
};
