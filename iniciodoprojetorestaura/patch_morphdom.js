const fs = require('fs');

function patchFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  
  // A generic regex to replace .innerHTML assignments that use map(...).join('') or strings (html)
  // This might be tricky because of multiline template literals.
  // Instead of generic regex, let's target specific known variables that receive HTML.
  
  const targets = ['list', 'grid', 'tabsContainer', 'listContainer', 'sugList', 'esteira', 'ordersList', 'filaPedidos', 'cardsContainer'];
  
  targets.forEach(t => {
    // We match `t.innerHTML = ` followed by anything until a semicolon, but only on single lines if possible, 
    // or we just do a more conservative replace:
    // It's safer to just replace `t.innerHTML = html;`
    // Let's replace `.innerHTML = html;` specifically where `html` is a variable
    code = code.replace(new RegExp(`\\b${t}\\.innerHTML\\s*=\\s*html;`, 'g'), `if(typeof morphdom !== 'undefined') morphdom(${t}, '<div>'+html+'</div>', {childrenOnly:true}); else ${t}.innerHTML = html;`);
  });

  // For main.js: ordersList.innerHTML = ...
  // In main.js renderOrders(), it builds `html` and then does `ordersList.innerHTML = html;`
  code = code.replace(/ordersList\.innerHTML\s*=\s*html;/g, "if(typeof morphdom !== 'undefined') morphdom(ordersList, '<div>'+html+'</div>', {childrenOnly:true}); else ordersList.innerHTML = html;");
  
  // For fila.js: filaPedidos.innerHTML = html;
  code = code.replace(/filaPedidos\.innerHTML\s*=\s*html;/g, "if(typeof morphdom !== 'undefined') morphdom(filaPedidos, '<div>'+html+'</div>', {childrenOnly:true}); else filaPedidos.innerHTML = html;");

  fs.writeFileSync(file, code);
  console.log(`Patched ${file}`);
}

['garcom.js', 'main.js', 'fila.js'].forEach(patchFile);
