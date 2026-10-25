import type { SfxKind } from '../game/store';

/**
 * Soundeffekte, vollständig mit der Web Audio API synthetisiert (keine Audiodateien, keine Fremdlizenz).
 * Figurenklang: gefiltertes Rauschen (Holz/Stein-Aufsetzer) + tiefer Körper + metallischer Oberton.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

/** Muss einmal aus einer Nutzeraktion heraus aufgerufen werden (Browser-Autoplay-Regeln). */
export function unlockAudio() {
  audio();
}

function tone(freq: number, start: number, duration: number, gain: number, type: OscillatorType = 'sine', glideTo?: number) {
  const a = audio();
  if (!a) return;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(a.out);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function knock(start: number, gain: number, freq = 1700, q = 1.4, length = 0.07) {
  const a = audio();
  if (!a || !noiseBuffer) return;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(g).connect(a.out);
  src.start(start, Math.random() * 0.3, length + 0.02);
  // Körper des Aufsetzers
  tone(170 + Math.random() * 30, start, 0.09, gain * 0.5, 'sine', 90);
}

export function playSfx(kind: SfxKind) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + 0.01;
  switch (kind) {
    case 'move':
      knock(t, 0.9);
      break;
    case 'capture':
      knock(t, 1.1, 1400, 1.1, 0.09);
      knock(t + 0.045, 0.7, 2200, 2, 0.06);
      tone(1320, t + 0.02, 0.45, 0.07, 'triangle');
      tone(1980, t + 0.02, 0.35, 0.04, 'sine');
      break;
    case 'castle':
      knock(t, 0.85);
      knock(t + 0.11, 0.75, 1500);
      break;
    case 'check':
      knock(t, 0.9);
      tone(880, t + 0.03, 0.28, 0.12, 'triangle');
      tone(1318.5, t + 0.16, 0.38, 0.11, 'triangle');
      break;
    case 'promote':
      knock(t, 0.8);
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + 0.05 + i * 0.07, 0.4, 0.08, 'triangle'));
      break;
    case 'select':
      tone(1500, t, 0.07, 0.035, 'sine');
      break;
    case 'illegal':
      tone(150, t, 0.16, 0.12, 'square', 110);
      break;
    case 'ui':
      tone(1046, t, 0.09, 0.04, 'sine');
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.11, 1.1, 0.1, 'triangle'));
      break;
    case 'loss':
      [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, t + i * 0.16, 1.0, 0.09, 'triangle'));
      break;
    case 'draw':
      [523.25, 587.33, 523.25].forEach((f, i) => tone(f, t + i * 0.14, 0.8, 0.08, 'triangle'));
      break;
  }
}
