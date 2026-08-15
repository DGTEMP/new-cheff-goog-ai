import sys, os
sys.stdout.reconfigure(encoding='utf-8')

# Map broken 4-byte emoji sequences to correct emojis
# The pattern: original emoji F0 9x 8x Ax
# After double-encoding where 0x80-0x9F bytes are lost (cp1252 undefined):
# F0 -> ð (C3B0)
# 9x -> lost (undefined in cp1252)  
# 8x -> lost (undefined in cp1252)
# Ax -> valid latin char

# So we need to map by context: ðŸ + next char(s)

# Let's decode empirically what each broken sequence should be
# by looking at the char AFTER ðŸ (which comes from the 4th byte of the emoji)

EMOJI_4BYTE_MAP = {
    # 3rd+4th byte patterns -> correct emoji
    # \x8d\xbd = 🍽️ (fork and knife with plate) - F0 9F 8D BD
    '\u00f0\u0178\x8d\xbd': '🍽️',   # ðŸ\x8d½ -> 🍽️
    '\u00f0\u0178\x8d\xb3': '🍳',    # ðŸ\x8d³ -> 🍳 (cooking)
    '\u00f0\u0178\x8e\x81': '🎁',    # ðŸŽ\x81 -> 🎁 (gift/present)
    '\u00f0\u0178\x8d\x94': '🍔',    # ðŸ\x8d" -> 🍔 (hamburger)
    '\u00f0\u0178\x8c\x90': '🌐',    # ðŸŒ\x90 -> 🌐 (globe)
    '\u00f0\u0178\x94': '🔍',         # ðŸ" -> 🔍 (magnifier)
    '\u00f0\u0178\x8f\xaf': '🏯',    # just in case
}

# Let's check by raw byte analysis
with open(r'c:\Users\computer\Desktop\chef cozinha\configuracoes.html', 'rb') as f:
    raw = f.read()

# Find ðŸ in UTF-8 bytes = C3B0 C5B8 = F0 9x8x pattern
search = b'\xc3\xb0\xc5\xb8'
idx = 0
while True:
    idx = raw.find(search, idx)
    if idx == -1:
        break
    # Get the bytes after
    snippet = raw[idx:idx+12]
    print(f'Pos {idx}: hex={snippet.hex()}')
    print(f'  UTF-8: {repr(snippet.decode("utf-8", errors="replace"))}')
    # Try to decode: C3B0 = ð (F0), C5B8 = Ÿ (9F), then next bytes...
    # The original emoji bytes were: F0 9F [XX] [YY]
    # After double-encoding: C3B0 C29F C2XX C2YY (if XX,YY in 80-BF range)
    # But 9F is undefined in cp1252, so it becomes 3F (?) or gets dropped
    # Let's check what comes after C5B8
    after = raw[idx+4:idx+8]
    print(f'  After Ÿ: hex={after.hex()} = {repr(after.decode("utf-8", errors="replace"))}')
    idx += 4
