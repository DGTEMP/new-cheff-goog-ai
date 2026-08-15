const fs = require('fs');

const html = fs.readFileSync('hub-server/dist/registro.html', 'utf8');
const regex = /<script>\/\*chef-obf-1\*\/([\s\S]*?)<\/script>/gi;

let match;
let count = 0;
while ((match = regex.exec(html)) !== null) {
  fs.writeFileSync(`registro_obf_${count}.js`, match[1], 'utf8');
  console.log(`Saved registro_obf_${count}.js`);
  count++;
}
