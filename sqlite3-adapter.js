'use strict';
const fs = require('fs');
const path = require('path');
let initSqlJs = require('sql.js');

let SQL = null;
const initPromise = initSqlJs().then(sql => {
  SQL = sql;
  return sql;
});

// Helper to normalize params: [1, 'a'] or { $a: 1 } or single value
function normalizeParams(params) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params;
  if (typeof params === 'object') return params;
  return [params];
}

class Database {
  constructor(filename, mode, callback) {
    if (typeof mode === 'function') {
      callback = mode;
      mode = null;
    }

    this.filename = filename || ':memory:';
    this.isOpen = false;
    this.db = null;
    this._queue = [];
    this._saving = false;

    const self = this;
    initPromise.then(sql => {
      try {
        let buffer = null;
        if (self.filename && self.filename !== ':memory:') {
          const dir = path.dirname(self.filename);
          if (!fs.existsSync(dir)) {
            try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
          }
          if (fs.existsSync(self.filename)) {
            try {
              buffer = fs.readFileSync(self.filename);
            } catch (e) {}
          }
        }
        self.db = buffer ? new sql.Database(buffer) : new sql.Database();
        self.isOpen = true;

        // Custom sqlite functions if any
        try {
          self.db.create_function('datetime', (val, mod) => {
            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          });
        } catch (e) {}

        if (typeof callback === 'function') callback(null);
        self._flushQueue();
      } catch (err) {
        if (typeof callback === 'function') callback(err);
      }
    }).catch(err => {
      if (typeof callback === 'function') callback(err);
    });
  }

  _persist() {
    if (!this.db || !this.filename || this.filename === ':memory:') return;
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      try {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.filename, buffer);
      } catch (e) {
        // Ignore persistence errors
      }
    }, 100);
  }

  _flushQueue() {
    while (this._queue.length > 0 && this.isOpen) {
      const task = this._queue.shift();
      task();
    }
  }

  _enqueue(task) {
    if (this.isOpen) {
      task();
    } else {
      this._queue.push(task);
    }
  }

  serialize(fn) {
    if (typeof fn === 'function') {
      fn();
    }
  }

  parallelize(fn) {
    if (typeof fn === 'function') {
      fn();
    }
  }

  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = normalizeParams(params);

    this._enqueue(() => {
      try {
        // Check if query contains PRAGMA or multi-statements or standard run
        let cleanedSql = sql.trim();
        // Ignore unsupported PRAGMAs gracefully
        if (/^PRAGMA\s+/i.test(cleanedSql)) {
          try {
            this.db.run(cleanedSql);
          } catch (e) {
            // Some PRAGMAs might not be supported in sql.js
          }
          if (typeof callback === 'function') callback.call({ lastID: 0, changes: 0 }, null);
          return;
        }

        // Execute statement
        this.db.run(cleanedSql, params);
        
        let lastID = 0;
        let changes = 0;
        try {
          const res = this.db.exec("SELECT last_insert_rowid() as id, changes() as ch");
          if (res && res[0] && res[0].values && res[0].values[0]) {
            lastID = res[0].values[0][0];
            changes = res[0].values[0][1];
          }
        } catch (e) {}

        this._persist();
        if (typeof callback === 'function') {
          callback.call({ lastID, changes }, null);
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback.call({ lastID: 0, changes: 0 }, err);
        } else {
          console.warn('[SQLite-Adapter] Run Error:', err.message, 'SQL:', sql);
        }
      }
    });
    return this;
  }

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = normalizeParams(params);

    this._enqueue(() => {
      try {
        const stmt = this.db.prepare(sql);
        if (params && params.length) stmt.bind(params);
        let row = undefined;
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
        stmt.free();
        if (typeof callback === 'function') {
          callback(null, row);
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback(err, undefined);
        }
      }
    });
    return this;
  }

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = normalizeParams(params);

    this._enqueue(() => {
      try {
        const stmt = this.db.prepare(sql);
        if (params && params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        if (typeof callback === 'function') {
          callback(null, rows);
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback(err, []);
        }
      }
    });
    return this;
  }

  each(sql, params, callback, completeCallback) {
    if (typeof params === 'function') {
      completeCallback = callback;
      callback = params;
      params = [];
    }
    this.all(sql, params, (err, rows) => {
      if (err) {
        if (typeof completeCallback === 'function') completeCallback(err);
      } else {
        if (typeof callback === 'function') {
          rows.forEach((row, i) => callback(null, row));
        }
        if (typeof completeCallback === 'function') completeCallback(null, rows.length);
      }
    });
    return this;
  }

  exec(sql, callback) {
    this._enqueue(() => {
      try {
        this.db.exec(sql);
        this._persist();
        if (typeof callback === 'function') callback(null);
      } catch (err) {
        if (typeof callback === 'function') callback(err);
      }
    });
    return this;
  }

  close(callback) {
    this._enqueue(() => {
      try {
        if (this.db) {
          const data = this.db.export();
          if (this.filename && this.filename !== ':memory:') {
            fs.writeFileSync(this.filename, Buffer.from(data));
          }
          this.db.close();
        }
        this.isOpen = false;
        if (typeof callback === 'function') callback(null);
      } catch (err) {
        if (typeof callback === 'function') callback(err);
      }
    });
  }
}

const sqlite3Adapter = {
  Database,
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4,
  verbose: () => sqlite3Adapter
};

module.exports = sqlite3Adapter;
