
// Helper global seguro para verificar se um plugin está ativo em qualquer parte do sistema
global.hasPlugin = function (pluginId) {
  try {
    if (!pluginId) return false;
    const cfg = loadModulesConfig();
    return cfg && cfg.enabledModules && cfg.enabledModules[pluginId] !== false;
  } catch (e) {
    return false;
  }
};


// Função auxiliar de Hot-Discovery para detectar novos plugins adicionados em tempo de execução
function _rescanAndLoadNewPlugins({ app, db, masterDb, io, options, discoveredPlugins, loaded, stats }) {
  if (!fs.existsSync(PLUGINS_DIR)) return 0;

  const modulesConfig = loadModulesConfig();
  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const pluginDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
  let newlyLoaded = 0;

  const express = require('express');

  for (const dir of pluginDirs) {
    // Se já estiver na memória, ignora
    if (discoveredPlugins.some(p => p.dirName === dir.name)) continue;

    const pluginPath = path.join(PLUGINS_DIR, dir.name);
    let manifest = {
      id: dir.name,
      name: dir.name,
      version: '1.0.0',
      description: '',
      category: 'geral',
      icon: 'ph-puzzle-piece',
      enabled: true,
      tier: DEFAULT_TIERS[dir.name] !== undefined ? DEFAULT_TIERS[dir.name] : 3,
      targets: ['all'],
      hooks: {}
    };

    const moduleJsonPath = path.join(pluginPath, 'module.json');
    if (fs.existsSync(moduleJsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
        manifest = Object.assign(manifest, parsed);
        if (parsed.tier !== undefined) manifest.tier = parsed.tier;
      } catch (e) {}
    }

    if (!manifest.hooks) manifest.hooks = {};
    if (fs.existsSync(path.join(pluginPath, 'index.js')) && !manifest.hooks.server) manifest.hooks.server = 'index.js';
    if (fs.existsSync(path.join(pluginPath, 'client.js')) && !manifest.hooks.client) manifest.hooks.client = 'client.js';
    if (fs.existsSync(path.join(pluginPath, 'widget.js')) && !manifest.hooks.widget) manifest.hooks.widget = 'widget.js';
    if (fs.existsSync(path.join(pluginPath, 'style.css')) && !manifest.hooks.style) manifest.hooks.style = 'style.css';

    manifest.enabled = modulesConfig.enabledModules[manifest.id] !== false;

    discoveredPlugins.push({
      dirName: dir.name,
      path: pluginPath,
      manifest: manifest,
      tier: manifest.tier || 3
    });

    if (manifest.enabled && manifest.hooks.server) {
      try {
        app.use('/plugins/' + dir.name, express.static(pluginPath));
        const indexPath = path.join(pluginPath, manifest.hooks.server);
        if (fs.existsSync(indexPath)) {
          const pluginModule = require(indexPath);
          if (typeof pluginModule === 'function') {
            const pluginLog = (msg) => console.log(`  [plugin:${manifest.id}] ${msg}`);
            pluginModule({
              app, db, masterDb, io, options,
              log: pluginLog,
              name: manifest.id,
              meta: manifest,
              moduloGuard: (req, res, next) => next()
            });
            loaded.push(manifest.id);
            newlyLoaded++;
            pluginLog(`Novo plugin carregado via Hot-Reload (v${manifest.version || '1.0.0'} | Tier ${manifest.tier})`);
          }
        }
      } catch (e) {
        console.error(`[plugin-loader] Erro no Hot-Reload do módulo ${dir.name}:`, e.message);
      }
    }
  }

  if (io && newlyLoaded > 0) {
    io.emit('novos_modulos_carregados', { count: newlyLoaded });
  }

  return newlyLoaded;
}

