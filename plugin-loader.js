/**
 * plugin-loader.js — Auto-discovery and loading of server-side plugins & modular extensions
 *
 * Convention:
 *   plugins/<plugin-name>/
 *     module.json    — manifest: { id, name, version, icon, description, targets, hooks: { server, client, widget, style } }
 *     index.js       — required for backend: module.exports = function({ app, db, io, options, log })
 *     client.js      — optional frontend injection script
 *     widget.js      — optional Caixa v1.1 widget script
 *     style.css      — optional styles
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, 'plugins');
const MODULES_CONFIG_FILE = path.join(__dirname, 'chef-modules.json');

// Map plugin directory name → modulo_id for the module system
const PLUGIN_TO_MODULO = {
  'image-providers': 'image_providers',
  'formas-pagamento': 'formas_pagamento',
  'reserves': 'reservas',
};

function createGuardedApp(app, moduloGuard) {
  const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

  return new Proxy(app, {
    get(target, prop, receiver) {
      if (HTTP_METHODS.includes(prop)) {
        return function guardedRoute(method, ...handlers) {
          return target[prop](method, moduloGuard, ...handlers);
        };
      }
      if (prop === 'use') {
        return function guardedUse(...args) {
          if (args.length >= 2 && typeof args[0] === 'string') {
            return target.use(args[0], moduloGuard, ...args.slice(1));
          }
          return target.use(moduloGuard, ...args);
        };
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  });
}

function loadModulesConfig() {
  if (fs.existsSync(MODULES_CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(MODULES_CONFIG_FILE, 'utf8'));
    } catch(e) {
      console.warn('[plugin-loader] Erro ao ler chef-modules.json, usando padrão.');
    }
  }
  return { enabledModules: {}, order: [] };
}

function saveModulesConfig(cfg) {
  try {
    fs.writeFileSync(MODULES_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch(e) {
    console.error('[plugin-loader] Erro ao salvar chef-modules.json:', e);
  }
}

function loadPlugins({ app, db, masterDb, io, options }) {
  const log = (msg) => console.log(`[plugin-loader] ${msg}`);

  if (!fs.existsSync(PLUGINS_DIR)) {
    log('Plugins directory not found. Creating...');
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  const modulesConfig = loadModulesConfig();

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const pluginDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

  const discoveredPlugins = [];

  for (const dir of pluginDirs) {
    const pluginPath = path.join(PLUGINS_DIR, dir.name);
    let manifest = {
      id: dir.name,
      name: dir.name,
      version: '1.0.0',
      description: '',
      category: 'geral',
      icon: 'ph-puzzle-piece',
      enabled: true,
      targets: ['all'],
      hooks: {}
    };

    // Check module.json first, then package.json
    const moduleJsonPath = path.join(pluginPath, 'module.json');
    const pkgJsonPath = path.join(pluginPath, 'package.json');

    if (fs.existsSync(moduleJsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
        manifest = Object.assign(manifest, parsed);
      } catch(e) {}
    } else if (fs.existsSync(pkgJsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        manifest = Object.assign(manifest, parsed);
      } catch(e) {}
    }

    // Auto-detect hooks if not explicitly specified
    if (!manifest.hooks) manifest.hooks = {};
    if (fs.existsSync(path.join(pluginPath, 'index.js')) && !manifest.hooks.server) manifest.hooks.server = 'index.js';
    if (fs.existsSync(path.join(pluginPath, 'client.js')) && !manifest.hooks.client) manifest.hooks.client = 'client.js';
    if (fs.existsSync(path.join(pluginPath, 'widget.js')) && !manifest.hooks.widget) manifest.hooks.widget = 'widget.js';
    if (fs.existsSync(path.join(pluginPath, 'style.css')) && !manifest.hooks.style) manifest.hooks.style = 'style.css';

    // Override with central config if specified
    if (modulesConfig.enabledModules[manifest.id] !== undefined) {
      manifest.enabled = !!modulesConfig.enabledModules[manifest.id];
    } else {
      modulesConfig.enabledModules[manifest.id] = manifest.enabled !== false;
    }

    discoveredPlugins.push({
      dirName: dir.name,
      path: pluginPath,
      manifest: manifest
    });
  }

  saveModulesConfig(modulesConfig);

  const loaded = [];

  for (const plugin of discoveredPlugins) {
    if (plugin.manifest.enabled === false) {
      log(`Módulo [${plugin.manifest.id}] está DESATIVADO no chef-modules.json.`);
      continue;
    }

    try {
      const pluginLog = (msg) => console.log(`  [plugin:${plugin.manifest.id}] ${msg}`);

      // Serve static assets directly from plugin root so client.js, widget.js, style.css are accessible
      const express = require('express');
      app.use('/plugins/' + plugin.dirName, express.static(plugin.path));

      // Load server hook if present
      if (plugin.manifest.hooks && plugin.manifest.hooks.server) {
        const indexPath = path.join(plugin.path, plugin.manifest.hooks.server);
        if (fs.existsSync(indexPath)) {
          const pluginModule = require(indexPath);

          const moduloId = PLUGIN_TO_MODULO[plugin.manifest.id] || plugin.manifest.id;
          const moduloGuard = (req, res, next) => {
            if (req.path && req.path.startsWith('/api/super/')) return next();
            if (!masterDb) return next();
            masterDb.get(`SELECT obrigatorios FROM modulo_sistemas WHERE modulo_id = ?`, [moduloId], (e, row) => {
              if (e || !row || row.obrigatorios) return next();
              masterDb.get(`SELECT ativo_global FROM modulo_sistemas WHERE modulo_id = ?`, [moduloId], (e2, row2) => {
                if (e2 || !row2 || !row2.ativo_global) return next();
                const tid = req.restaurante_id || (req.user && req.user.restaurante_id);
                if (!tid) return next();
                masterDb.get(`SELECT ativo FROM tenant_modulos WHERE restaurante_id = ? AND modulo_id = ?`, [tid, moduloId], (e3, over) => {
                  if (e3 || !over) return next();
                  if (over.ativo === 0) return res.status(403).json({ error: 'Módulo desativado para este restaurante.' });
                  next();
                });
              });
            });
          };

          const guardedApp = createGuardedApp(app, moduloGuard);

          const ctx = {
            app: guardedApp,
            db,
            masterDb,
            io,
            options,
            log: pluginLog,
            name: plugin.manifest.id,
            meta: plugin.manifest,
            moduloGuard
          };

          if (typeof pluginModule === 'function') {
            pluginModule(ctx);
            loaded.push(plugin.manifest.id);
            pluginLog(`Backend carregado com sucesso (v${plugin.manifest.version || '1.0.0'})`);
          }
        }
      }
    } catch (err) {
      console.error(`  [plugin:${plugin.manifest.id}] ERRO ao carregar: ${err.message}`);
    }
  }

  // Endpoint: Retorna lista de módulos ativos para o Frontend (auto-discovery)
  app.get('/api/modules/active', (req, res) => {
    try {
      const active = discoveredPlugins
        .filter(p => p.manifest.enabled !== false)
        .map(p => ({
          ...p.manifest,
          dirName: p.dirName
        }));
      res.json({ sucesso: true, modules: active });
    } catch (err) {
      res.status(500).json({ sucesso: false, error: err.message });
    }
  });

  // Endpoint: Retorna TODOS os módulos (para a Central de Desenvolvimento e Suporte)
  app.get('/api/modules/all', (req, res) => {
    try {
      const cfg = loadModulesConfig();
      const all = discoveredPlugins.map(p => ({
        ...p.manifest,
        enabled: cfg.enabledModules[p.manifest.id] !== false,
        dirName: p.dirName
      }));
      res.json({ sucesso: true, modules: all });
    } catch (err) {
      res.status(500).json({ sucesso: false, error: err.message });
    }
  });

  // Endpoint: Criação visual de novos módulos plug-and-play
  app.post('/api/modules/create', (req, res) => {
    try {
      const { id, name, icon, category, description, targets } = req.body;
      if (!id) return res.status(400).json({ sucesso: false, error: 'ID do módulo é obrigatório.' });

      const rawId = String(id).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const moduleName = name || rawId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const moduleIcon = icon || 'ph-puzzle-piece';
      const moduleCat = category || 'geral';

      const targetDir = path.join(PLUGINS_DIR, rawId);
      if (fs.existsSync(targetDir)) {
        return res.status(400).json({ sucesso: false, error: 'Módulo já existe com este ID.' });
      }

      fs.mkdirSync(targetDir, { recursive: true });

      // module.json
      const manifest = {
        id: rawId,
        name: moduleName,
        version: '1.0.0',
        author: 'Chef Cozinha Dev Team',
        description: description || `Módulo plug-and-play de ${moduleName}.`,
        category: moduleCat,
        icon: moduleIcon,
        enabled: true,
        targets: Array.isArray(targets) && targets.length > 0 ? targets : ['all'],
        hooks: {
          server: 'index.js',
          client: 'client.js',
          widget: 'widget.js',
          style: 'style.css'
        }
      };
      fs.writeFileSync(path.join(targetDir, 'module.json'), JSON.stringify(manifest, null, 2), 'utf8');

      // index.js (backend)
      fs.writeFileSync(path.join(targetDir, 'index.js'), `module.exports = function ({ app, db, io, log }) {
  log('Módulo ${moduleName} inicializado.');
  app.get('/api/modulo/${rawId}/status', (req, res) => {
    res.json({ modulo: '${rawId}', nome: '${moduleName}', status: 'online' });
  });
};
`, 'utf8');

      // widget.js (Caixa v1.1)
      fs.writeFileSync(path.join(targetDir, 'widget.js'), `(function () {
  if (!window.ChefModules) return;
  ChefModules.register({ id: '${rawId}', name: '${moduleName}', icon: '${moduleIcon}' }, ({ registerWidget }) => {
    registerWidget({
      id: '${rawId}_widget',
      title: '${moduleName}',
      icon: '${moduleIcon}',
      defaultSize: 'sz-m',
      render(container) {
        container.innerHTML = \`<div style="padding:14px; text-align:center;">
          <i class="ph-bold ${moduleIcon}" style="font-size:28px; color:var(--v11-accent,#fc4b15);"></i>
          <h4 style="margin:6px 0;">\${moduleName}</h4>
          <p style="font-size:12px; color:var(--v11-text-sub,#64748b);">Widget modular plug-and-play ativo.</p>
        </div>\`;
      }
    });
  });
})();
`, 'utf8');

      // client.js
      fs.writeFileSync(path.join(targetDir, 'client.js'), `(function () {
  if (!window.ChefModules) return;
  ChefModules.register({ id: '${rawId}', name: '${moduleName}', icon: '${moduleIcon}' }, ({ registerNavbarAction }) => {
    registerNavbarAction({
      id: '${rawId}_btn',
      label: '${moduleName}',
      icon: '${moduleIcon}',
      onClick() { console.log('Módulo ${moduleName} acionado!'); }
    });
  });
})();
`, 'utf8');

      // style.css
      fs.writeFileSync(path.join(targetDir, 'style.css'), `/* Estilos do módulo ${rawId} */\n`, 'utf8');

      // Atualizar chef-modules.json
      const cfg = loadModulesConfig();
      cfg.enabledModules[rawId] = true;
      saveModulesConfig(cfg);

      // Adicionar à lista em memória
      discoveredPlugins.push({
        dirName: rawId,
        path: targetDir,
        manifest: manifest
      });

      // Servir arquivos estáticos do novo módulo
      const express = require('express');
      app.use('/plugins/' + rawId, express.static(targetDir));

      res.json({ sucesso: true, rawId, manifest });
    } catch (err) {
      res.status(500).json({ sucesso: false, error: err.message });
    }
  });

  // Endpoint: Alternar ativação de módulo
  app.post('/api/modules/toggle', (req, res) => {
    try {
      const { moduleId, enabled } = req.body;
      if (!moduleId) return res.status(400).json({ error: 'moduleId obrigatório.' });

      const cfg = loadModulesConfig();
      cfg.enabledModules[moduleId] = !!enabled;
      saveModulesConfig(cfg);

      res.json({ sucesso: true, moduleId, enabled: !!enabled });
    } catch (err) {
      res.status(500).json({ sucesso: false, error: err.message });
    }
  });

  log(`Sistema Modular Ativo: ${loaded.length} de ${discoveredPlugins.length} módulos carregados.`);
}

module.exports = loadPlugins;
