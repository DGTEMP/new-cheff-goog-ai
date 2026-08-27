/* ── Fuso Horário do Restaurante ──────────────────────────────────
 * timezone_offset: minutos de diferença ao UTC
 *   Ex: -180 = GMT-3 (Brasília), -240 = GMT-4, 0 = UTC
 *
 * Servidor envia via socket 'timezone_offset' ao conectar.
 * Fallback: browser tenta detectar automaticamente.
 *
 * Uso:
 *   chefDate(utcString)     → Date ajustada ao fuso do restaurante
 *   chefFormatTime(utcStr)  → "HH:MM" no fuso do restaurante
 *   chefFormatDate(utcStr)  → "DD/MM/YYYY HH:MM"
 */
(function () {
  'use strict';

  // Default: detectar fuso do browser em minutos (negativo = oeste)
  window.CHEF_TZ_OFFSET = -(new Date().getTimezoneOffset());

  // Socket listener — cada página que tem socket chama isso
  window.initChefTz = function (socket) {
    if (!socket || typeof socket.on !== 'function') return;

    // Carregar do servidor ao conectar
    socket.emit('get_timezone_offset');
    socket.on('timezone_offset', function (offsetMin) {
      var v = parseInt(offsetMin, 10);
      if (!isNaN(v)) {
        window.CHEF_TZ_OFFSET = v;
      }
    });
  };

  // Converter UTC string → Date ajustada ao fuso do restaurante
  // O Date resultante, quando usado com toLocaleTimeString, mostra
  // o horário correto do restaurante (independente do browser)
  window.chefDate = function (utcStr) {
    if (!utcStr) return new Date();
    var d = new Date(utcStr.includes('T') ? utcStr : utcStr + 'Z');
    if (isNaN(d.getTime())) return new Date();
    // Date.UtcNow + restaurantOffset → cria Date que "finge" ser o horário local
    var restaurantOffset = window.CHEF_TZ_OFFSET;
    var browserOffset = -(new Date().getTimezoneOffset());
    var shiftMs = (restaurantOffset - browserOffset) * 60000;
    return new Date(d.getTime() + shiftMs);
  };

  // "HH:MM" no fuso do restaurante
  window.chefFormatTime = function (utcStr) {
    if (!utcStr) return '--:--';
    var d = new Date(utcStr.includes('T') ? utcStr : utcStr + 'Z');
    if (isNaN(d.getTime())) return '--:--';
    var totalMin = d.getUTCHours() * 60 + d.getUTCMinutes() + window.CHEF_TZ_OFFSET;
    if (totalMin < 0) totalMin += 1440;
    if (totalMin >= 1440) totalMin -= 1440;
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };

  // "DD/MM/YYYY HH:MM" no fuso do restaurante
  window.chefFormatDate = function (utcStr) {
    if (!utcStr) return '--/--/---- --:--';
    var d = new Date(utcStr.includes('T') ? utcStr : utcStr + 'Z');
    if (isNaN(d.getTime())) return '--/--/---- --:--';
    var totalMin = d.getUTCHours() * 60 + d.getUTCMinutes() + window.CHEF_TZ_OFFSET;
    var day = d.getUTCDate();
    var month = d.getUTCMonth();
    var year = d.getUTCFullYear();
    if (totalMin < 0) { totalMin += 1440; day--; if (day < 0) { month--; if (month < 0) { month = 11; year--; } day = new Date(year, month + 1, 0).getDate(); } }
    if (totalMin >= 1440) { totalMin -= 1440; day++; var maxDay = new Date(year, month + 1, 0).getDate(); if (day > maxDay) { day = 1; month++; if (month > 11) { month = 0; year++; } } }
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return (day < 10 ? '0' : '') + day + '/' + (month + 1 < 10 ? '0' : '') + (month + 1) + '/' + year + ' ' + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };
})();
