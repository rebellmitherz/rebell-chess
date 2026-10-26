"""Bereitet ausgewählte CC0-Aufnahmen aus Kenneys „Impact Sounds“ (www.kenney.nl) für das Spiel auf:
mono, 44,1 kHz, -8 dB (die Originale sind über 0 dBFS gemastert), Stille am Ende entfernt, MP3 (läuft in allen Browsern).
Braucht ffmpeg im PATH. Aufruf: python -I scripts/build-sounds.py <kenney_impact-sounds.zip> <zielordner>"""
import os
import subprocess
import sys
import tempfile
import zipfile

SOURCES = {
    'move-body': 'impactWood_light',
    'move-click': 'impactGeneric_light',
    'capture-body': 'impactWood_medium',
    'capture-clink': 'impactGlass_light',
}

zip_path, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
archive = zipfile.ZipFile(zip_path)
names = {n.split('/')[-1]: n for n in archive.namelist()}

with tempfile.TemporaryDirectory() as tmp:
    for prefix, source in SOURCES.items():
        for i in range(5):
            name = f'{source}_{i:03d}.ogg'
            src = os.path.join(tmp, name)
            with open(src, 'wb') as f:
                f.write(archive.read(names[name]))
            dst = os.path.join(out_dir, f'{prefix}-{i}.mp3')
            subprocess.run(
                ['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', '44100',
                 '-af', 'volume=-8dB,areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse',
                 '-codec:a', 'libmp3lame', '-b:a', '96k', dst],
                check=True)
            print('geschrieben', dst, os.path.getsize(dst), 'Bytes')
