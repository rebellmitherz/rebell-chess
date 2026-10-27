"""Packt den Portal-Build (dist-crazygames) als Zip für den Upload bei CrazyGames: index.html liegt im Wurzelordner.
Der Service Worker gehört nicht hinein (das Portal braucht ihn nicht). Prüft die Grenzen von CrazyGames:
höchstens 250 MB gesamt, 1500 Dateien. Aufruf: python -I scripts/pack-crazygames.py"""
import os
import sys
import zipfile

SRC = 'dist-crazygames'
OUT = os.path.join('crazygames', 'rebell-chess-crazygames.zip')
SKIP = {'sw.js', 'manifest.webmanifest'}
MAX_TOTAL_MB, MAX_FILES = 250, 1500

if not os.path.exists(os.path.join(SRC, 'index.html')):
    sys.exit('dist-crazygames/index.html fehlt – erst npm run build:crazygames ausführen')

files = []
for root, _, names in os.walk(SRC):
    for n in names:
        path = os.path.join(root, n)
        rel = os.path.relpath(path, SRC).replace(os.sep, '/')
        if rel in SKIP:
            continue
        files.append((path, rel))
total = sum(os.path.getsize(p) for p, _ in files)
if len(files) > MAX_FILES or total > MAX_TOTAL_MB * 1e6:
    sys.exit(f'Zu groß: {len(files)} Dateien, {total / 1e6:.1f} MB')
os.makedirs('crazygames', exist_ok=True)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path, rel in sorted(files, key=lambda f: (f[1] != 'index.html', f[1])):
        z.write(path, rel)
html = open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()
assert 'crazygames-sdk-v3.js' in html and 'rel="manifest"' not in html
print(f'{OUT}: {len(files)} Dateien, {total / 1e6:.1f} MB entpackt, {os.path.getsize(OUT) / 1e6:.1f} MB gepackt')
