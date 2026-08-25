/**
 * boot-splash.js — Remove o splash screen de boot com fade-out
 */
(function () {
  window.chefEsconderBootSplash = function () {
    var s = document.getElementById('chef-boot-splash');
    if (!s || s._oculto) return;
    s._oculto = true;
    s.style.opacity = '0';
    setTimeout(function () { s.remove(); }, 500);
  };
  // Falha segura: nunca prende o operador mais que 7s
  setTimeout(window.chefEsconderBootSplash, 7000);
})();
