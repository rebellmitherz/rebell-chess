"""Erzeugt die App-Symbole (PWA, Apple) im Stil des Spiels: goldene Münze mit schwarzem Springer auf dunklem Grund.
Aufruf: python -I scripts/build-icons.py <zielordner>"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT = r'C:\Windows\Fonts\seguisym.ttf'  # enthält die Schachsymbole
out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)


def icon(size, coin_ratio, rounded):
    s = size * 4  # hochauflösend zeichnen, dann verkleinern (glatte Kanten)
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Hintergrund
    radius = int(s * 0.22) if rounded else 0
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=(11, 12, 16, 255))
    # Goldmünze mit radialem Verlauf
    coin = int(s * coin_ratio)
    c0 = (s - coin) // 2
    gradient = Image.new('RGBA', (coin, coin))
    gd = ImageDraw.Draw(gradient)
    steps = 120
    for i in range(steps):
        t = i / steps
        r = int(coin / 2 * (1 - t))
        # außen dunkleres Gold, innen hell (Lichtpunkt leicht links oben)
        col = (int(141 + (255 - 141) * t), int(100 + (241 - 100) * t), int(36 + (196 - 36) * t), 255)
        cx = coin / 2 - coin * 0.12 * t
        cy = coin / 2 - coin * 0.15 * t
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    mask = Image.new('L', (coin, coin), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, coin - 1, coin - 1], fill=255)
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([c0 - s * 0.03, c0 - s * 0.03, c0 + coin + s * 0.03, c0 + coin + s * 0.03], fill=(226, 185, 92, 90))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(s * 0.03)))
    img.paste(gradient, (c0, c0), mask)
    # Springer
    font = ImageFont.truetype(FONT, int(coin * 0.68))
    glyph = '\u265E'
    d = ImageDraw.Draw(img)
    box = d.textbbox((0, 0), glyph, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1] + coin * 0.01), glyph, font=font, fill=(29, 22, 10, 255))
    return img.resize((size, size), Image.LANCZOS)


targets = [
    ('icon-192.png', 192, 0.74, True),
    ('icon-512.png', 512, 0.74, True),
    # „maskable“: Android schneidet bis zu 20 % ab – Motiv kleiner, Hintergrund randlos
    ('icon-maskable-512.png', 512, 0.58, False),
    ('apple-touch-icon.png', 180, 0.74, False),
]
for name, size, ratio, rounded in targets:
    path = os.path.join(out_dir, name)
    icon(size, ratio, rounded).save(path, optimize=True)
    print('geschrieben', path, os.path.getsize(path), 'Bytes')
