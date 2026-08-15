const fs = require('fs');
let html = fs.readFileSync('main.js', 'utf8');

if (!html.includes('ondragstart="window.onDragStartItem(event, ${order.id})"')) {
    html = html.replace(
        /<tr style="\$\{(isPaid[^}]+)\}">/g,
        '<tr style="${$1}" draggable="true" ondragstart="window.onDragStartItem(event, ${order.id})">'
    );
}

fs.writeFileSync('main.js', html);
console.log('Injected item draggability');
