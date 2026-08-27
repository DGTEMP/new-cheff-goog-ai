/**
 * Plugin: image-providers
 * Pool de provedores de imagem com round-robin, fallback e armazenamento local nativo
 */
module.exports = function({ app, masterDb, io, options, log }) {
  const https = require('https');
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const { superAdminAuth } = options;

  // Garante que o diretório de uploads local exista
  const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (e) {}

  // ── Presets de provedores ──
  const PRESETS = {
    local: {
      nome: 'Armazenamento Local (Servidor Chef)',
      upload_url: 'local',
      method: 'LOCAL',
      max_size_mb: 50,
      content_type: 'local',
      body_template: '',
      response_url_path: 'url',
      doc_url: 'https://chefcozinha.com'
    },
    imgbb: {
      nome: 'ImgBB',
      upload_url: 'https://api.imgbb.com/1/upload',
      method: 'POST',
      max_size_mb: 32,
      content_type: 'application/x-www-form-urlencoded',
      body_template: 'key={api_key}&image={base64}&name={filename}',
      response_url_path: 'data.url',
      doc_url: 'https://api.imgbb.com/'
    },
    cloudinary: {
      nome: 'Cloudinary',
      upload_url: 'https://api.cloudinary.com/v1_1/{cloud_name}/image/upload',
      method: 'POST',
      max_size_mb: 10,
      content_type: 'application/x-www-form-urlencoded',
      body_template: 'file={base64}&api_key={api_key}&timestamp={timestamp}',
      response_url_path: 'secure_url',
      doc_url: 'https://cloudinary.com/'
    },
    imgur: {
      nome: 'Imgur',
      upload_url: 'https://api.imgur.com/3/image',
      method: 'POST',
      max_size_mb: 10,
      content_type: 'application/x-www-form-urlencoded',
      headers_template: { 'Authorization': 'Client-ID {api_key}' },
      body_template: 'image={base64}',
      response_url_path: 'data.link',
      doc_url: 'https://apidocs.imgur.com/'
    },
    custom: {
      nome: 'Custom (Manual)',
      upload_url: '',
      method: 'POST',
      max_size_mb: 10,
      content_type: 'multipart/form-data',
      body_template: '',
      response_url_path: 'url'
    }
  };

  // ── Helpers ──
  function getProviders() {
    return new Promise((resolve) => {
      masterDb.get("SELECT valor FROM configuracoes_global WHERE chave = 'image_providers'", [], (err, row) => {
        if (err || !row) return resolve(getDefaultProviders());
        try {
          const provs = JSON.parse(row.valor);
          if (!Array.isArray(provs) || provs.length === 0) return resolve(getDefaultProviders());
          // Garante que o provedor local exista na lista
          if (!provs.find(p => p.type === 'local' || p.id === 'prov_local_chef')) {
            provs.unshift(getDefaultLocalProvider());
          }
          resolve(provs);
        } catch (e) {
          resolve(getDefaultProviders());
        }
      });
    });
  }

  function getDefaultLocalProvider() {
    return {
      id: 'prov_local_chef',
      nome: 'Armazenamento Local (Chef Server)',
      type: 'local',
      upload_url: 'local',
      method: 'LOCAL',
      content_type: 'local',
      headers_template: {},
      body_template: '',
      response_url_path: 'url',
      max_size_mb: 50,
      config: {},
      ativo: true,
      priority: 0,
      usage_count: 0,
      created_at: new Date().toISOString()
    };
  }

  function getDefaultProviders() {
    return [getDefaultLocalProvider()];
  }

  function saveProviders(providers) {
    return new Promise((resolve, reject) => {
      masterDb.run(
        "INSERT INTO configuracoes_global (chave, valor) VALUES ('image_providers', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
        [JSON.stringify(providers)],
        (err) => { err ? reject(err) : resolve(); }
      );
    });
  }

  function extractJsonPath(obj, p) {
    if (!p || !obj) return obj;
    return p.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
  }

  // Salva imagem no armazenamento local do servidor
  function saveLocalImage(base64Data, filename) {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+-]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const safeFilename = (filename || 'upload_' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
      const filePath = path.join(uploadDir, safeFilename);
      fs.writeFileSync(filePath, buffer);
      return { ok: true, url: `/uploads/${safeFilename}` };
    } catch (e) {
      return { ok: false, error: 'Erro ao salvar localmente: ' + e.message };
    }
  }

  // ── Upload engine ──
  function uploadToProvider(provider, base64Data, filename) {
    return new Promise((resolve) => {
      try {
        const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+-]+;base64,/, '');

        // 1. Provedor Local
        if (provider.type === 'local' || provider.upload_url === 'local' || provider.method === 'LOCAL') {
          return resolve(saveLocalImage(cleanBase64, filename));
        }

        const cfg = provider.config || {};
        let uploadUrl = provider.upload_url || '';
        const headersTpl = provider.headers_template || {};

        uploadUrl = uploadUrl.replace(/{api_key}/g, cfg.api_key || '')
          .replace(/{cloud_name}/g, cfg.cloud_name || '')
          .replace(/{account_id}/g, cfg.account_id || '')
          .replace(/{bucket}/g, cfg.bucket || '')
          .replace(/{key}/g, filename + '.png');

        if (!uploadUrl) return resolve({ ok: false, error: 'URL não configurada.' });

        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ChefCozinha/2.0'
        };

        Object.keys(headersTpl).forEach(k => {
          headers[k] = String(headersTpl[k])
            .replace(/{api_key}/g, cfg.api_key || '')
            .replace(/{client_id}/g, cfg.api_key || '');
        });

        let body = '';

        // Formatação inteligente por tipo de provedor
        if (provider.type === 'imgbb') {
          const params = new URLSearchParams();
          params.append('key', cfg.api_key || '');
          params.append('image', cleanBase64);
          params.append('name', filename);
          body = params.toString();
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else if (provider.type === 'cloudinary') {
          const timestamp = Math.floor(Date.now() / 1000);
          const params = new URLSearchParams();
          params.append('file', 'data:image/png;base64,' + cleanBase64);
          params.append('api_key', cfg.api_key || '');
          params.append('timestamp', String(timestamp));

          if (cfg.upload_preset) {
            params.append('upload_preset', cfg.upload_preset);
          } else if (cfg.api_secret && cfg.api_secret !== '**********') {
            const toSign = `timestamp=${timestamp}${cfg.api_secret}`;
            const signature = crypto.createHash('sha1').update(toSign).digest('hex');
            params.append('signature', signature);
          }
          body = params.toString();
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else if (provider.type === 'imgur') {
          const params = new URLSearchParams();
          params.append('image', cleanBase64);
          body = params.toString();
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else {
          body = (provider.body_template || '')
            .replace(/{api_key}/g, encodeURIComponent(cfg.api_key || ''))
            .replace(/{base64}/g, encodeURIComponent(cleanBase64))
            .replace(/{filename}/g, encodeURIComponent(filename))
            .replace(/{timestamp}/g, String(Math.floor(Date.now() / 1000)))
            .replace(/{cloud_name}/g, encodeURIComponent(cfg.cloud_name || ''));
          headers['Content-Type'] = provider.content_type || 'application/x-www-form-urlencoded';
        }

        headers['Content-Length'] = Buffer.byteLength(body);

        const urlObj = new URL(uploadUrl);
        const isHttps = urlObj.protocol === 'https:';
        const req = (isHttps ? https : http).request({
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: (provider.method || 'POST').toUpperCase(),
          headers,
          timeout: 25000
        }, (resp) => {
          let data = '';
          resp.on('data', c => data += c);
          resp.on('end', () => {
            try {
              if (resp.statusCode < 200 || resp.statusCode >= 300) {
                return resolve({ ok: false, error: `HTTP ${resp.statusCode}: ${data.substring(0, 120)}` });
              }
              const json = JSON.parse(data);
              const url = extractJsonPath(json, provider.response_url_path);
              resolve(url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('/')) 
                ? { ok: true, url } 
                : { ok: false, error: 'URL não encontrada na resposta: ' + data.substring(0, 100) });
            } catch (e) {
              resolve({ ok: false, error: 'Resposta não é JSON válido: ' + data.substring(0, 100) });
            }
          });
        });

        req.on('error', e => resolve({ ok: false, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout ao conectar com provedor' }); });
        req.write(body);
        req.end();
      } catch (e) {
        resolve({ ok: false, error: e.message });
      }
    });
  }

  // ── Routes ──
  log('Registering image providers routes...');

  // GET /api/super/image-providers
  app.get('/api/super/image-providers', superAdminAuth, async (req, res) => {
    try {
      const providers = await getProviders();
      res.json({ ok: true, providers, presets: PRESETS });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // POST /api/super/image-providers
  app.post('/api/super/image-providers', superAdminAuth, async (req, res) => {
    try {
      const { providers } = req.body || {};
      if (!Array.isArray(providers)) return res.json({ ok: false, erro: 'Formato inválido.' });
      await saveProviders(providers);
      res.json({ ok: true, mensagem: 'Provedores salvos com sucesso!' });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // POST /api/super/image-providers/test/:id
  app.post('/api/super/image-providers/test/:id', superAdminAuth, async (req, res) => {
    try {
      const providers = await getProviders();
      const provider = providers.find(p => p.id === req.params.id);
      if (!provider) return res.json({ ok: false, erro: 'Provedor não encontrado.' });
      
      const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await uploadToProvider(provider, sampleBase64, 'chef-test-' + Date.now());
      
      if (result.ok) {
        res.json({ ok: true, mensagem: 'Conexão e upload realizados com sucesso!', url: result.url, provider: provider.nome });
      } else {
        res.json({ ok: false, erro: result.error, provider: provider.nome });
      }
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
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
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  // POST /api/upload-image — upload inteligente com round-robin + fallback local garantido
  app.post('/api/upload-image', async (req, res) => {
    try {
      const { base64, filename } = req.body || {};
      if (!base64) return res.json({ ok: false, erro: 'Imagem (base64) obrigatória.' });

      const providers = await getProviders();
      const active = providers.filter(p => p.ativo !== false).sort((a, b) => (a.priority || 0) - (b.priority || 0));

      const fName = filename || 'upload-' + Date.now();
      let lastError = null;

      for (const provider of active) {
        const result = await uploadToProvider(provider, base64, fName);
        if (result.ok) {
          return res.json({ ok: true, url: result.url, provider: provider.nome, provider_id: provider.id });
        }
        lastError = result.error;
      }

      // Fallback final garantido: Armazenamento Local Chef
      const localResult = saveLocalImage(base64, fName);
      if (localResult.ok) {
        return res.json({
          ok: true,
          url: localResult.url,
          provider: 'Armazenamento Local Chef (Fallback)',
          provider_id: 'prov_local_chef'
        });
      }

      res.json({ ok: false, erro: 'Falha no upload: ' + (lastError || localResult.error) });
    } catch (e) {
      res.json({ ok: false, erro: e.message });
    }
  });

  log('Image providers routes registered successfully.');
};
