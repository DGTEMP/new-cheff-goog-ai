import sys, os, shutil
from datetime import datetime
sys.stdout.reconfigure(encoding='utf-8')

base = r'c:\Users\computer\Desktop\chef cozinha'
dirs_to_skip = {'node_modules', 'dist', 'backups', 'dist-check', '.git', 'iniciodoprojetorestaura'}

def has_double_encoding(raw_bytes):
    """Detect if UTF-8 file has double-encoded sequences."""
    try:
        text = raw_bytes.decode('utf-8')
    except UnicodeDecodeError:
        return False
    
    # Try to re-decode: encode as latin-1, then decode as utf-8
    try:
        re_encoded = text.encode('latin-1', errors='strict')
        re_decoded = re_encoded.decode('utf-8', errors='strict')
        # If successful and differs, it's double-encoded
        return re_decoded != text
    except (UnicodeEncodeError, UnicodeDecodeError):
        return False

def fix_double_encoding(raw_bytes):
    """Fix double-encoded UTF-8 content."""
    text = raw_bytes.decode('utf-8')
    try:
        fixed = text.encode('latin-1', errors='replace').decode('utf-8', errors='replace')
        return fixed
    except Exception:
        return text

# Find all files with double-encoded content
to_fix = []
for root, dirs, files in os.walk(base):
    dirs[:] = [d for d in dirs if d not in dirs_to_skip]
    for fname in files:
        if not fname.endswith(('.html', '.js', '.css')):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, 'rb') as f:
                raw = f.read()
            if has_double_encoding(raw):
                to_fix.append(fpath)
        except Exception as e:
            print(f'Error reading {fpath}: {e}')

print(f'Files with double-encoding: {len(to_fix)}')
for p in to_fix:
    print(f'  {p}')

# Create backup
ts = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_dir = os.path.join(base, 'backups', 'emoji_fix_' + ts)
os.makedirs(backup_dir, exist_ok=True)

# Apply fix
fixed_count = 0
for fpath in to_fix:
    try:
        with open(fpath, 'rb') as f:
            raw = f.read()
        
        # Backup
        rel = os.path.relpath(fpath, base)
        bpath = os.path.join(backup_dir, rel)
        os.makedirs(os.path.dirname(bpath), exist_ok=True)
        shutil.copy2(fpath, bpath)
        
        # Fix
        fixed = fix_double_encoding(raw)
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(fixed)
        
        fixed_count += 1
        print(f'Fixed: {fpath}')
    except Exception as e:
        print(f'ERROR {fpath}: {e}')

print(f'\nDone! Fixed {fixed_count} files.')
print(f'Backups: {backup_dir}')
