const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');
if (!css.includes('.drag-over')) {
    css += `\n.drag-over { border: 2px dashed #0b7285 !important; background-color: #e3fafc !important; transform: scale(1.02); transition: 0.2s; }\n`;
    fs.writeFileSync('style.css', css);
    console.log('Added .drag-over to style.css');
}

let html = fs.readFileSync('main.js', 'utf8');

// Global Drag and Drop functions
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

if (!html.includes('window.onDragStartTable')) {
    html = dropFunctions + '\n' + html;
}

// Add draggable attributes to mesa-item
if (!html.includes('draggable="true" ondragstart="window.onDragStartTable(event, \'${nome}\')"')) {
    html = html.replace(
        /<div class="mesa-item status-\$\{statusClass\}" id="mesa-card-\$\{uid\}" style="position: relative;">/g,
        '<div class="mesa-item status-${statusClass}" id="mesa-card-${uid}" style="position: relative;" draggable="true" ondragstart="window.onDragStartTable(event, \'${nome}\')" ondragover="event.preventDefault(); this.classList.add(\'drag-over\');" ondragleave="this.classList.remove(\'drag-over\');" ondrop="window.onDropMesa(event, \'${nome}\'); this.classList.remove(\'drag-over\');">'
    );
}

// Add draggable attributes to panel items
// In renderPanelItems(), it creates <tr> inside a loop
if (!html.includes('ondragstart="window.onDragStartItem(event, ${item.id})"')) {
    html = html.replace(
        /<tr style="\$\{style\}">/g,
        '<tr style="${style}" draggable="true" ondragstart="window.onDragStartItem(event, ${item.id})">'
    );
}

fs.writeFileSync('main.js', html);
console.log('Drag and drop functions added to main.js');
