"""Bereitet die CC0-Texturen (Poly Haven) für den Stil „Echt“ auf: Größe, Farbkorrektur, JPEG-Qualität, Raumlicht kopieren.
Aufruf: python -I scripts/build-real-textures.py <assets-src> <public>
Die Farbkorrektur (kräftigere Farben, tieferes Schwarz) wird hier eingebacken – früher lief sie bei jedem Spielstart
Pixel für Pixel im Browser (bis 2 s, auf Handys länger)."""
import os
import shutil
import sys

import numpy as np
from PIL import Image

# Farbkorrektur je Ausgabedatei: Sättigung, Kontrast um die Mitte, Gamma (> 1 = tiefere Schatten), Helligkeit je Kanal
GRADES = {
    'board_diff.jpg': dict(saturation=1.35, contrast=1.28, gamma=1.25, gain=(1.04, 1.0, 0.94)),
    'pieces_black_diff.jpg': dict(saturation=1.2, contrast=1.4, gamma=2.1),
    'pieces_white_diff.jpg': dict(saturation=1.3, contrast=1.12, gamma=1.05, gain=(1.03, 1.0, 0.93)),
    'table_diff.jpg': dict(saturation=1.7, contrast=1.25, gamma=1.1, gain=(1.1, 0.98, 0.82)),
}


def grade(img, saturation=1.0, contrast=1.0, gamma=1.0, gain=(1.0, 1.0, 1.0)):
    """Gleiche Rechnung wie früher in realAssets.ts (Werte 0–1, Luma-Sättigung, Gamma, Kontrast, Kanalverstärkung)"""
    px = np.asarray(img.convert('RGB'), dtype=np.float64) / 255.0
    luma = px @ np.array([0.299, 0.587, 0.114])
    px = luma[..., None] + (px - luma[..., None]) * saturation
    px = (np.power(np.maximum(px, 0), gamma) - 0.5) * contrast + 0.5
    px = np.clip(px * np.array(gain) * 255.0, 0, 255)
    return Image.fromarray(np.rint(px).astype(np.uint8), 'RGB')


src, dst = sys.argv[1], sys.argv[2]
tex_dir = os.path.join(dst, 'textures')
os.makedirs(tex_dir, exist_ok=True)
os.makedirs(os.path.join(dst, 'env'), exist_ok=True)

chess = os.path.join(src, 'polyhaven-chess-set', 'textures')
wood = os.path.join(src, 'polyhaven-wood-table')

# (Quelle, Ziel, Kantenlänge, Qualität)
JOBS = [
    (f'{chess}/chess_set_pieces_white_diff_1k.jpg', 'pieces_white_diff.jpg', 1024, 86),
    (f'{chess}/chess_set_pieces_white_nor_gl_1k.jpg', 'pieces_white_nor.jpg', 1024, 88),
    (f'{chess}/chess_set_pieces_white_arm_1k.jpg', 'pieces_white_arm.jpg', 512, 86),
    (f'{chess}/chess_set_pieces_black_diff_1k.jpg', 'pieces_black_diff.jpg', 1024, 86),
    (f'{chess}/chess_set_pieces_black_nor_gl_1k.jpg', 'pieces_black_nor.jpg', 1024, 88),
    (f'{chess}/chess_set_pieces_black_arm_1k.jpg', 'pieces_black_arm.jpg', 512, 86),
    (f'{chess}/chess_set_board_diff_2k.jpg', 'board_diff.jpg', 2048, 84),
    (f'{chess}/chess_set_board_nor_gl_2k.jpg', 'board_nor.jpg', 1024, 88),
    (f'{chess}/chess_set_board_arm_2k.jpg', 'board_arm.jpg', 1024, 86),
    (f'{wood}/wood_table_001_diff_1k.jpg', 'table_diff.jpg', 1024, 84),
    (f'{wood}/wood_table_001_nor_gl_1k.jpg', 'table_nor.jpg', 1024, 86),
    (f'{wood}/wood_table_001_arm_1k.jpg', 'table_arm.jpg', 512, 84),
]

total = 0
for source, name, size, quality in JOBS:
    img = Image.open(source).convert('RGB')
    if img.size[0] != size:
        img = img.resize((size, size), Image.LANCZOS)
    if name in GRADES:
        img = grade(img, **GRADES[name])
    out = os.path.join(tex_dir, name)
    img.save(out, 'JPEG', quality=quality, optimize=True, progressive=True)
    total += os.path.getsize(out)
    print(f'{name:24s} {size}px {os.path.getsize(out) // 1024} KB')

hdr = os.path.join(dst, 'env', 'lebombo_1k.hdr')
shutil.copyfile(os.path.join(src, 'polyhaven-lebombo', 'lebombo_1k.hdr'), hdr)
total += os.path.getsize(hdr)
print(f'Raumlicht lebombo_1k.hdr {os.path.getsize(hdr) // 1024} KB · gesamt {total // 1024} KB')
