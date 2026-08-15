// auth-sentinel.js
// Executado no <head> para ejetar usuários não autenticados imediatamente
(function() {
  const token = localStorage.getItem('chef_token');
  const path = window.location.pathname;
  
  const publicPages = ['/login.html', '/registro.html', '/ativacao.html', '/site', '/fidelidade', '/super-admin.html'];
  
  if (!token && !publicPages.includes(path)) {
    // Evita loop infinito se já estiver no login
    if (path !== '/' && path !== '/login.html') {
      window.location.href = '/login.html';
    }
  }
})();

// Interceptar chamadas fetch para injetar o JWT no Authorization header
const originalFetch = window.fetch;
window.fetch = async function() {
  let [resource, config] = arguments;
  
  if (!config) {
    config = {};
  }
  if (!config.headers) {
    config.headers = {};
  }
  
  const token = localStorage.getItem('chef_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await originalFetch(resource, config);
  
  // Se o token expirou (401), ejetar
  if (response.status === 401 && window.location.pathname !== '/login.html') {
    localStorage.removeItem('chef_token');
    window.location.href = '/login.html';
  }
  
  return response;
};
