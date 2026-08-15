const fs = require('fs');
let content = fs.readFileSync('garcom.js', 'utf-8');
if(content.startsWith('"') && content.endsWith('"')) { 
  content = content.slice(1, -1); 
}
fs.writeFileSync('garcom.js', content);
