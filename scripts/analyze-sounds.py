"""Misst Audiodateien ohne Lautsprecher: Länge, Spitzenpegel, Lautheit (RMS), Ausklingzeit bis -40 dB
und spektralen Schwerpunkt (hell/dunkel). Braucht ffmpeg im PATH.
Aufruf: python -I scripts/analyze-sounds.py <datei> [<datei> ...]"""
import cmath
import math
import struct
import subprocess
import sys


def decode(path, rate=22050):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(rate), '-f', 'f32le', '-'],
        capture_output=True, check=True).stdout
    return list(struct.unpack(f'<{len(raw) // 4}f', raw)), rate


def centroid(samples, rate, n=512):
    # Schwerpunkt über die 512 Samples ab dem Anschlag
    peak_i = max(range(len(samples)), key=lambda i: abs(samples[i]))
    start = max(0, peak_i - 32)
    frame = samples[start:start + n] + [0.0] * max(0, n - len(samples[start:start + n]))
    window = [frame[i] * (0.5 - 0.5 * math.cos(2 * math.pi * i / (n - 1))) for i in range(n)]
    total = weighted = 0.0
    for k in range(1, n // 2, 2):  # jede zweite Frequenz reicht für den Schwerpunkt
        mag = abs(sum(window[t] * cmath.exp(-2j * math.pi * k * t / n) for t in range(n)))
        f = k * rate / n
        total += mag
        weighted += mag * f
    return weighted / total if total else 0.0


for path in sys.argv[1:]:
    s, rate = decode(path)
    peak = max(abs(v) for v in s) or 1e-9
    rms = math.sqrt(sum(v * v for v in s) / len(s))
    limit = peak * 10 ** (-40 / 20)
    last = max((i for i, v in enumerate(s) if abs(v) > limit), default=0)
    print(f'{path.split("/")[-1]:32s} {len(s) / rate:5.2f}s  peak {20 * math.log10(peak):6.1f} dB  '
          f'rms {20 * math.log10(rms or 1e-9):6.1f} dB  klingt {last / rate:4.2f}s  Schwerpunkt {centroid(s, rate):6.0f} Hz')
