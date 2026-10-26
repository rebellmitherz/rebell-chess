"""Bereitet die CC0-Texturen (Poly Haven) für den Stil „Echt“ auf: Größe, JPEG-Qualität, Raumlicht kopieren.
Aufruf: python -I scripts/build-real-textures.py <assets-src> <public>"""
import os
import shutil
import sys

from PIL import Image

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
    out = os.path.join(tex_dir, name)
    img.save(out, 'JPEG', quality=quality, optimize=True, progressive=True)
    total += os.path.getsize(out)
    print(f'{name:24s} {size}px {os.path.getsize(out) // 1024} KB')

hdr = os.path.join(dst, 'env', 'lebombo_1k.hdr')
shutil.copyfile(os.path.join(src, 'polyhaven-lebombo', 'lebombo_1k.hdr'), hdr)
total += os.path.getsize(hdr)
print(f'Raumlicht lebombo_1k.hdr {os.path.getsize(hdr) // 1024} KB · gesamt {total // 1024} KB')
