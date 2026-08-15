const fs = require('fs');

const content = `const HOST = window.location.hostname;
const socket = io({ query: { token: localStorage.getItem('chef_token') } });

let queueData = [];
let currentFilter = 'Em espera';
let currentSector = 'Todos';

window.filtrarSetor = function(sectorName) {
  currentSector = sectorName;
  
  // Update UI buttons
  const buttons = document.querySelectorAll('.sector-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    if(btn.innerText.trim() === sectorName) {
      btn.classList.add('active');
    }
  });
  
  renderQueue();
};

window.filtrarFila = function(statusText) {
  currentFilter = statusText;
  
  // Update UI buttons
  const buttons = document.querySelectorAll('.status-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    if(btn.innerText.trim() === (statusText === 'Pronto' ? 'Prontos' : statusText)) {
      btn.classList.add('active');
    }
  });
  
  renderQueue();
};

function getComandaColor(localName) {
  if (!localName) return 'hsl(0, 0%, 50%)';
  let hash = 0;
  for (let i = 0; i < localName.length; i++) {
    hash = localName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash * 137.5) % 360;
  return \`hsl(\${hue}, 85%, 45%)\`;
}

function getBgColor(diffMins) {
  if (diffMins < 2) return '#ffffff'; // 0-2 mins: White
  const cappedMins = Math.min(Math.max(diffMins - 2, 0), 28); // 0 to 28
  const hue = 60 - (cappedMins / 28) * 60; // 60 (Yellow) to 0 (Red)
  const lightness = 95 - (cappedMins / 28) * 25; // 95% down to 70%
  return \`hsl(\${hue}, 100%, \${lightness}%)\`;
}

// --- SOUND NOTIFICATION SYSTEM ---
let audioCtx = null;

function playDing() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Play a pleasant "Ding-Dong" (A5 to C#6)
    createChime(880, 0);       // A5
    createChime(1108.73, 0.15); // C#6
  } catch (e) {
    console.log("Audio not supported or blocked by browser.", e);
  }
}

function createChime(freq, delay) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  
  const now = audioCtx.currentTime + delay;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(now);
  osc.stop(now + 1);
}

// Em navegadores modernos, o áudio pode ser bloqueado até o usuário interagir.
// Adicionamos um evento no document para liberar o áudio no primeiro clique.
document.addEventListener('click', () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}, { once: true });

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
  // ESC - Voltar para o Caixa
  if (e.key === 'Escape') {
    e.preventDefault();
    window.location.href = 'index.html';
  }
});

function renderQueue() {
  const list = document.getElementById('queue-list');
  const section = list.closest('.queue-section') || document.querySelector('.queue-section');
  const savedScroll = section ? section.scrollTop : 0;
  
  list.innerHTML = '';

  // Sort by ID (guarantees oldest first, newest last reliably)
  const sortedData = [...queueData].sort((a, b) => a.id - b.id);

  sortedData.forEach(item => {
    if (currentFilter === 'Em espera' && item.status !== 'Em espera') return;
    if (currentFilter === 'Pronto' && item.status !== 'Pronto') return;
    if (currentFilter === 'Em preparo' && item.status !== 'Em preparo') return;
    if (currentSector !== 'Todos' && item.sector !== currentSector) return;

    let btnIcon = '<i class="ph ph-fire" style="color: #7e8299;"></i>';
    let btnAction = \`startPrep(\${item.id})\`;
    if (item.status === 'Em preparo') {
      btnIcon = '<i class="ph ph-bowl-food" style="color: #333;"></i>';
      btnAction = \`markReady(\${item.id})\`;
    }

    const row = document.createElement('div');
    row.className = 'queue-item';
    
    // Set border color for "comanda" (localName)
    row.style.borderLeftColor = getComandaColor(item.localName);
    row.id = \`item-\${item.id}\`;
    row.setAttribute('data-created', item.createdAt);
    
    if (window.highlights && window.highlights[item.id] && window.highlights[item.id] > Date.now()) {
      row.classList.add('new-item-highlight');
      setTimeout(() => {
        if (row) row.classList.remove('new-item-highlight');
      }, window.highlights[item.id] - Date.now());
    }

    row.innerHTML = \`
      <div class="item-quantidade">
        <span class="qtd-number">\${item.quantity}x</span>
        <span class="qtd-time"><i class="ph ph-clock"></i> 0m</span>
      </div>
      <div class="item-produto">
        <div style="font-size: 32px; line-height: 1; margin: 0;">\${item.productEmoji}</div>
        <span style="line-height: 1.1;">\${item.productName}</span>
      </div>
      <div class="item-local">
        <div class="local-icon"><i class="ph ph-table" style="color: \${getComandaColor(item.localName)}"></i></div>
        <div class="local-info">
          <span class="local-name">\${item.localName}</span>
          <span class="local-user">\${item.userName}</span>
        </div>
      </div>
      <div class="item-pronto">
        <button class="btn-pronto" onclick="\${btnAction}">
          \${btnIcon}
        </button>
      </div>
    \`;

    list.appendChild(row);
  });

  if (section) section.scrollTop = savedScroll;
  window.updateFilaTimers();
}

window.updateFilaTimers = () => {
  document.querySelectorAll('.queue-item').forEach(row => {
    let createdStr = row.getAttribute('data-created');
    if (!createdStr || createdStr === 'undefined' || createdStr === 'null') return;
    
    // SQLite returns "YYYY-MM-DD HH:MM:SS" (UTC time). 
    // We must format it to ISO 8601 "YYYY-MM-DDTHH:MM:SSZ" so JS knows it's UTC.
    if (!createdStr.includes('T')) {
      createdStr = createdStr.replace(' ', 'T') + 'Z';
    }
    
    const createdAt = new Date(createdStr);
    
    // Calculate precise difference in minutes
    const now = new Date();
    let diffMs = now - createdAt;
    // If future date due to clock skew, set to 0
    if (diffMs < 0) diffMs = 0; 
    
    const diffMins = Math.floor(diffMs / 60000);
    
    const timeEl = row.querySelector('.qtd-time');
    if (timeEl) {
      timeEl.innerHTML = \`<i class="ph ph-clock"></i> \${diffMins}m\`;
      if (diffMins > 15) {
        timeEl.style.color = '#eb5757';
      } else if (diffMins > 8) {
        timeEl.style.color = '#f38f18';
      } else {
        timeEl.style.color = '#5e6278';
      }
    }
    
    // Update background color based on time
    row.style.backgroundColor = getBgColor(diffMins);
  });
};
setInterval(window.updateFilaTimers, 1000); // Update every 1s

window.startPrep = function(id) {
  const btn = event.currentTarget;
  btn.style.backgroundColor = '#fcf1e3'; // Orange light bg
  btn.style.borderColor = '#f38f18';
  btn.innerHTML = '<i class="ph ph-spinner-gap" style="color: #f38f18;"></i>';
  
  socket.emit('atualizar_status', { id, status: 'Em preparo' });
};

window.markReady = function(id) {
  const btn = event.currentTarget;
  btn.style.backgroundColor = '#8cc63f';
  btn.style.borderColor = '#8cc63f';
  btn.innerHTML = '<i class="ph ph-check" style="color: white;"></i>';
  
  setTimeout(() => {
    socket.emit('atualizar_status', { id, status: 'Pronto' });
  }, 300);
};

// WebSocket Events
socket.on('initial_data', (data) => {
  queueData = data;
  renderQueue();
});

socket.on('pedidos_atualizados', (data) => {
  queueData = data;
  renderQueue();
});

window.highlights = window.highlights || {};

function handleNewOrder(novoPedido) {
  queueData.push(novoPedido);
  window.highlights[novoPedido.id] = Date.now() + 8000;
  
  renderQueue();
  playDing();
    setTimeout(() => {
      const el = document.getElementById(\`item-\${novoPedido.id}\`);
      if (el) {
        // Rola até o novo pedido
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
        
        // Retorna ao topo após 5 segundos
        setTimeout(() => {
          const section = document.querySelector('.queue-section');
          if (section) {
            section.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 5000);
      }
    }, 100);
}

socket.on('pedido_adicionado', handleNewOrder);

socket.on('status_atualizado', (pedidoAtualizado) => {
  const index = queueData.findIndex(o => o.id === pedidoAtualizado.id);
  if (index !== -1) {
    queueData[index] = pedidoAtualizado;
    renderQueue();
  }
});

socket.on('mesa_finalizada', ({ mesaName }) => {
  queueData = queueData.filter(o => o.localName !== mesaName);
  renderQueue();
});

// --- COLUMNS SORTABLE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('queue-header-sortable');
  if (header && typeof Sortable !== 'undefined') {
    new Sortable(header, {
      animation: 150,
      onEnd: function() {
        // Obter nova ordem
        const orderArray = Array.from(header.children).map(el => el.getAttribute('data-col'));
        applyColumnOrder(orderArray);
        // Save to localStorage
        localStorage.setItem('filaColumnOrder', JSON.stringify(orderArray));
      }
    });

    // Check if there is a saved order
    const savedOrder = localStorage.getItem('filaColumnOrder');
    if (savedOrder) {
      try {
        const orderArray = JSON.parse(savedOrder);
        // Reorder DOM elements in header
        orderArray.forEach(col => {
          const el = header.querySelector(\`[data-col="\${col}"]\`);
          if (el) header.appendChild(el);
        });
        applyColumnOrder(orderArray);
      } catch (e) {}
    }
  }
});

function applyColumnOrder(orderArray) {
  let style = document.getElementById('dynamic-column-order');
  if (!style) {
    style = document.createElement('style');
    style.id = 'dynamic-column-order';
    document.head.appendChild(style);
  }
  
  let css = '';
  orderArray.forEach((col, index) => {
    if(col === 'quantidade') css += \`.item-quantidade { order: \${index}; }\\n\`;
    if(col === 'produto') css += \`.item-produto { order: \${index}; }\\n\`;
    if(col === 'local') css += \`.item-local { order: \${index}; }\\n\`;
    if(col === 'pronto') css += \`.item-pronto { order: \${index}; }\\n\`;
  });
  style.innerHTML = css;
}
`;
fs.writeFileSync('C:/Users/computer/Desktop/chef cozinha/fila.js', content, 'utf8');
console.log('Restored fila.js correctly');
