/**
 * plugin: pix — PIX Copia e Cola Dinâmico (BR Code EMV)
 * Extraído de server.js linhas 2376-2439
 */
module.exports = function({ app, db }) {
  function _pixSanitize(texto, maxLen) {
    return String(texto || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .trim().toUpperCase().slice(0, maxLen);
  }
  function _pixTlv(id, valor) {
    return id + String(valor.length).padStart(2, '0') + valor;
  }
  function _pixCrc16(payload) {
    let crc = 0xFFFF;
    for (const byte of Buffer.from(payload, 'utf8')) {
      crc ^= byte << 8;
      for (let i = 0; i < 8; i++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  function _montarPixPayload({ chave, nome, cidade, valor, txid }) {
    const gui = _pixTlv('00', 'br.gov.bcb.pix') + _pixTlv('01', chave);
    let payload =
      _pixTlv('00', '01') +
      _pixTlv('01', '12') +
      _pixTlv('26', gui) +
      _pixTlv('52', '0000') +
      _pixTlv('53', '986') +
      _pixTlv('58', 'BR') +
      _pixTlv('59', _pixSanitize(nome, 25) || 'RESTAURANTE') +
      _pixTlv('60', _pixSanitize(cidade, 15) || 'BRASIL') +
      _pixTlv('62', _pixTlv('05', txid));
    payload += '6304';
    return payload + _pixCrc16(payload);
  }

  app.get('/api/pix/copiacola', (req, res) => {
    const valor = parseFloat(String(req.query.valor || '').replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) return res.json({ ok: false, erro: 'Valor inválido.' });
    const mesaRef = String(req.query.mesa || '').slice(0, 40);
    let txid = String(req.query.ref || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
    if (!txid) txid = ('CC' + Date.now().toString(36)).toUpperCase().slice(0, 25);
    db.all(`SELECT chave, valor FROM configuracoes WHERE chave IN ('pix_chave','pix_nome_recebedor','pix_cidade')`, [], (err, rows) => {
      if (err) return res.json({ ok: false, erro: err.message });
      const cfg = {};
      (rows || []).forEach(r => { cfg[r.chave] = r.valor; });
      const chave = String(cfg.pix_chave || '').trim();
      if (!chave) return res.json({ ok: false, erro: 'Chave Pix não configurada. Defina em Configurações > Pagamentos.' });
      try {
        const payload = _montarPixPayload({
          chave,
          nome: cfg.pix_nome_recebedor || '',
          cidade: cfg.pix_cidade || '',
          valor,
          txid
        });
        res.json({ ok: true, payload, valor, txid, mesa: mesaRef });
      } catch (e) {
        res.json({ ok: false, erro: 'Falha ao gerar o Pix: ' + e.message });
      }
    });
  });
};
