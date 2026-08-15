import sys, os, re
sys.stdout.reconfigure(encoding='utf-8')

with open(r'c:\Users\computer\Desktop\chef cozinha\dist\configuracoes.html', 'r', encoding='utf-8') as f:
    content = f.read()

scripts = re.findall(r'<script[^>]*src=["\']([^"\']*)["\']', content)
print('Scripts loaded:')
for s in scripts:
    print(' ', s)

print()
vendor = r'c:\Users\computer\Desktop\chef cozinha\dist\vendor'
if os.path.exists(vendor):
    print('Vendor files:')
    for root, dirs, files in os.walk(vendor):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), vendor)
            print(' ', rel)
else:
    print('No vendor folder in dist')

# Check source vendor too
vendor_src = r'c:\Users\computer\Desktop\chef cozinha\public'
if os.path.exists(vendor_src):
    print('\nPublic folder:')
    for root, dirs, files in os.walk(vendor_src):
        for f in files:
            print(' ', os.path.relpath(os.path.join(root, f), vendor_src))
