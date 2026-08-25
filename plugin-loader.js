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
    return [];
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

      // Load index.js (main plugin file)
      const indexPath = path.join(plugin.path, 'index.js');
      if (!fs.existsSync(indexPath)) {
        pluginLog('WARN: No index.js found, skipping.');
        continue;
      }

      const pluginModule = require(indexPath);

      // Load routes.js if exists
      let routesFn = null;
      const routesPath = path.join(plugin.path, 'routes.js');
      if (fs.existsSync(routesPath)) {
        routesFn = require(routesPath);
      }

      // Load sockets.js if exists
      let socketsFn = null;
      const socketsPath = path.join(plugin.path, 'sockets.js');
      if (fs.existsSync(socketsPath)) {
        socketsFn = require(socketsPath);
      }

      // Initialize the plugin
      const ctx = {
        app,
        db,
        masterDb,
        io,
        options,
        log: pluginLog,
        name: plugin.name,
        meta: plugin.meta,
        routes: routesFn,
        sockets: socketsFn
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

  log(`${loaded.length}/${plugins.length} plugins loaded: [${loaded.join(', ')}]`);
  return loaded;
}

/**
 * Register socket handlers for a connected client from all plugins that have sockets.js
 */
function registerSocketHandlers({ socket, db, masterDb, io, options }) {
  if (!fs.existsSync(PLUGINS_DIR)) return;

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const pluginDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

  for (const dir of pluginDirs) {
    try {
      const socketsPath = path.join(PLUGINS_DIR, dir.name, 'sockets.js');
      if (!fs.existsSync(socketsPath)) continue;

      const socketsFn = require(socketsPath);
      if (typeof socketsFn === 'function') {
        socketsFn({ socket, db, masterDb, io, options, name: dir.name });
      }
    } catch (err) {
      console.error(`  [plugin:${dir.name}] ERROR registering sockets: ${err.message}`);
    }
  }
}

module.exports = loadPlugins;
module.exports.registerSocketHandlers = registerSocketHandlers;
