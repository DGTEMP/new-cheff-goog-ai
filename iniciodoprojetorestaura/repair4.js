const fs = require('fs');

let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Drop lines 244 to 305 (0-indexed) which correspond to lines 245 to 306 (1-indexed).
lines.splice(244, 62);

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log("Deleted the exact garbage block!");
