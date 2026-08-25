/**
 * Plugin: image-providers
 * Pool de provedores de imagem com round-robin e fallback
 */
module.exports = function({ app, masterDb, io, options, log }) {
  const https = require('https');
  const http = require('http');
  const { superAdminAuth } = options;

  // ── Presets de provedores gratuitos ──
  const PRESETS = {
    imgbb: {
      nome: 'ImgBB', upload_url: 'https://api.imgbb.com/1/upload', method: 'POST',
      max_size_mb: 32, content_type: 'application/x-www-form-urlencoded',
      body_template: 'key={api_key}&image={base64}&name={filename}',
      response_url_path: 'data.url', doc_url: 'https://api.imgbb.com/'
    },
    cloudinary: {
      nome: 'Cloudinary', upload_url: 'https://api.cloudinary.com/v1_1/{cloud_name}/image/upload', method: 'POST',
      max_size_mb: 10, content_type: 'application/x-www-form-urlencoded',
      body_template: 'file={base64}&api_key={api_key}&timestamp={timestamp}',
      response_url_path: 'secure_url', doc_url: 'https://cloudinary.com/'
    },
    imgur: {
      nome: 'Imgur', upload_url: 'https://api.imgur.com/3/image', method: 'POST',
      max_size_mb: 10, content_type: 'application/x-www-form-urlencoded',
      headers_template: { 'Authorization': 'Client-ID {api_key}' },
      body_template: 'image={base64}',
      response_url_path: 'data.link', doc_url: 'https://apidocs.imgur.com/'
    },
    custom: {
      nome: 'Custom (Manual)', upload_url: '', method: 'POST',
      max_size_mb: 10, content_type: 'multipart/form-data',
      body_template: '', response_url_path: 'url'
    }
  };

  // ── Helpers ──
  function getProviders() {
    return new Promise((resolve) => {
      masterDb.get("SELECT valor FROM configuracoes_global WHERE chave = 'image_providers'", [], (err, row) => {
        if (err || !row) return resolve([]);
        try { resolve(JSON.parse(row.valor)); } catch (e) { resolve([]); }
      });
    });
  }

  function saveProviders(providers) {
    return new Promise((resolve, reject) => {
      masterDb.run("INSERT INTO configuracoes_global (chave, valor) VALUES ('image_providers', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
        [JSON.stringify(providers)], (err) => { err ? reject(err) : resolve(); });
    });
  }

  function extractJsonPath(obj, p) {
    if (!p || !obj) return obj;
    return p.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
  }

  // ── Upload engine ──
  function uploadToProvider(provider, base64Data, filename) {
    return new Promise((resolve) => {
      try {
        const cfg = provider.config || {};
        let uploadUrl = provider.upload_url || '';
        const headersTpl = provider.headers_template || {};

        uploadUrl = uploadUrl.replace(/{api_key}/g, cfg.api_key || '').replace(/{cloud_name}/g, cfg.cloud_name || '')
          .replace(/{account_id}/g, cfg.account_id || '').replace(/{bucket}/g, cfg.bucket || '')
          .replace(/{key}/g, filename + '.png');

        if (!uploadUrl) return resolve({ ok: false, error: 'URL não configurada.' });

        const headers = {};
        Object.keys(headersTpl).forEach(k => {
          headers[k] = String(headersTpl[k]).replace(/{api_key}/g, cfg.api_key || '').replace(/{client_id}/g, cfg.api_key || '');
        });

        let body = (provider.body_template || '')
          .replace(/{api_key}/g, cfg.api_key || '').replace(/{base64}/g, base64Data)
          .replace(/{filename}/g, filename).replace(/{timestamp}/g, String(Math.floor(Date.now() / 1000)))
          .replace(/{cloud_name}/g, cfg.cloud_name || '');

        headers['Content-Type'] = provider.content_type || 'application/x-www-form-urlencoded';

        const urlObj = new URL(uploadUrl);
        const isHttps = urlObj.protocol === 'https:';
        const req = (isHttps ? https : http).request({
          hostname: urlObj.hostname, port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search, method: (provider.method || 'POST').toUpperCase(),
          headers, timeout: 30000
        }, (resp) => {
          let data = '';
          resp.on('data', c => data += c);
          resp.on('end', () => {
            try {
              if (resp.statusCode < 200 || resp.statusCode >= 300) return resolve({ ok: false, error: 'HTTP ' + resp.statusCode });
              const json = JSON.parse(data);
              const url = extractJsonPath(json, provider.response_url_path);
              resolve(url && typeof url === 'string' && url.startsWith('http') ? { ok: true, url } : { ok: false, error: 'URL não encontrada na resposta' });
            } catch (e) { resolve({ ok: false, error: 'Resposta inválida' }); }
          });
        });
        req.on('error', e => resolve({ ok: false, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
        req.write(body);
        req.end();
      } catch (e) { resolve({ ok: false, error: e.message }); }
    });
  }

  // ── Routes ──
  log('Registering routes...');

  // GET /api/super/image-providers
  app.get('/api/super/image-providers', superAdminAuth, async (req, res) => {
    try {
      const providers = await getProviders();
      res.json({ ok: true, providers, presets: PRESETS });
    } catch (e) { res.json({ ok: false, erro: e.message }); }
  });

  // POST /api/super/image-providers
  app.post('/api/super/image-providers', superAdminAuth, async (req, res) => {
    try {
      const { providers } = req.body || {};
      if (!Array.isArray(providers)) return res.json({ ok: false, erro: 'Formato inválido.' });
      await saveProviders(providers);
      res.json({ ok: true, mensagem: 'Provedores salvos!' });
    } catch (e) { res.json({ ok: false, erro: e.message }); }
  });

  // POST /api/super/image-providers/test/:id
  app.post('/api/super/image-providers/test/:id', superAdminAuth, async (req, res) => {
    try {
      const providers = await getProviders();
      const provider = providers.find(p => p.id === req.params.id);
      if (!provider) return res.json({ ok: false, erro: 'Provedor não encontrado.' });
      const result = await uploadToProvider(provider, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'chef-test-' + Date.now());
      res.json(result.ok ? { ok: true, mensagem: 'Teste OK!', url: result.url, provider: provider.nome } : { ok: false, erro: result.error, provider: provider.nome });
    } catch (e) { res.json({ ok: false, erro: e.message }); }
  });

  // POST /api/super/image-providers/reorder
  app.post('/api/super/image-providers/reorder', superAdminAuth, async (req, res) => {
    try {
      const { order } = req.body || {};
      if (!Array.isArray(order)) return res.json({ ok: false, erro: 'Formato inválido.' });
      const providers = await getProviders();
      const reordered = order.map(id => providers.find(p => p.id === id)).filter(Boolean);
      providers.forEach(p => { if (!reordered.find(r => r.id === p.id)) reordered.push(p); });
      await saveProviders(reordered);
      res.json({ ok: true, mensagem: 'Ordem atualizada!' });
    } catch (e) { res.json({ ok: false, erro: e.message }); }
  });

  // POST /api/upload-image — upload inteligente com round-robin + fallback
  app.post('/api/upload-image', async (req, res) => {
    try {
      const { base64, filename } = req.body || {};
      if (!base64) return res.json({ ok: false, erro: 'Imagem (base64) obrigatória.' });
      const providers = await getProviders();
      const active = providers.filter(p => p.ativo !== false).sort((a, b) => (a.priority || 0) - (b.priority || 0));
      if (!active.length) return res.json({ ok: false, erro: 'Nenhum provedor configurado.' });

      const fName = filename || 'upload-' + Date.now();
      let lastError = null;
      for (const provider of active) {
        const result = await uploadToProvider(provider, base64, fName);
        if (result.ok) return res.json({ ok: true, url: result.url, provider: provider.nome, provider_id: provider.id });
        lastError = result.error;
      }
      res.json({ ok: false, erro: 'Todos falharam. Último: ' + (lastError || '?') });
    } catch (e) { res.json({ ok: false, erro: e.message }); }
  });

  log('Routes registered.');
};
