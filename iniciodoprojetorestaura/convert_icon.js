const mod = require('png-to-ico');
const pngToIco = mod.default || mod;
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'installer', 'icon.png');
const dest = path.join(__dirname, 'installer', 'icon.ico');

Promise.resolve()
  .then(() => pngToIco([src]))
  .then(buf => {
    fs.writeFileSync(dest, buf);
    console.log('icon.ico criado em', dest);
  })
  .catch(err => {
    console.error('Erro ao converter:', err.message);
    fs.copyFileSync(src, dest);
    console.log('Fallback: copiado como .ico');
  });
