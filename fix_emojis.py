import sys, os
sys.stdout.reconfigure(encoding='utf-8')

base_dist = r'c:\Users\computer\Desktop\chef cozinha\dist'
base_src = r'c:\Users\computer\Desktop\chef cozinha'

# All emoji fixes to apply
PREFIX = '\u00f0\u0178'

ALL_FIXES = {
    # 3-byte emoji double-encoding fixes
    'â±ï¸': '⏱️',         # ⏱️ clock
    'â˜€ï¸': '☀️',        # ☀️ sun
    'â°ï¸': '⏰️',         # ⏰️ alarm
    'â±': '⏱',
    'â˜€': '☀',
    # 4-byte emoji fixes (food range F0 9F 8D xx, 3rd byte dropped)
    PREFIX + '\x8d\xba': '🍺',          # 🍺 beer
    PREFIX + '\x8d\xb9': '🍹',          # 🍹 tropical drink
    PREFIX + '\x8d\xb7': '🍷',          # 🍷 wine
    PREFIX + '\x8d\xb8': '🍸',          # 🍸 cocktail
    PREFIX + '\x8d\xb3': '🍳',          # 🍳 cooking
    PREFIX + '\x8d\xbd\ufe0f\x8f': '🍽️', # 🍽️ plate (with vs)
    PREFIX + '\x8d\xbd\ufe0f': '🍽️',   # 🍽️ plate
    PREFIX + '\x8d\xbd': '🍽',          # 🍽 plate
    PREFIX + '\x8d\xa4': '🍤',          # 🍤 fried shrimp
    PREFIX + '\x8d\x97': '🍗',          # 🍗 poultry leg
    PREFIX + '\x8d\x9f': '🍟',          # 🍟 fries (0x9F=Ÿ)
    PREFIX + '\x8d\u0161': '🍚',        # 🍚 cooked rice (š=0x9A)
    PREFIX + '\x8d\u0160': '🍊',        # 🍊 tangerine (Š=0x8A)
    PREFIX + '\u2039': '🍋',             # 🍋 lemon (‹=0x8B)
    PREFIX + '\x8d\u2014': '🍗',        # 🍗 poultry leg (—=0x97)
    PREFIX + '\x8d\u0178': '🍟',        # 🍟 fries (Ÿ=0x9F)
    PREFIX + '\x8d\u201c': '🍔',        # 🍔 hamburger (left-quote=0x93)
    PREFIX + '\x8d\u201d': '🍕',        # 🍕 pizza (right-quote=0x94)
    PREFIX + '\x8d\xb2': '🍲',          # 🍲 pot of food
    # Building/structure emojis
    PREFIX + '\xa2': '🏢',              # 🏢 building
    PREFIX + '\x95': '🕐',              # 🕐 clock face
    # Animal range (F0 9F 90 xx)
    PREFIX + '\x90\u0178': '🐟',        # 🐟 fish
    # Other
    PREFIX + '\u0152': '🌐',            # 🌐 globe (Œ=0x8C)
    PREFIX + '\u017d': '🎁',            # 🎁 gift (Ž=0x8E)
    PREFIX + '\u201d': '🔍',            # 🔍 magnifier (right-quote=0x94)
    PREFIX + '\u2019\xb2': '💲',        # 💲 dollar (0x92+0xB2)
    # ï¸ variation selector alone
    'ï¸': '\ufe0f',
}

dirs_to_skip = {'node_modules', 'vendor', 'assets'}

def fix_file(fpath):
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        original = content
        changes = []
        for broken, fixed in ALL_FIXES.items():
            count = content.count(broken)
            if count > 0:
                content = content.replace(broken, fixed)
                changes.append((fixed, count))
        if content != original:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes
    except Exception as e:
        print(f'  ERROR {fpath}: {e}')
    return []

# Fix dist folder
print('=== Fixing DIST folder ===')
total = 0
for root, dirs, files in os.walk(base_dist):
    dirs[:] = [d for d in dirs if d not in dirs_to_skip]
    for fname in files:
        if not fname.endswith(('.html', '.js', '.css')):
            continue
        fpath = os.path.join(root, fname)
        changes = fix_file(fpath)
        if changes:
            total += 1
            rel = os.path.relpath(fpath, base_dist)
            emojis = ', '.join(f'{e}({n}x)' for e, n in changes)
            print(f'  {rel}: {emojis}')

print(f'\nFixed {total} files in dist/')

# Verify dist/configuracoes.html
print('\n=== Verify dist/configuracoes.html ===')
with open(os.path.join(base_dist, 'configuracoes.html'), 'r', encoding='utf-8') as f:
    content = f.read()
lines = content.split('\n')
for i, line in enumerate(lines, 1):
    if ('Hora' in line or 'Diária' in line or 'Mensal' in line) and 'value=' in line:
        print(f'L{i}: {line.strip()[:150]}')
