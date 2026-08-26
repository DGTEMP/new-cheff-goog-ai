/**
 * plugin-client.js — Client-side plugin loader
 *
 * Convention:
 *   public/plugins/<plugin-name>/
 *     index.js       — required: window.ChefPlugin = function({ socket, options })
 *     styles.css     — optional: auto-injected
 *     manifest.json  — optional: { "name": "...", "description": "...", "order": 0, "pages": ["cardapio","caixa"] }
 *
 * Module system:
 *   - Fetches /api/modulos (requires JWT) to get tenant's enabled modules
 *   - Only loads plugins whose modulo_id is in the enabled list
 *   - System modules are always loaded
 *
 * Usage in main.js or HTML:
 *   <script src="/plugin-client.js"></script>
 *   <script>window.ChefPluginLoader.init(socket);</script>
 */

'use strict';

window.ChefPluginLoader = (function() {
  var _plugins = [];
  var _socket = null;
  var _options = {};
  var _initialized = false;
  var _modulosCache = null;

  // Map plugin directory name → modulo_id
  var PLUGIN_TO_MODULO = {
    'image-providers': 'image_providers',
    'formas-pagamento': 'formas_pagamento',
    'reserves': 'reservas'
  };

  function getModuloId(pluginName) {
    return PLUGIN_TO_MODULO[pluginName] || pluginName;
  }

  /**
   * Fetch enabled modules for the current tenant
   */
  function fetchModulos() {
    if (_modulosCache) return Promise.resolve(_modulosCache);
    return fetch('/api/modulos', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
    })
    .then(function(r) { return r.ok ? r.json() : { ok: false, modulos: [] }; })
    .catch(function() { return { ok: false, modulos: [] }; })
    .then(function(data) {
      _modulosCache = data.modulos || [];
      return _modulosCache;
    });
  }

  /**
   * Check if a plugin is enabled for this tenant
   */
  function isPluginEnabled(pluginName, modulos) {
    var modId = getModuloId(pluginName);
    // If no modulos loaded (not authenticated or error), allow all (backwards compat)
    if (!modulos || !modulos.length) return true;
    // Check if the modulo is in the enabled list
    return modulos.indexOf(modId) !== -1;
  }

  /**
   * Load a single plugin by name (fetch manifest.json + index.js)
   */
  function loadPlugin(name) {
    return new Promise(function(resolve, reject) {
      var basePath = '/plugins/' + name;

      // Load manifest (optional)
      var manifest = { name: name, order: 999, pages: [] };
      fetch(basePath + '/manifest.json')
        .then(function(r) { return r.ok ? r.json() : {}; })
        .catch(function() { return {}; })
        .then(function(m) {
          manifest = Object.assign(manifest, m);

          // Inject CSS if exists
          var link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = basePath + '/styles.css';
          link.onerror = function() { link.remove(); };
          document.head.appendChild(link);

          // Load index.js
          var script = document.createElement('script');
          script.src = basePath + '/index.js';
          script.onload = function() {
            var pluginFn = window.ChefPlugin;
            if (typeof pluginFn === 'function') {
              _plugins.push({ name: name, fn: pluginFn, manifest: manifest });
              delete window.ChefPlugin;
              resolve({ name: name, manifest: manifest });
            } else {
              resolve({ name: name, manifest: manifest, skipped: true });
            }
          };
          script.onerror = function() {
            resolve({ name: name, skipped: true, error: 'Failed to load' });
          };
          document.body.appendChild(script);
        });
    });
  }

  /**
   * Discover available plugins by fetching a directory listing from the server
   */
  function discoverPlugins() {
    return fetch('/api/plugins/list')
      .then(function(r) { return r.ok ? r.json() : { plugins: [] }; })
      .catch(function() { return { plugins: [] }; })
      .then(function(data) {
        return (data.plugins || []).map(function(p) {
          return typeof p === 'string' ? p : p.name;
        });
      });
  }

  /**
   * Initialize all plugins
   */
  function init(socket, options) {
    if (_initialized) return;
    _initialized = true;
    _socket = socket;
    _options = options || {};

    // First fetch enabled modules, then discover and load plugins
    fetchModulos().then(function(modulos) {
      discoverPlugins().then(function(pluginNames) {
        if (!pluginNames.length) return;

        // Filter by tenant's enabled modules
        var allowed = pluginNames.filter(function(name) {
          return isPluginEnabled(name, modulos);
        });

        var skipped = pluginNames.length - allowed.length;
        if (skipped > 0) {
          console.log('[plugin-client] ' + skipped + ' plugins skipped (module disabled for this tenant)');
        }

        // Load allowed plugins
        var promises = allowed.map(function(name) {
          return loadPlugin(name);
        });

        Promise.all(promises).then(function(results) {
          // Sort by order
          _plugins.sort(function(a, b) {
            return (a.manifest.order || 999) - (b.manifest.order || 999);
          });

          // Filter by current page if specified
          var currentPage = _options.currentPage || '';
          var toInit = _plugins.filter(function(p) {
            if (!p.manifest.pages || !p.manifest.pages.length) return true;
            return p.manifest.pages.indexOf(currentPage) !== -1;
          });

          // Initialize each plugin
          toInit.forEach(function(p) {
            try {
              p.fn({ socket: _socket, options: _options });
              console.log('[plugin-client] ✓ ' + p.name);
            } catch (err) {
              console.error('[plugin-client] ✗ ' + p.name + ':', err);
            }
          });

          console.log('[plugin-client] ' + toInit.length + '/' + allowed.length + ' plugins initialized');
        });
      });
    });
  }

  /**
   * Invalidate modulos cache (called when modules are updated)
   */
  function invalidateModulosCache() {
    _modulosCache = null;
  }

  /**
   * Get loaded plugins info
   */
  function getPlugins() {
    return _plugins.map(function(p) {
      return { name: p.name, manifest: p.manifest };
    });
  }

  return { init: init, getPlugins: getPlugins, invalidateModulosCache: invalidateModulosCache };
})();
