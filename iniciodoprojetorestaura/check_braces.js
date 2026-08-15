const fs = require('fs');
const code = fs.readFileSync('main.js', 'utf8');

let openBraces = [];
let openParens = [];

for (let i=0; i<code.length; i++) {
    const c = code[i];
    const line = code.substring(0, i).split('\n').length;
    if (c === '{') openBraces.push({line});
    if (c === '}') {
        if (openBraces.length > 0) openBraces.pop();
        else console.log('Extra } at line', line);
    }
    if (c === '(') openParens.push({line});
    if (c === ')') {
        if (openParens.length > 0) openParens.pop();
        else console.log('Extra ) at line', line);
    }
}

console.log('Unclosed { at lines:', openBraces.map(b => b.line));
console.log('Unclosed ( at lines:', openParens.map(p => p.line));
