import codecs

path = r'c:\Users\computer\Desktop\chef cozinha\site-vendas.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Update CSS Animations
css_animations = '''
      /* --- ANIMATIONS --- */
      @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
      @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px var(--primary-glow); } 50% { box-shadow: 0 0 40px var(--primary-glow), 0 0 60px rgba(252, 75, 21, 0.15); } }
      @keyframes epic-spin-pulse { 
          0% { transform: scale(0.8) rotate(0deg); opacity: 0.5; box-shadow: 0 0 10px var(--primary-glow); } 
          50% { transform: scale(1.2) rotate(180deg); opacity: 1; box-shadow: 0 0 60px var(--primary-glow); } 
          100% { transform: scale(1) rotate(360deg); opacity: 0.8; box-shadow: 0 0 30px var(--primary-glow); } 
      }
      @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
'''

idx1 = content.find('/*  ? ? ? ANIMATIONS  ? ? ? */')
if idx1 == -1: idx1 = content.find('/* --- ANIMATIONS --- */')
if idx1 != -1:
    end_idx1 = content.find('@keyframes shimmer', idx1)
    if end_idx1 != -1:
        content = content[:idx1] + css_animations.strip() + '\n      ' + content[end_idx1:]

# 2. Update Preloader HTML
preloader_html = '''
    <!-- Preloader Elegante -->
    <div id="site-preloader" style="position:fixed;top:0;left:0;width:100%;height:100%;background-color:var(--dark-bg);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.8s ease;">
      <div class="logo-icon" style="width:160px;height:160px;margin-bottom:30px;animation:epic-spin-pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; border-radius:30px;"><img src="/icons/icon-192.png" alt="Chef Cozinha" style="width:120px;height:120px;border-radius:24px;"></div>
      <div style="color:var(--text-main);font-family:'Outfit';font-size:32px;font-weight:900;letter-spacing:4px;margin-bottom:12px; text-shadow: 0px 4px 20px rgba(252,75,21,0.4);">CHEF COZINHA</div>
      <div style="color:var(--primary);font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase; animation:float 2s ease infinite;">Preparando a Cozinha...</div>
    </div>
'''
idx2 = content.find('<!-- Preloader Elegante -->')
if idx2 != -1:
    end_idx2 = content.find('<!-- Top Banner -->', idx2)
    if end_idx2 != -1:
        content = content[:idx2] + preloader_html.strip() + '\n\n    ' + content[end_idx2:]


# 3. Update DOMContentLoaded Logic
js_logic = '''
      document.addEventListener('DOMContentLoaded', function() {
        
        // Fix for GSAP ScrollTrigger on refresh
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
                // Initialize animations only after preloader is completely gone!
                initAnimations();
                setTimeout(() => { if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 500);
            }, 800);
          } else {
            initAnimations();
          }
        }, 3000); // More time for the epic animation
      });
'''
idx3 = content.find("document.addEventListener('DOMContentLoaded', function() {")
if idx3 != -1:
    end_idx3 = content.find('//  ? ? ? SETUP MODAL LOGIC  ? ? ?', idx3)
    if end_idx3 == -1: end_idx3 = content.find('// --- SETUP MODAL LOGIC ---', idx3)
    if end_idx3 != -1:
        content = content[:idx3] + js_logic.strip() + '\n\n      ' + content[end_idx3:]

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Patcher complete!")
