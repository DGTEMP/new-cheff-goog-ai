const fs = require('fs');
const https = require('https');
try {
  const pfx = fs.readFileSync('cert.pfx');
  https.createServer({ pfx }).listen(3001, () => {
    console.log('Successfully loaded cert.pfx without password');
    process.exit(0);
  });
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
