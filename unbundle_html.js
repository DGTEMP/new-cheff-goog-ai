const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const htmlFiles = fs.readdirSync(rootDir).filter(file => file.endsWith('.html'));

let modifiedCount = 0;

for (const file of htmlFiles) {
  const filePath = path.join(rootDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Remove vite CSS injection
  content = content.replace(/<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">\r?\n?/g, '');
  
  // Replace vite JS injection with original script tag
  // Example: <script type="module" crossorigin src="/assets/dashboard-BloDdD4g.js"></script>
  // becomes: <script src="dashboard.js"></script>
  content = content.replace(/<script type="module" crossorigin src="\/assets\/([^-]+)-[^\.]+\.js"><\/script>/g, '<script src="$1.js"></script>');
  
  // Also handle module preload links if they exist
  content = content.replace(/<link rel="modulepreload" crossorigin href="\/assets\/[^"]+\.js">\r?\n?/g, '');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[UNBUNDLED] ${file}`);
    modifiedCount++;
  }
}

console.log(`\nSuccessfully unbundled ${modifiedCount} HTML files.`);