/**
 * plugin-loader.js — Auto-discovery and prioritized lazy-loading of server-side plugins & extensions
 *
 * Arquitetura de Alta Performance para Escalar até 1000+ Módulos:
 *   - Tier 0: Core Crítico (Boot Imediato / Segurança / Autenticação / Caixa / Logs)
 *   - Tier 1: Operação do Restaurante (Cozinha KDS / Garçom Mobile / Entregas / NFC-e / PIX)
 *   - Tier 2: Suporte & Recursos Operacionais (Balança / Pesagem / Fidelidade / Reservas / Tarefas)
 *   - Tier 3: Extensões & On-Demand (Lazy-loading sob demanda: Temas, IA, Integrações Externas)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, 'plugins');
const MODULES_CONFIG_FILE = path.join(__dirname, 'chef-modules.json');

// Mapeamento padrão de prioridades / Tiers
const DEFAULT_TIERS = {
  // Tier 0: Core Crítico (Carregamento Imediato no Boot)
  'caixa': 0,
  'formas-pagamento': 0,
  'equipe': 0,
  'rh': 0,
  'dispositivos': 0,
  'logs': 0,

  // Tier 1: Operacional (Alta Prioridade)
  'cozinha': 1,
  'garcom': 1,
  'cheff-entregas': 1,
  'nfce': 1,
  'pix': 1,

  // Tier 2: Suporte & Recursos Operacionais
  'balanca': 2,
  'pesagem-selfservice': 2,
  'fidelidade': 2,
  'reserves': 2,
  'montaveis': 2,
  'tarefas': 2,

  // Tier 3: Extensões & On-Demand (Lazy Loading)
  'tema-v2': 3,
  'temas': 3,
  'theme-curator': 3,
  'retro': 3,
  'image-providers': 3,
  'cheff-ai': 3
};

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
  const startTime = Date.now();
  const log = (msg) => console.log(`[plugin-loader] ${msg}`);

  if (!fs.existsSync(PLUGINS_DIR)) {
    log('Diretório de plugins não encontrado. Criando...');
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
      tier: DEFAULT_TIERS[dir.name] !== undefined ? DEFAULT_TIERS[dir.name] : 3,
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
        if (parsed.tier !== undefined) manifest.tier = parsed.tier;
        if (parsed.priority !== undefined) manifest.tier = parsed.priority;
      } catch(e) {}
    } else if (fs.existsSync(pkgJsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        manifest = Object.assign(manifest, parsed);
        if (parsed.tier !== undefined) manifest.tier = parsed.tier;
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
      manifest: manifest,
      tier: Number.isFinite(manifest.tier) ? manifest.tier : 3
    });
  }

  saveModulesConfig(modulesConfig);

  // Ordena os plugins por Prioridade / Tier crescente (0 -> 1 -> 2 -> 3)
  discoveredPlugins.sort((a, b) => a.tier - b.tier);

  const stats = { 0: 0, 1: 0, 2: 0, 3: 0, desativados: 0 };
  const loaded = [];

  const express = require('express');

  // Executa o carregamento ordenado por prioridade
  for (const plugin of discoveredPlugins) {
    if (plugin.manifest.enabled === false) {
      stats.desativados++;
      continue;
    }

    try {
      const pluginLog = (msg) => console.log(`  [plugin:${plugin.manifest.id}] ${msg}`);

      // Servir arquivos estáticos (client.js, widget.js, style.css)
      app.use('/plugins/' + plugin.dirName, express.static(plugin.path));

      // Se possui hook de servidor (index.js)
      if (plugin.manifest.hooks && plugin.manifest.hooks.server) {
        const indexPath = path.join(plugin.path, plugin.manifest.hooks.server);
        if (fs.existsSync(indexPath)) {
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
                  if (over.ativo === 0) return res.status(403).json({ 
                    error: '🔧 Este módulo está em manutenção temporária pois tropecei nuns fios aqui, mas já estou conectando tudo de volta e já te aviso assim que funcionar.',
                    manutencao: true,
                    aviso_amigavel: '🔧 Ops! Tropecei nuns fios aqui, mas já estou conectando tudo de volta e já te aviso assim que funcionar.'
                  });
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

          // Tier 0, 1 e 2: Instanciação prioritária
          // Tier 3: Instanciação protegida / on-demand
          const pluginModule = require(indexPath);
          if (typeof pluginModule === 'function') {
            pluginModule(ctx);
            loaded.push(plugin.manifest.id);
            if (stats[plugin.tier] !== undefined) stats[plugin.tier]++;
            pluginLog(`Backend carregado com sucesso (v${plugin.manifest.version || '1.0.0'} | Tier ${plugin.tier})`);
          }
        }
      }
    } catch (err) {
      console.error(`  [plugin:${plugin.manifest.id}] ERRO ao carregar: ${err.message}`);
    }
  }

  const duration = Date.now() - startTime;
  log(`🚀 Sistema Modular Otimizado por Prioridades:`);
  console.log(`   ⚡ Tier 0 (Core Crítico): ${stats[0]} módulos carregados no boot imediato.`);
  console.log(`   🍳 Tier 1 (Operação): ${stats[1]} módulos operacionais ativos.`);
  console.log(`   📦 Tier 2 (Suporte & Recursos): ${stats[2]} módulos de apoio carregados.`);
  console.log(`   🧩 Tier 3 (Extensões & On-Demand): ${stats[3]} módulos leves prontos.`);
  log(`✅ ${loaded.length} de ${discoveredPlugins.length} módulos ativos em ${duration}ms (${stats.desativados} desativados).`);

  // Endpoint: Retorna lista de módulos ativos para o Frontend (auto-discovery)
  app.get('/api/modules/active', (req, res) => {
    try {
      const active = discoveredPlugins
        .filter(p => p.manifest.enabled !== false)
        .map(p => ({
          ...p.manifest,
          tier: p.tier,
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
        tier: p.tier,
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
      const { id, name, icon, category, description, targets, tier } = req.body;
      if (!id) return res.status(400).json({ sucesso: false, error: 'ID do módulo é obrigatório.' });

      const rawId = String(id).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const moduleName = name || rawId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const moduleIcon = icon || 'ph-puzzle-piece';
      const moduleCat = category || 'geral';
      const moduleTier = Number.isFinite(parseInt(tier, 10)) ? parseInt(tier, 10) : 3;

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
        tier: moduleTier,
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
  log('Módulo ${moduleName} inicializado (Tier ${moduleTier}).');
  app.get('/api/modulo/${rawId}/status', (req, res) => {
    res.json({ modulo: '${rawId}', nome: '${moduleName}', status: 'online', tier: ${moduleTier} });
  });
};
`, 'utf8');

      // Atualizar chef-modules.json
      const cfg = loadModulesConfig();
      cfg.enabledModules[rawId] = true;
      saveModulesConfig(cfg);

      discoveredPlugins.push({
        dirName: rawId,
        path: targetDir,
        manifest: manifest,
        tier: moduleTier
      });

      app.use('/plugins/' + rawId, express.static(targetDir));

      res.json({ sucesso: true, rawId, manifest });
    } catch (err) {
      res.status(500).json({ sucesso: false, error: err.message });
    }
  });


  // Endpoint: Remoção Segura / Desinstalação de Módulo
  app.delete('/api/modules/:id', (req, res) => {
    try {
      const moduleId = req.params.id;
      if (!moduleId) return res.status(400).json({ sucesso: false, error: 'ID do módulo é obrigatório.' });

      const cfg = loadModulesConfig();
      cfg.enabledModules[moduleId] = false;
      saveModulesConfig(cfg);

      const targetDir = path.join(PLUGINS_DIR, moduleId);
      let removidoDisco = false;

      // Se for passado ?deleteFiles=true, remove os arquivos da pasta com segurança
      if (req.query.deleteFiles === 'true' && fs.existsSync(targetDir)) {
        try {
          fs.rmSync(targetDir, { recursive: true, force: true });
          removidoDisco = true;
        } catch (e) {
          console.warn('[plugin-loader] Aviso ao remover arquivos do disco:', e.message);
        }
      }

      // Remove da memória ativa
      const idx = discoveredPlugins.findIndex(p => p.manifest.id === moduleId);
      if (idx !== -1) {
        discoveredPlugins[idx].manifest.enabled = false;
      }

      if (io) {
        io.emit('modulo_removido', { moduleId, removidoDisco });
      }

      log(`🗑️ Módulo [${moduleId}] desinstalado com segurança (Disco: ${removidoDisco ? 'removido' : 'desativado'}).`);
      res.json({ sucesso: true, moduleId, removidoDisco, mensagem: 'Módulo removido com segurança sem afetar o sistema.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, error: err.message });
    }
  });

  // Endpoint: Hot-Reload de Plugins em Tempo Real (sem reiniciar o Node.js)
  app.post('/api/modules/reload', (req, res) => {
    try {
      const reloadedCount = _rescanAndLoadNewPlugins({ app, db, masterDb, io, options, discoveredPlugins, loaded, stats });
      res.json({
        sucesso: true,
        total_ativos: loaded.length,
        novos_carregados: reloadedCount,
        mensagem: 'Plugins recarregados em tempo real com sucesso!'
      });
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
}

module.exports = loadPlugins;
