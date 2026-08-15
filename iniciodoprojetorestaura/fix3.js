const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

code = code.replace(`    window.pdvCart = [];
    pdvOverlay.style.display = 'none';
    alert('Pedido lançado com sucesso!');
  };
}

`, `    window.pdvCart = [];
    pdvOverlay.style.display = 'none';
    alert('Pedido lançado com sucesso!');
    };
  }
});

`);

// Let's also check the end of the file. In fix_main.js I added:
/*
        if (!isNaN(num) && num >= 0) {
          window.servicoAdicional = num;
          if (window.calcularTotal) window.calcularTotal();
          if (window.calcRestante) window.calcRestante();
        }
      }
    });
  }
});
*/
// The final "});" was added by fix_main.js. Was it supposed to be there?
// The block before fix_main.js was:
/*
  if (btnServico) {
    btnServico.addEventListener('click', () => {
*/
// So `});` closes the click listener. And the `}` closes `if`. 
// The final `});` closes a DOMContentLoaded? Wait, I added it in fix_main.js, but there was NO DOMContentLoaded there before! 
// Let's remove the extra `});` at the end of the block from fix_main.js.

code = code.replace(`          if (window.calcRestante) window.calcRestante();
        }
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {`, `          if (window.calcRestante) window.calcRestante();
        }
      }
    });
  }

document.addEventListener('DOMContentLoaded', () => {`);

fs.writeFileSync('main.js', code, 'utf8');
