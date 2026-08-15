const fs = require('fs');

let mainJs = fs.readFileSync('main.js', 'utf8');

const originalUserUpdate = /if \(elUser\) \{\s*elUser\.innerText = window\.loggedInUser \|\| 'No logado';\s*\}/g;
const fallbackRegex = /if \(elUser\) \{\s*elUser\.innerText = window\.loggedInUser \|\| 'N.*?o logado';\s*\}/g;

const newUserUpdate = `if (elUser) {
        const creds = localStorage.getItem('chef_credentials');
        if (creds) {
            try {
                const parsed = JSON.parse(creds);
                window.loggedInUser = parsed.nome || parsed.usuario;
            } catch(e) {}
        } else {
            window.loggedInUser = null;
        }
        elUser.innerText = window.loggedInUser || 'Não logado';
    }`;

let replaced = false;

if (originalUserUpdate.test(mainJs)) {
  mainJs = mainJs.replace(originalUserUpdate, newUserUpdate);
  replaced = true;
} else if (fallbackRegex.test(mainJs)) {
  mainJs = mainJs.replace(fallbackRegex, newUserUpdate);
  replaced = true;
}

// Initial update so it doesn't wait 15 seconds!
if (replaced && !mainJs.includes('// Initial Footer Sync')) {
  mainJs += `\n// Initial Footer Sync\nsetTimeout(() => {\n  const elUser = document.getElementById('status-user-name');\n  ${newUserUpdate}\n}, 500);\n`;
}

fs.writeFileSync('main.js', mainJs);
console.log('Footer sync patch applied!');
