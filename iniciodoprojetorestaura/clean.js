const fs = require('fs');
let buf = fs.readFileSync('index.html');
let cleaned = Buffer.alloc(buf.length);
let j = 0;
for (let i = 0; i < buf.length; i++) {
  if (buf[i] !== 0) {
    cleaned[j++] = buf[i];
  }
}
cleaned = cleaned.slice(0, j);
fs.writeFileSync('index.html', cleaned);
console.log('Null bytes removidos! Tamanho final: ' + j);
