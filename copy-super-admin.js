const fs = require('fs');

for (const f of ['super-admin.html', 'super-admin.js']) {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, 'dist/' + f);
  }
}
