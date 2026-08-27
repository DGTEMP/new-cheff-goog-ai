const fs = require('fs');

let saJs = fs.readFileSync('super-admin.js', 'utf8');

// 1. UNIFICAR APIDELETE (REMOVER A DUPLICAÇÃO E SUPORTAR 2 OU 3 ARGUMENTOS)
const oldApiDelete = `function apiDelete(url, data, cb) {
  var x = new XMLHttpRequest();
  x.open('DELETE', url, true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try { cb(null, JSON.parse(x.responseText)); }
      catch(e) { cb(e, null); }
    }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(JSON.stringify(data));
}

function apiDelete(url, cb) {
  var x = new XMLHttpRequest();
  x.open('DELETE', url, true);
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try { cb(null, JSON.parse(x.responseText)); }
      catch(e) { cb(e, null); }
    }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(null);
}`;

const newApiDelete = `function apiDelete(url, dataOrCb, maybeCb) {
  var data = (typeof dataOrCb === 'function') ? null : dataOrCb;
  var cb = (typeof dataOrCb === 'function') ? dataOrCb : (maybeCb || function(){});
  var x = new XMLHttpRequest();
  x.open('DELETE', url, true);
  if (data) {
    x.setRequestHeader('Content-Type', 'application/json');
  }
  x.setRequestHeader('x-super-admin-token', localToken);
  x.onreadystatechange = function() {
    if (x.readyState === 4) {
      try { cb(null, JSON.parse(x.responseText)); }
      catch(e) { cb(e, null); }
    }
  };
  x.onerror = function() { cb(new Error('Erro de rede'), null); };
  x.send(data ? JSON.stringify(data) : null);
}`;

if (saJs.includes(oldApiDelete)) {
  saJs = saJs.replace(oldApiDelete, newApiDelete);
  console.log('Successfully unified apiDelete in super-admin.js!');
}

// 2. CORRIGIR DOMCONTENTLOADED DUPLICADO
const oldDomLoadedBlock = `document.addEventListener('DOMContentLoaded', function() {
  /* Login button */
  var btnLogin = document.getElementById('btn-entrar-local');
  if (btnLogin) btnLogin.addEventListener('click', loginLocal);

  /* Global removal delegation */
  document.addEventListener('click', function(e) {
    if (e.target.closest('.remove-team-row')) {
      var row = e.target.closest('.initial-team-row');
      if (row) row.remove();
    }
  });

document.addEventListener('DOMContentLoaded', function() {
  /* Login screen event listeners */
  var btnLogin = document.getElementById('btn-entrar-local');
  if (btnLogin) btnLogin.addEventListener('click', loginLocal);`;

const newDomLoadedBlock = `document.addEventListener('DOMContentLoaded', function() {
  /* Global removal delegation */
  document.addEventListener('click', function(e) {
    if (e.target.closest('.remove-team-row')) {
      var row = e.target.closest('.initial-team-row');
      if (row) row.remove();
    }
  });

  /* Login screen event listeners */
  var btnLogin = document.getElementById('btn-entrar-local');
  if (btnLogin) btnLogin.addEventListener('click', loginLocal);`;

if (saJs.includes(oldDomLoadedBlock)) {
  saJs = saJs.replace(oldDomLoadedBlock, newDomLoadedBlock);
  console.log('Successfully fixed duplicate DOMContentLoaded in super-admin.js!');
}

fs.writeFileSync('super-admin.js', saJs, 'utf8');

// 3. ADICIONAR GLOBAL SUPERADMINAUTH GUARD EM SERVER.JS
let serverJs = fs.readFileSync('server.js', 'utf8');

const targetGuardLocation = `app.use('/api/super', (req, res, next) => {`;

if (!serverJs.includes(targetGuardLocation)) {
  const guardCode = `
// ─── GUARDA GLOBAL DE SEGURANÇA SUPER-ADMIN (PROTEÇÃO 100% INVIOLÁVEL) ───────
app.use('/api/super', (req, res, next) => {
  // Rotas públicas do super admin: login
  if (req.path === '/login-local' || req.path === '/login-cloud') {
    return next();
  }
  return superAdminAuth(req, res, next);
});
`;
  // Inserir logo após a definição do middleware superAdminAuth
  const superAuthDefIdx = serverJs.indexOf('function superAdminAuth(');
  if (superAuthDefIdx !== -1) {
    const endOfFn = serverJs.indexOf('\n}', superAuthDefIdx);
    if (endOfFn !== -1) {
      serverJs = serverJs.slice(0, endOfFn + 2) + '\n' + guardCode + serverJs.slice(endOfFn + 2);
      fs.writeFileSync('server.js', serverJs, 'utf8');
      console.log('Successfully added global superAdminAuth guard in server.js!');
    }
  }
}
