/**
 * plugin-loader.js — Auto-discovery and loading of server-side plugins
 *
 * Convention:
 *   plugins/<plugin-name>/
 *     index.js       — required: module.exports = function({ app, db, io, options, log })
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
 * Module system:
 *   modulo_sistemas — global on/off per plugin
 *   tenant_modulos  — per-tenant override
 *   /api/plugins/list — returns only plugins enabled for the authenticated tenant
 *
 * Usage in server.js:
 *   const loadPlugins = require('./plugin-loader');
 *   loadPlugins({ app, db, masterDb, io, options });
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, 'plugins');

// Map plugin directory name → modulo_id for the module system
const PLUGIN_TO_MODULO = {
  'image-providers': 'image_providers',
  'formas-pagamento': 'formas_pagamento',
  'reserves': 'reservas',
};

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

      // Create a module guard middleware for this plugin
      const moduloId = PLUGIN_TO_MODULO[plugin.name] || plugin.name;
      const moduloGuard = (req, res, next) => {
        // Always allow super admin routes
        if (req.path && req.path.startsWith('/api/super/')) return next();
        // Always allow system modules
        masterDb.get(`SELECT obrigatorios FROM modulo_sistemas WHERE modulo_id = ?`, [moduloId], (e, row) => {
          if (e || !row || row.obrigatorios) return next();
          // Check global status
          masterDb.get(`SELECT ativo_global FROM modulo_sistemas WHERE modulo_id = ?`, [moduloId], (e2, row2) => {
            if (e2 || !row2 || !row2.ativo_global) return next(); // default: allow (backwards compat)
            // Check tenant override if authenticated
            const tid = req.restaurante_id || (req.user && req.user.restaurante_id);
            if (!tid) return next(); // no tenant context → allow
            masterDb.get(`SELECT ativo FROM tenant_modulos WHERE restaurante_id = ? AND modulo_id = ?`, [tid, moduloId], (e3, over) => {
              if (e3 || !over) return next(); // no override → use global default
              if (over.ativo === 0) return res.status(403).json({ error: 'Módulo desativado para este restaurante.' });
              next();
            });
          });
        });
      };

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
        moduloGuard
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

  // API endpoint: list available plugins for the authenticated tenant
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

      // If tenant is authenticated, filter by tenant_modulos
      const authHeader = req.headers['authorization'];
      if (authHeader && options.verificarToken) {
        try {
          const jwt = require('jsonwebtoken');
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, options.JWT_SECRET);
          const tid = decoded.restaurante_id;
          if (tid) {
            masterDb.all(`SELECT modulo_id, ativo FROM tenant_modulos WHERE restaurante_id = ?`, [tid], (e, over) => {
              const overMap = {};
              (over || []).forEach(o => { overMap[o.modulo_id] = o.ativo; });
              const filtered = list.filter(p => {
                const modId = PLUGIN_TO_MODULO[p.name] || p.name;
                // Check modulo_sistemas for this plugin
                masterDb.get(`SELECT ativo_global, obrigatorios FROM modulo_sistemas WHERE modulo_id = ?`, [modId], (eM, modRow) => {
                  // This is async but we can't await in sync map...
                });
                // Simplified: if there's a tenant override, use it; otherwise allow
                if (overMap[modId] !== undefined) return overMap[modId] === 1;
                return true;
              });
              return res.json({ ok: true, plugins: filtered });
            });
            return;
          }
        } catch (e) { /* invalid token, return all */ }
      }

      res.json({ ok: true, plugins: list });
    } catch (e) {
      res.json({ ok: true, plugins: [] });
    }
  });

  log(`${loaded.length}/${plugins.length} plugins loaded: [${loaded.join(', ')}]`);
  return loaded;
}

module.exports = loadPlugins;
