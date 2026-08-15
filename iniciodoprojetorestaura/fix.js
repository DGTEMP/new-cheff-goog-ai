const fs = require('fs');
let content = fs.readFileSync('garcom.js', 'utf-8');
// It was written directly as stringified JSON or with literal backslashes
// Let's parse it using JSON.parse if it's quoted.
if (content.startsWith('"') && content.endsWith('"')) {
    try {
        content = JSON.parse(content);
    } catch(e) {
        // Fallback
        content = content.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
} else {
    content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
fs.writeFileSync('garcom.js', content);
