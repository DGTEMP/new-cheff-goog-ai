const fs = require('fs');
let styleCss = fs.readFileSync('style.css', 'utf8');

// Update .right-info
styleCss = styleCss.replace(
  /\.right-info \{\s*width: 260px;\s*background-color: #f7f9fa;\s*display: flex;\s*flex-direction: column;\s*padding: 12px;\s*overflow-y: auto;\s*\}/,
  `.right-info {\n  width: 260px;\n  background-color: #f7f9fa;\n  display: flex;\n  flex-direction: column;\n  padding: 12px;\n  overflow-y: auto;\n  overflow-x: hidden;\n  word-break: break-word;\n}`
);

// Update .info-row
styleCss = styleCss.replace(
  /\.info-row \{\s*display: flex;\s*justify-content: space-between;\s*align-items: center;\s*margin-bottom: 8px;\s*font-size: 12px;\s*\}/,
  `.info-row {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  margin-bottom: 8px;\n  font-size: 12px;\n  gap: 8px;\n}`
);

// Add rule for right-aligned values to wrap and flex correctly
if (!styleCss.includes('.info-row > *:last-child')) {
  styleCss = styleCss.replace(
    /\.info-row \.val \{/,
    `.info-row > *:first-child {\n  flex-shrink: 0;\n}\n.info-row > *:last-child {\n  text-align: right;\n  flex: 1;\n  word-break: break-word;\n}\n.info-row .val {`
  );
}

// Update .btn-action
styleCss = styleCss.replace(
  /\.btn-action \{\s*display: flex;\s*align-items: center;\s*justify-content: center;\s*gap: 6px;\s*background: #fdfdfd;\s*border: 1px solid #e4e6ef;\s*border-radius: 4px;\s*padding: 8px;\s*color: var\(--text-primary\);\s*font-family: var\(--font-family\);\s*font-size: 12px;\s*font-weight: 500;\s*cursor: pointer;\s*transition: all 0\.2s;\s*width: 100%;\s*\}/,
  `.btn-action {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  background: #fdfdfd;\n  border: 1px solid #e4e6ef;\n  border-radius: 4px;\n  padding: 8px 4px;\n  color: var(--text-primary);\n  font-family: var(--font-family);\n  font-size: 12px;\n  font-weight: 500;\n  cursor: pointer;\n  transition: all 0.2s;\n  width: 100%;\n  height: auto;\n  min-height: 36px;\n  white-space: normal;\n  text-align: center;\n  line-height: 1.2;\n}`
);

fs.writeFileSync('style.css', styleCss);
console.log('style.css ajustado para evitar overflow');
