const fs = require('fs');
['server.js', 'main.js', 'pdv-mobile.js', 'garcom.js'].forEach(f => {
  try {
    let c = fs.readFileSync(f, 'utf16le');
    if(!c.includes('socket.emit') && !c.includes('socket.on')) c = fs.readFileSync(f, 'utf8');
    const emits = [...new Set([...c.matchAll(/emit\(['"]([^'"]+)['"]/g)].map(m => m[1]))];
    const ons = [...new Set([...c.matchAll(/\.on\(['"]([^'"]+)['"]/g)].map(m => m[1]))];
    console.log(f, '\n EMIT:', emits.join(', '), '\n ON:', ons.join(', '));
  } catch(e) {
    console.log(f, 'Error reading or parsing');
  }
});
