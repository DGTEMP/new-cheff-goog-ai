/* Chef Cozinha — Engine leve de confete/fogos (sem dependências externas)
   Uso: chefFogos({ particulas: 120, intensidade: 3 })
        chefChuvaEstrelas({ duracaoMs: 3000 }) */
(function () {
  let canvas = null;
  let ctx = null;
  let particulas = [];
  let rodando = false;

  function garantirCanvas() {
    if (canvas && document.body.contains(canvas)) return;
    canvas = document.createElement('canvas');
    canvas.id = 'chef-fogos-canvas';
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999999;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    redimensionar();
    window.addEventListener('resize', redimensionar);
  }

  function redimensionar() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  const CORES_FESTA = ['#fc4b15', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ffffff', '#fbbf24'];

  function novaParticula(origem, angulo, forca, cor, formato) {
    return {
      x: origem.x,
      y: origem.y,
      vx: Math.cos(angulo) * forca,
      vy: Math.sin(angulo) * forca - 2,
      gravidade: 0.055 + Math.random() * 0.04,
      vida: 1,
      decai: 0.008 + Math.random() * 0.012,
      tamanho: formato === 'estrela' ? 5 + Math.random() * 5 : 4 + Math.random() * 6,
      cor: cor,
      rotacao: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      formato: formato || 'retangulo'
    };
  }

  function explosao(x, y, qtd, intensidade, comEstrelas) {
    garantirCanvas();
    const n = Math.max(10, Math.min(600, qtd));
    for (let i = 0; i < n; i++) {
      const angulo = Math.random() * Math.PI * 2;
      const forca = (2 + Math.random() * 7) * (intensidade || 1);
      const estrela = comEstrelas && i % 5 === 0;
      particulas.push(novaParticula(
        { x, y }, angulo, forca,
        CORES_FESTA[(Math.random() * CORES_FESTA.length) | 0],
        estrela ? 'estrela' : 'retangulo'
      ));
    }
    iniciarLoop();
  }

  function desenharEstrela(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotacao);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(a) * p.tamanho;
      const py = Math.sin(a) * p.tamanho;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = p.cor;
    ctx.globalAlpha = Math.max(0, p.vida);
    ctx.fill();
    ctx.restore();
  }

  function loop() {
    if (!ctx) { rodando = false; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vy += p.gravidade;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rotacao += p.vr;
      p.vida -= p.decai;
      if (p.vida <= 0 || p.y > canvas.height + 40) {
        particulas.splice(i, 1);
        continue;
      }
      if (p.formato === 'estrela') {
        desenharEstrela(p);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotacao);
        ctx.globalAlpha = Math.max(0, p.vida);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.tamanho / 2, -p.tamanho / 4, p.tamanho, p.tamanho / 2);
        ctx.restore();
      }
    }
    if (particulas.length > 0) {
      requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rodando = false;
    }
  }

  function iniciarLoop() {
    if (!rodando) {
      rodando = true;
      requestAnimationFrame(loop);
    }
  }

  /* Explosões em pontos aleatórios do topo — para celebrações grandes */
  function chuvaDeFogos(quantidadeExplosoes, comEstrelas) {
    garantirCanvas();
    for (let e = 0; e < quantidadeExplosoes; e++) {
      setTimeout(() => {
        explosao(
          canvas.width * (0.15 + Math.random() * 0.7),
          canvas.height * (0.15 + Math.random() * 0.35),
          60 + Math.random() * 60,
          0.8 + Math.random() * 0.8,
          comEstrelas !== false
        );
      }, e * 350);
    }
  }

  window.chefFogos = function (opts) {
    opts = opts || {};
    explosao(
      opts.x != null ? opts.x : window.innerWidth / 2,
      opts.y != null ? opts.y : window.innerHeight * 0.35,
      opts.particulas || 120,
      opts.intensidade || 1,
      opts.estrelas !== false
    );
  };

  window.chefChuvaEstrelas = function (opts) {
    opts = opts || {};
    chuvaDeFogos(Math.max(1, Math.min(30, opts.explosoes || 5)), true);
  };

  // Alias compatível com chamadas confetti({...}) simples já existentes no código
  window.confetti = window.confetti || function (opts) {
    opts = opts || {};
    const origin = opts.origin || {};
    explosao(
      window.innerWidth * (origin.x != null ? origin.x : 0.5),
      window.innerHeight * (origin.y != null ? origin.y : 0.5),
      opts.particleCount || 150,
      (opts.spread || 80) / 80,
      true
    );
  };
})();
