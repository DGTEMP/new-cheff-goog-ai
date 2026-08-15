const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');
code = code.replace(/container\.innerHTML\s*=\s*h;/g, "if(typeof morphdom !== 'undefined') morphdom(container, '<div>'+h+'</div>', {childrenOnly:true}); else container.innerHTML = h;");
fs.writeFileSync('main.js', code);
console.log('main.js patched');
