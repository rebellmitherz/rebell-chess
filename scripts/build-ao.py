"""Erzeugt aus der ARM-Textur (AO/Rauheit/Metall) des Poly-Haven-Schachsets eine kleine Verdeckungskarte.
Aufruf: python -I scripts/build-ao.py <chess_set_pieces_white_arm_1k.jpg> <ausgabe.jpg>"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
ao = Image.open(src).convert('RGB').split()[0]  # Rotkanal = Ambient Occlusion
ao = ao.resize((512, 512), Image.LANCZOS)
ao.convert('RGB').save(dst, 'JPEG', quality=86, optimize=True)
print('geschrieben', dst, ao.size, 'min/max', ao.getextrema())
