import codecs
path = r'c:\Users\computer\Desktop\chef cozinha\site-vendas.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

new_logic = '''
      document.addEventListener('DOMContentLoaded', function() {
        if ('scrollRestoration' in history) {
          history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
  
        updateCalculator();
        loadSetupDraft();
        
        setTimeout(() => {
          const pl = document.getElementById('site-preloader');
          if (pl) {
            pl.style.opacity = '0';
            setTimeout(() => {
                pl.remove();
                initAnimations();
                setTimeout(() => { if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 500);
            }, 800);
          } else {
            initAnimations();
          }
        }, 3000); 
      });
'''

idx1 = content.find("document.addEventListener('DOMContentLoaded', function() {")
if idx1 != -1:
    idx2 = content.find("let setupStep = 1;", idx1)
    if idx2 != -1:
        idx2 = content.rfind('\\n', idx1, idx2)
        content = content[:idx1] + new_logic.strip() + content[idx2:]
        with codecs.open(path, 'w', 'utf-8') as f:
            f.write(content)
        print('JS fixed successfully via markers.')
    else:
        print('let setupStep not found')
else:
    print('DOMContentLoaded not found')
