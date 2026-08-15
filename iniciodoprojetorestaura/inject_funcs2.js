const fs = require('fs');

let html = fs.readFileSync('main.js', 'utf8');

const dropFunctions = `
window.onDragStartTable = (e, mesa) => {
  e.dataTransfer.setData('type', 'table');
  e.dataTransfer.setData('mesa', mesa);
  e.dataTransfer.effectAllowed = 'move';
};

window.onDragStartItem = (e, itemId) => {
  e.dataTransfer.setData('type', 'item');
  e.dataTransfer.setData('itemId', itemId);
  e.dataTransfer.effectAllowed = 'move';
};

window.onDropMesa = (e, targetMesa) => {
  e.preventDefault();
  
  const type = e.dataTransfer.getData('type');
  if (!type) return;

  if (type === 'table') {
    const draggedMesa = e.dataTransfer.getData('mesa');
    if (draggedMesa === targetMesa) return;

    // Check if targetMesa is occupied or not by looking at window.ordersData
    const isOccupied = window.ordersData && window.ordersData.some(o => (o.mesa_grupo || o.localName) === targetMesa && o.status !== 'Finalizado');

    if (isOccupied) {
       if (confirm('Deseja realmente JUNTAR a ' + draggedMesa + ' com a ' + targetMesa + '?')) {
           socket.emit('juntar_mesas', { mesaA: draggedMesa, mesaB: targetMesa });
       }
    } else {
       if (confirm('Deseja realmente TRANSFERIR a ' + draggedMesa + ' para a ' + targetMesa + '?')) {
           socket.emit('transferir_mesa', { mesaAtual: draggedMesa, novaMesa: targetMesa });
       }
    }
  } else if (type === 'item') {
    const itemId = e.dataTransfer.getData('itemId');
    if (confirm('Deseja realmente transferir este item para a ' + targetMesa + '?')) {
        socket.emit('transferir_item', { itemId: itemId, novaMesa: targetMesa });
    }
  }
};
`;

if (!html.includes('window.onDropMesa =')) {
    html = dropFunctions + '\n' + html;
    fs.writeFileSync('main.js', html);
    console.log('Drop functions injected!');
} else {
    console.log('Drop functions already present');
}
