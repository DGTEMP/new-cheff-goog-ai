import re

def patch_server():
    with open('server.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Inject AsyncLocalStorage at the top
    if 'AsyncLocalStorage' not in content:
        content = re.sub(
            r"(const sqlite3 = require\('sqlite3'\).verbose\(\);)",
            r"\1\nconst { AsyncLocalStorage } = require('async_hooks');\nconst tenantContext = new AsyncLocalStorage();\nconst jwt = require('jsonwebtoken');\nconst fsSync = require('fs');",
            content
        )

    # 2. Replace the db declaration
    proxy_code = """
// --- MULTI-TENANT PROXY DB ---
const masterDb = new sqlite3.Database(path.join(__dirname, 'master.sqlite'));
const tenantDbs = new Map();

function getTenantDb() {
  const tenantId = tenantContext.getStore() || 1;
  if (!tenantDbs.has(tenantId)) {
    const dbPath = path.join(__dirname, `database_${tenantId}.sqlite`);
    
    // Se o banco no existir, copia do template vazio ou do banco 1
    if (!fsSync.existsSync(dbPath)) {
       if (fsSync.existsSync(path.join(__dirname, 'database_1.sqlite'))) {
           fsSync.copyFileSync(path.join(__dirname, 'database_1.sqlite'), dbPath);
       }
    }
    
    const newDb = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error(`Erro ao abrir banco do tenant ${tenantId}:`, err);
    });
    
    // Configura o banco
    newDb.run('PRAGMA journal_mode = WAL;');
    tenantDbs.set(tenantId, newDb);
  }
  return tenantDbs.get(tenantId);
}

const db = {
  run: function(...args) { return getTenantDb().run(...args); },
  all: function(...args) { return getTenantDb().all(...args); },
  get: function(...args) { return getTenantDb().get(...args); },
  serialize: function(cb) { 
      // Executa o serialize no contexto atual
      return getTenantDb().serialize(cb);
  },
  close: function(...args) { return getTenantDb().close(...args); }
};
// ------------------------------
"""
    
    # We need to find the old db declaration and replace it
    # const dbPath = path.join(__dirname, 'database.sqlite');
    # let db = new sqlite3.Database(dbPath, (err) => { ... });
    old_db_regex = r"const dbPath = path\.join\(__dirname, 'database\.sqlite'\);\s*let db = new sqlite3\.Database\(dbPath, \(err\) => \{[\s\S]*?\}\);"
    
    content = re.sub(old_db_regex, proxy_code, content)
    
    # 3. Patch API Auth Routes to use masterDb
    content = content.replace("db.run(`INSERT INTO restaurantes", "masterDb.run(`INSERT INTO restaurantes")
    content = content.replace("db.run(`INSERT INTO usuarios", "masterDb.run(`INSERT INTO usuarios")
    content = content.replace("db.run(`DELETE FROM restaurantes", "masterDb.run(`DELETE FROM restaurantes")
    content = content.replace("db.get(`SELECT u.*, r.ativo as r_ativo", "masterDb.get(`SELECT u.*, r.ativo as r_ativo")
    
    # 4. Patch Socket connection to extract token and wrap in context
    socket_regex = r"(io\.on\('connection', \(socket\) => \{)"
    socket_patch = """\\1
  const token = socket.handshake.query.token;
  let socketTenantId = 1;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'Z2VtaW5pX2NoZWZfY296aW5oYV9zZWNyZXRfa2V5');
      socketTenantId = decoded.restaurante_id;
    } catch(e) {}
  }
  
  socket.restaurante_id = socketTenantId;
  socket.join(`restaurante_${socketTenantId}`);
  
  // Wrap all socket events in tenant context!
  const originalOn = socket.on.bind(socket);
  socket.on = function(eventName, callback) {
    originalOn(eventName, (...args) => {
      tenantContext.run(socketTenantId, () => {
        callback(...args);
      });
    });
  };
"""
    content = re.sub(socket_regex, socket_patch, content)
    
    # 5. We also need to patch Express middleware for API requests that don't have token but rely on session?
    # Actually, the API routes are already protected by `verificarToken`. Let's update `verificarToken` to wrap the `next()` in tenantContext.
    # Because replace is tricky with multi-line, let's just do it directly.
    content = content.replace(
        "req.user_role = decoded.role;\n    next();",
        "req.user_role = decoded.role;\n    tenantContext.run(decoded.restaurante_id, () => {\n      next();\n    });"
    )

    with open('server.js', 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("server.js patched successfully.")

patch_server()
