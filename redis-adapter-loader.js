/**
 * ══════════════════════════════════════════════════════════════════
 * ⚡ CHEF COZINHA - REDIS CLUSTER ADAPTER LOADER (Socket.IO Scale)
 * ══════════════════════════════════════════════════════════════════
 * - Permite múltiplos processos Node.js / nós de servidores comunicando
 *   eventos em tempo real perfeitamente.
 * - Detecção automática com fallback transparente para Standalone (In-Memory).
 */

function setupRedisAdapter(io) {
  const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);

  if (!redisUrl) {
    console.log('[Socket.IO] ℹ️ Operando em Modo Standalone de Alta Performance (Defina REDIS_URL para modo Multi-Nó).');
    return false;
  }

  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log(`[Socket.IO] 🚀 Redis Cluster Adapter ativado com sucesso em ${redisUrl}!`);
    }).catch(err => {
      console.error('[Socket.IO] ⚠️ Falha ao conectar no Redis. Mantendo modo In-Memory:', err.message);
    });

    return true;
  } catch (err) {
    console.log('[Socket.IO] ℹ️ Pacote @socket.io/redis-adapter não instalado. Operando em Modo In-Memory.');
    return false;
  }
}

module.exports = { setupRedisAdapter };
