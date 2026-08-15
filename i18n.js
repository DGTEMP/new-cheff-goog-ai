(function() {
    const lang = localStorage.getItem('chef_app_lang') || 'pt-BR';
    
    // Se for o idioma padrão ou o dicionário não existir, não faz nada
    if (lang === 'pt-BR' || !window.locales || !window.locales[lang]) {
        document.documentElement.setAttribute('lang', 'pt-BR');
        return;
    }

    document.documentElement.setAttribute('lang', lang);
    const dict = window.locales[lang];

    function applyStaticTranslations(el) {
        // Traduz placeholders e valores de inputs
        if (el.placeholder && dict[el.placeholder.trim()]) {
            el.placeholder = dict[el.placeholder.trim()];
        }
        if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && dict[el.value.trim()]) {
            el.value = dict[el.value.trim()];
        }
        
        // Percorre filhos para traduzir TextNodes
        for (let child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                let original = child.nodeValue.trim();
                if (original && dict[original]) {
                    child.nodeValue = child.nodeValue.replace(original, dict[original]);
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                if (child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
                    applyStaticTranslations(child);
                }
            }
        }
    }

    // Executa APENAS UMA VEZ quando a página carrega, como se fosse nativo do HTML.
    // Sem uso de memória extra ou travamentos de MutationObserver.
    document.addEventListener('DOMContentLoaded', () => {
        applyStaticTranslations(document.body);
    });
    
    // Expõe a função para caso o sistema queira traduzir algo novo dinamicamente
    window.traduzirElemento = applyStaticTranslations;
})();
