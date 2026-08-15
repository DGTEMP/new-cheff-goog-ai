const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const hubDistDir = path.join(rootDir, 'hub-server', 'dist');

const htmlFiles = fs.readdirSync(hubDistDir).filter(file => file.endsWith('.html'));

let restoredCount = 0;

for (const file of htmlFiles) {
  const sourcePath = path.join(hubDistDir, file);
  const targetPath = path.join(rootDir, file);
  
  let content = fs.readFileSync(sourcePath, 'utf8');
  
  // The obfuscated script starts with <script>/*chef-obf-1*/ and ends with </script>
  // We need to carefully remove this specific script block.
  const regex = /<script>\/\*chef-obf-1\*\/[\s\S]*?<\/script>/gi;
  const originalLength = content.length;
  
  content = content.replace(regex, '');
  
  if (content.length < originalLength) {
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`[RESTORED] ${file} (Size: ${originalLength} -> ${content.length} bytes)`);
    restoredCount++;
  } else {
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`[RESTORED - No Obf Script] ${file} (Size: ${content.length} bytes)`);
    restoredCount++;
  }
}

console.log(`\nSuccessfully restored ${restoredCount} HTML files from hub-server/dist.`);
