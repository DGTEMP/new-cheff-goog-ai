import os
import shutil
from datetime import datetime

base = r'c:\Users\computer\Desktop\chef cozinha'
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_dir = os.path.join(base, 'backups', 'encoding_fix_' + ts)
os.makedirs(backup_dir, exist_ok=True)

dirs_to_skip = {'node_modules', 'dist', 'backups', 'dist-check', '.git', 'iniciodoprojetorestaura'}

DOUBLE_ENC_MARKERS = ['Ã©', 'Ã¡', 'Ã³', 'Ã§', 'Ã£', 'Ã¢', 'Ã‰', 'Ã‡', 'â€', 'â€™', 'â€œ', 'Ã\x83', 'Ã\x93', 'Ã\x95']

def is_double_encoded(text):
    return any(c in text for c in DOUBLE_ENC_MARKERS)

double_encoded_files = []
for root, dirs, files in os.walk(base):
    dirs[:] = [d for d in dirs if d not in dirs_to_skip]
    for fname in files:
        if not fname.endswith(('.html', '.js', '.css')):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
            if is_double_encoded(content):
                double_encoded_files.append(fpath)
        except Exception:
            pass

print('Files to fix: ' + str(len(double_encoded_files)))
for p in double_encoded_files:
    print('  ' + p)

fixed = 0
errors = 0
for fpath in double_encoded_files:
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Double-encoding fix: the string was UTF-8 but read as latin-1 and stored as UTF-8 again
        # Reverse: encode as latin-1 to get original bytes, then decode as utf-8
        fixed_content = content.encode('latin-1', errors='replace').decode('utf-8', errors='replace')

        # Backup original
        rel_path = os.path.relpath(fpath, base)
        backup_path = os.path.join(backup_dir, rel_path)
        os.makedirs(os.path.dirname(backup_path), exist_ok=True)
        shutil.copy2(fpath, backup_path)

        # Write fixed
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        fixed += 1
        print('Fixed: ' + fpath)
    except Exception as e:
        print('ERROR ' + fpath + ': ' + str(e))
        errors += 1

print('')
print('Done! Fixed: ' + str(fixed) + ', Errors: ' + str(errors))
print('Backups at: ' + backup_dir)
