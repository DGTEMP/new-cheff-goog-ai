const figlet = require('figlet');
const gradient = require('gradient-string');
const { createSpinner } = require('nanospinner');

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

async function animacaoInicial() {
    console.clear();

    // 1. Gera a logo em ASCII Art (A fonte 'Slant' tem um visual inclinado e dinâmico)
    const logo = figlet.textSync('App Chef', {
        font: 'Slant',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    });

    // 2. Aplica um gradiente "quente" (lembrando fogo/cozinha)
    console.log(gradient.passion.multiline(logo));
    console.log('\n');

    // 3. Inicia o spinner de status
    const spinner = createSpinner('Aquecendo os fornos e sincronizando módulos em tempo real...').start();

    // Simula o tempo de pré-carregamento (ou pode ser atrelado a uma verificação de DB real)
    await sleep(2500); 

    spinner.success({ text: 'Sistema no ar! Cozinha pronta para despachar pedidos.\n' });
}

animacaoInicial();
