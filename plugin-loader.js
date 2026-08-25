/**
 * plugin-loader.js — Auto-discovery and loading of server-side plugins
 *
 * Convention:
 *   plugins/<plugin-name>/
 *     index.js       — required: module.exports = function({ app, db, io, options, log })
 *     routes.js      — optional: module.exports = function({ app, db, options })
 *     sockets.js     — optional: module.exports = function({ socket, db, io, options })
 *     package.json   — optional: { "name": "...", "description": "...", "order": 0 }
 *
 * Each plugin receives:
 *   app      — Express instance
 *   db       — tenant SQLite database (or masterDb for super-admin plugins)
 *   masterDb — master SQLite database
 *   io       — Socket.IO server instance
 *   options  — { JWT_SECRET, verificarToken, superAdminAuth, ... }
 *   log      — function(msg) that logs with plugin prefix
 *
 * Usage in server.js:
 *   const loadPlugins = require('./plugin-loader');
 *   loadPlugins({ app, db, masterDb, io, options });
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, 'plugins');

function loadPlugins({ app, db, masterDb, io, options }) {
  const log = (msg) => console.log(`[plugin-loader] ${msg}`);

  if (!fs.existsSync(PLUGINS_DIR)) {
    log('Plugins directory not found. Creating...');
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const pluginDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

  // Sort by order if specified in package.json, otherwise alphabetical
  const plugins = pluginDirs.map(dir => {
    const pluginPath = path.join(PLUGINS_DIR, dir.name);
    let order = 999;
    let meta = {};
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(pluginPath, 'package.json'), 'utf8'));
      order = pkg.order || 999;
      meta = pkg;
    } catch (e) { /* no package.json, that's fine */ }
    return { name: dir.name, path: pluginPath, order, meta };
  }).sort((a, b) => a.order - b.order);

  const loaded = [];

  for (const plugin of plugins) {
    try {
      const pluginLog = (msg) => console.log(`  [plugin:${plugin.name}] ${msg}`);

      // Serve static files from plugins/<name>/public/ if it exists
      const publicDir = path.join(plugin.path, 'public');
      if (fs.existsSync(publicDir) && fs.statSync(publicDir).isDirectory()) {
        app.use('/plugins/' + plugin.name, require('express').static(publicDir));
      }

      // Load index.js (main plugin file)
      const indexPath = path.join(plugin.path, 'index.js');
      if (!fs.existsSync(indexPath)) {
        pluginLog('WARN: No index.js found, skipping.');
        continue;
      }

      const pluginModule = require(indexPath);

      // Initialize the plugin
      const ctx = {
        app,
        db,
        masterDb,
        io,
        options,
        log: pluginLog,
        name: plugin.name,
        meta: plugin.meta
      };

      if (typeof pluginModule === 'function') {
        pluginModule(ctx);
        loaded.push(plugin.name);
        pluginLog(`Loaded (v${plugin.meta.version || '1.0.0'})`);
      } else {
        pluginLog('WARN: index.js does not export a function, skipping.');
      }
    } catch (err) {
      console.error(`  [plugin:${plugin.name}] ERROR loading: ${err.message}`);
    }
  }

  // API endpoint: list available plugins (used by client-side loader)
  app.get('/api/plugins/list', (req, res) => {
    try {
      const dirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.'));
      const list = dirs.map(d => {
        let meta = { name: d.name };
        try {
          meta = Object.assign(meta, JSON.parse(
            fs.readFileSync(path.join(PLUGINS_DIR, d.name, 'package.json'), 'utf8')
          ));
        } catch (e) { /* no package.json */ }
        return meta;
      });
      res.json({ ok: true, plugins: list });
    } catch (e) {
      res.json({ ok: true, plugins: [] });
    }
  });

  log(`${loaded.length}/${plugins.length} plugins loaded: [${loaded.join(', ')}]`);
  return loaded;
}

module.exports = loadPlugins;
