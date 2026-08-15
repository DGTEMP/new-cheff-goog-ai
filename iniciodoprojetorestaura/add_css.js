const fs = require('fs');

let css = fs.readFileSync('style.css', 'utf8');
if (!css.includes('user-select: none')) {
    css += `
.mesa-item {
    user-select: none;
    -webkit-user-select: none;
    cursor: grab;
}
.mesa-item:active {
    cursor: grabbing;
}
#panel-items-tbody tr[draggable="true"] {
    user-select: none;
    -webkit-user-select: none;
    cursor: grab;
}
#panel-items-tbody tr[draggable="true"]:active {
    cursor: grabbing;
}
`;
    fs.writeFileSync('style.css', css);
    console.log('CSS added');
}
