import type { SfxKind } from '../game/store';

/**
 * Soundeffekte, vollständig mit der Web Audio API synthetisiert (keine Audiodateien, keine Fremdlizenz).
 *
 * Figurenklang nach dem Prinzip der Modal-Synthese: ein sehr kurzer Rauschimpuls regt mehrere schmale
 * Resonatoren an (die Eigenfrequenzen von lackiertem Holz/Stein), dazu der tiefe Resonanzkörper des Bretts
 * und ein kleiner Raumhall. Jeder Zug klingt leicht anders (Zufallsvariation), damit nichts mechanisch wirkt.
 * Glockentöne (Schach, Umwandlung, Partieende) bestehen aus unharmonischen Teiltönen.
 *
 * Figur setzen und Schlagen nutzen bevorzugt echte Aufnahmen (CC0, Kenney „Impact Sounds“, aufbereitet von
 * scripts/build-sounds.py): Holzkörper + heller Anschlag, je 5 Varianten, zufällig kombiniert und leicht verstimmt.
 * Solange die Aufnahmen nicht geladen sind (oder fehlen), klingt die Synthese.
 *
 * Alle Klänge werden über `renderInto` in einen beliebigen AudioContext geschrieben – auch in einen
 * OfflineAudioContext, damit sich Pegel und Länge ohne Lautsprecher prüfen lassen.
 */

interface SampleBank {
  moveBody: AudioBuffer[];
  moveClick: AudioBuffer[];
  captureBody: AudioBuffer[];
  captureClink: AudioBuffer[];
}

/** Kriegerkampf: Klingen, Schild, Faustschlag, Sturz, Schritte (ebenfalls Kenney CC0) */
interface BattleBank {
  clash: AudioBuffer[];
  block: AudioBuffer[];
  hit: AudioBuffer[];
  fall: AudioBuffer[];
  step: AudioBuffer[];
}

const SAMPLE_FILES: Record<keyof SampleBank, string> = {
  moveBody: 'move-body',
  moveClick: 'move-click',
  captureBody: 'capture-body',
  captureClink: 'capture-clink',
};

const BATTLE_FILES: Record<keyof BattleBank, string> = {
  clash: 'battle-clash',
  block: 'battle-block',
  hit: 'battle-hit',
  fall: 'battle-fall',
  step: 'battle-step',
};

async function loadBank<K extends string>(ctx: BaseAudioContext, files: Record<K, string>): Promise<Record<K, AudioBuffer[]>> {
  const base = typeof document !== 'undefined' ? document.baseURI : '/';
  const load = (prefix: string) =>
    Promise.all(
      [0, 1, 2, 3, 4].map(async (i) => {
        const res = await fetch(new URL(`sounds/${prefix}-${i}.mp3`, base).href);
        if (!res.ok) throw new Error(`Sound ${prefix}-${i}: HTTP ${res.status}`);
        return ctx.decodeAudioData(await res.arrayBuffer());
      }),
    );
  const entries = await Promise.all((Object.keys(files) as K[]).map(async (k) => [k, await load(files[k])] as const));
  return Object.fromEntries(entries) as Record<K, AudioBuffer[]>;
}

const loadSampleBank = (ctx: BaseAudioContext): Promise<SampleBank> => loadBank(ctx, SAMPLE_FILES);
const loadBattleBank = (ctx: BaseAudioContext): Promise<BattleBank> => loadBank(ctx, BATTLE_FILES);

interface Chain {
  ctx: BaseAudioContext;
  /** trockener Eingang */
  dry: AudioNode;
  /** Hall-Eingang */
  wet: AudioNode;
  noise: AudioBuffer;
  samples?: SampleBank;
  battle?: BattleBank;
}

function createNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Kurzer, gedämpfter Raumhall (zur Laufzeit erzeugte Impulsantwort). */
function createImpulse(ctx: BaseAudioContext, seconds = 1.4, decay = 3.2): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // frühe Reflexionen etwas dichter, danach exponentiell ausklingend
      const early = i < ctx.sampleRate * 0.03 ? 1.6 : 1;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early;
    }
  }
  return buffer;
}

function buildChain(ctx: BaseAudioContext, destination: AudioNode): Chain {
  const dry = ctx.createGain();
  dry.gain.value = 1;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulse(ctx);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 6500;
  dry.connect(destination);
  wet.connect(convolver).connect(tone).connect(destination);
  return { ctx, dry, wet, noise: createNoise(ctx) };
}

const vary = (value: number, amount: number) => value * (1 + (Math.random() * 2 - 1) * amount);

/** Einzelner abklingender Sinus-Teilton */
function partial(c: Chain, freq: number, start: number, decay: number, gain: number, toWet = 0.6) {
  const osc = c.ctx.createOscillator();
  const g = c.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  osc.connect(g);
  g.connect(c.dry);
  if (toWet > 0) {
    const send = c.ctx.createGain();
    send.gain.value = toWet;
    g.connect(send).connect(c.wet);
  }
  osc.start(start);
  osc.stop(start + decay + 0.05);
}

/**
 * Aufsetzen einer Figur: Impuls → Resonatoren (Holz/Lack) + Brettkörper.
 * `pitch` > 1 = heller/kleinere Fläche, `force` = Lautstärke.
 */
function placement(c: Chain, start: number, force = 1, pitch = 1) {
  const p = vary(pitch, 0.04);
  // Anregung: 3 ms Rauschimpuls mit steiler Hüllkurve
  const src = c.ctx.createBufferSource();
  src.buffer = c.noise;
  const env = c.ctx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(1, start + 0.0006);
  env.gain.exponentialRampToValueAtTime(0.001, start + 0.004);
  src.connect(env);
  src.start(start, Math.random() * 0.2, 0.02);

  // Eigenfrequenzen (unharmonisch, wie bei Holz) mit eigener Abklingzeit
  const modes: Array<[number, number, number]> = [
    // Frequenz, Güte, Pegel
    [1180, 22, 1.0],
    [2330, 28, 0.62],
    [3610, 34, 0.4],
    [5150, 40, 0.22],
  ];
  for (const [f, q, level] of modes) {
    const bp = c.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = vary(f * p, 0.03);
    bp.Q.value = q;
    const g = c.ctx.createGain();
    g.gain.value = level * force * 2.6;
    env.connect(bp).connect(g).connect(c.dry);
    const send = c.ctx.createGain();
    send.gain.value = 0.35;
    g.connect(send).connect(c.wet);
  }
  // heller Anschlag (sehr kurz, Hochpass)
  const click = c.ctx.createBiquadFilter();
  click.type = 'highpass';
  click.frequency.value = 4200;
  const clickGain = c.ctx.createGain();
  clickGain.gain.value = 0.18 * force;
  env.connect(click).connect(clickGain).connect(c.dry);
  // Brettkörper: tiefer, schnell abklingender Ton
  const body = c.ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(vary(165, 0.08) * Math.sqrt(p), start);
  body.frequency.exponentialRampToValueAtTime(95, start + 0.09);
  const bodyGain = c.ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, start);
  bodyGain.gain.exponentialRampToValueAtTime(0.32 * force, start + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
  body.connect(bodyGain).connect(c.dry);
  body.start(start);
  body.stop(start + 0.15);
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function playBuffer(c: Chain, buffer: AudioBuffer, start: number, gain: number, rate: number, toWet = 0.3) {
  const src = c.ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = c.ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.dry);
  if (toWet > 0) {
    const send = c.ctx.createGain();
    send.gain.value = toWet;
    g.connect(send).connect(c.wet);
  }
  src.start(start);
}

/** Aufsetzen einer Figur – Aufnahme, wenn geladen, sonst Synthese. `heavy` = Schlagen. */
function knock(c: Chain, start: number, force = 1, pitch = 1, heavy = false) {
  const bank = c.samples;
  if (!bank) {
    if (heavy) {
      placement(c, start, 0.7 * force, 1.45 * pitch); // Anschlagen an der geschlagenen Figur
      placement(c, start + 0.07, force, 0.95 * pitch); // Aufsetzen
      bell(c, 2093, start + 0.02, 0.022, 0.6); // feiner Goldklang
    } else placement(c, start, force, pitch);
    return;
  }
  const rate = vary(pitch, 0.04);
  if (heavy) {
    playBuffer(c, pick(bank.moveClick), start, 0.45 * force, vary(1.15, 0.04)); // Anschlagen
    playBuffer(c, pick(bank.captureBody), start + 0.06, 0.75 * force, rate);
    playBuffer(c, pick(bank.captureClink), start + 0.065, 0.16 * force, vary(1, 0.05), 0.6);
  } else {
    playBuffer(c, pick(bank.moveBody), start, 0.62 * force, rate);
    playBuffer(c, pick(bank.moveClick), start + 0.002, 0.5 * force, rate);
  }
}

/** Glockenton mit unharmonischen Teiltönen (Gold/Kristall) */
function bell(c: Chain, freq: number, start: number, gain: number, length = 1.4) {
  const ratios: Array<[number, number, number]> = [
    // Verhältnis, Pegel, Abklingfaktor
    [1, 1, 1],
    [2.01, 0.42, 0.7],
    [2.76, 0.3, 0.55],
    [4.07, 0.16, 0.4],
    [5.43, 0.08, 0.3],
  ];
  for (const [r, level, d] of ratios) partial(c, freq * r, start, length * d, gain * level, 0.8);
}

/** Anlauf-Rauschen bis zum Einschlag */
function whoosh(c: Chain, start: number, end: number) {
  const src = c.ctx.createBufferSource();
  src.buffer = c.noise;
  src.loop = true;
  const bp = c.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(350, start);
  bp.frequency.exponentialRampToValueAtTime(2600, end);
  const g = c.ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.32, end - 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, end + 0.03);
  src.connect(bp).connect(g).connect(c.dry);
  src.start(start);
  src.stop(end + 0.06);
}

/** Leises „Abheben“ beim Auswählen */
function lift(c: Chain, start: number) {
  const src = c.ctx.createBufferSource();
  src.buffer = c.noise;
  const bp = c.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2600, start);
  bp.frequency.exponentialRampToValueAtTime(4200, start + 0.05);
  bp.Q.value = 6;
  const g = c.ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.5, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
  src.connect(bp).connect(g).connect(c.dry);
  src.start(start, Math.random() * 0.2, 0.08);
}

/** Gedämpfter, tiefer Ton für „nicht erlaubt“ – deutlich, aber nicht schrill */
function deny(c: Chain, start: number) {
  const osc = c.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(196, start);
  osc.frequency.exponentialRampToValueAtTime(130, start + 0.16);
  const lp = c.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const g = c.ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.16, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
  osc.connect(lp).connect(g).connect(c.dry);
  osc.start(start);
  osc.stop(start + 0.25);
}

/** Rauschen durch einen wandernden Bandpass – Schwung einer Waffe, Verwandlung */
function sweep(c: Chain, start: number, length: number, f0: number, f1: number, gain: number, q = 1.6) {
  const src = c.ctx.createBufferSource();
  src.buffer = c.noise;
  src.loop = true;
  const bp = c.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, start);
  bp.frequency.exponentialRampToValueAtTime(f1, start + length);
  const g = c.ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + length * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length + 0.04);
  src.connect(bp).connect(g).connect(c.dry);
  const send = c.ctx.createGain();
  send.gain.value = 0.3;
  g.connect(send).connect(c.wet);
  src.start(start);
  src.stop(start + length + 0.08);
}

/** Klänge des Kriegerkampfs (ausgelöst von der Szene im Takt der Animation) */
export type BattleSfx = 'transform' | 'step' | 'swing' | 'clash' | 'block' | 'hit' | 'death' | 'fall' | 'cheer' | 'vanish';

function renderBattle(c: Chain, kind: BattleSfx, t: number) {
  const bank = c.battle;
  switch (kind) {
    case 'transform':
      // Verwandlung: aufsteigendes Rauschen, tiefer Stoß, heller Glanz
      sweep(c, t, 0.38, 260, 3200, 0.3, 1.2);
      partial(c, 58, t + 0.3, 0.6, 0.3, 0.5);
      [1568, 2093, 2637].forEach((f, i) => bell(c, f, t + 0.26 + i * 0.05, 0.018, 0.9));
      break;
    case 'step':
      if (bank) playBuffer(c, pick(bank.step), t, 0.32, vary(1.1, 0.06), 0.15);
      else placement(c, t, 0.35, 0.6);
      break;
    case 'swing':
      sweep(c, t, 0.17, 500, 2600, 0.22, 1.8);
      break;
    case 'clash':
      // Klinge auf Klinge: Aufnahme + metallisches Nachklingen
      if (bank) playBuffer(c, pick(bank.clash), t, 0.75, vary(1, 0.05), 0.5);
      else placement(c, t, 1, 2.2);
      bell(c, vary(2637, 0.03), t, 0.035, 0.8);
      bell(c, vary(3951, 0.03), t + 0.004, 0.02, 0.6);
      break;
    case 'block':
      // Schlag auf den Schild
      if (bank) {
        playBuffer(c, pick(bank.block), t, 0.8, vary(0.95, 0.05), 0.45);
        playBuffer(c, pick(bank.clash), t + 0.01, 0.25, vary(0.8, 0.05), 0.3);
      } else placement(c, t, 1, 1.6);
      partial(c, 95, t, 0.25, 0.18, 0.3);
      break;
    case 'hit':
      if (bank) playBuffer(c, pick(bank.hit), t, 0.85, vary(1, 0.05), 0.35);
      else placement(c, t, 1, 0.7);
      partial(c, 78, t, 0.3, 0.26, 0.3);
      break;
    case 'death':
      // Todesstoß: härter, tiefer, mit Klingenklang
      if (bank) {
        playBuffer(c, pick(bank.hit), t, 1, vary(0.85, 0.04), 0.4);
        playBuffer(c, pick(bank.clash), t + 0.005, 0.45, vary(0.9, 0.04), 0.5);
      } else placement(c, t, 1.1, 0.6);
      partial(c, 52, t, 0.7, 0.34, 0.6);
      bell(c, 1975.5, t, 0.03, 0.9);
      break;
    case 'fall':
      if (bank) playBuffer(c, pick(bank.fall), t, 0.9, vary(0.9, 0.05), 0.35);
      if (c.samples) playBuffer(c, pick(c.samples.captureBody), t + 0.01, 0.5, 0.7, 0.3);
      else placement(c, t, 0.9, 0.55);
      partial(c, 60, t, 0.35, 0.22, 0.3);
      break;
    case 'cheer':
      // kurze Siegesfanfare
      [392, 523.25, 659.25].forEach((f, i) => bell(c, f, t + i * 0.09, 0.045, 1.3));
      bell(c, 783.99, t + 0.3, 0.05, 1.8);
      break;
    case 'vanish':
      sweep(c, t, 0.3, 2800, 420, 0.16, 1.4);
      [2093, 1568].forEach((f, i) => bell(c, f, t + i * 0.06, 0.014, 0.7));
      break;
  }
}

/** Schreibt den Effekt `kind` ab Zeitpunkt `t` in die Klangkette. */
function renderInto(c: Chain, kind: SfxKind, t: number) {
  switch (kind) {
    case 'move':
      knock(c, t, 0.85);
      break;
    case 'capture':
      knock(c, t, 1, 1, true);
      break;
    case 'strike': {
      // Anlauf: anschwellendes Rauschen, dann Einschlag mit Metallklang (passend zu ATTACK_IMPACT = 0,46 s)
      const hitAt = t + 0.45;
      whoosh(c, t + 0.12, hitAt);
      knock(c, hitAt, 1.15, 1, true);
      bell(c, 1567.98, hitAt, 0.05, 0.7);
      bell(c, 2349.3, hitAt + 0.005, 0.03, 0.5);
      partial(c, 70, hitAt, 0.35, 0.22, 0.4); // tiefer Schlag
      break;
    }
    case 'castle':
      knock(c, t, 0.85, 1.0);
      knock(c, t + 0.13, 0.75, 1.08);
      break;
    case 'check':
      knock(c, t, 0.9);
      bell(c, 1318.5, t + 0.05, 0.05, 1.3);
      bell(c, 1760, t + 0.17, 0.035, 1.1);
      break;
    case 'promote':
      knock(c, t, 0.85);
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(c, f, t + 0.06 + i * 0.075, 0.028, 1.2));
      break;
    case 'select':
      lift(c, t);
      break;
    case 'illegal':
      deny(c, t);
      break;
    case 'ui':
      partial(c, 1760, t, 0.12, 0.03, 0.3);
      partial(c, 2637, t, 0.08, 0.012, 0.3);
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, f, t + i * 0.12, 0.07, 2.2));
      break;
    case 'loss':
      [440, 392, 349.23, 293.66].forEach((f, i) => bell(c, f, t + i * 0.16, 0.06, 1.8));
      break;
    case 'draw':
      [523.25, 698.46, 783.99].forEach((f, i) => bell(c, f, t + i * 0.13, 0.06, 1.8));
      bell(c, 659.25, t + 0.5, 0.05, 2);
      break;
  }
}

/** Ungefähre Länge eines Effekts in Sekunden (für Offline-Prüfungen) */
export const SFX_LENGTH: Record<SfxKind, number> = {
  move: 1.3,
  capture: 1.5,
  strike: 2.0,
  castle: 1.5,
  check: 2.2,
  promote: 2.4,
  select: 0.6,
  illegal: 0.6,
  ui: 0.6,
  win: 3.2,
  loss: 3.2,
  draw: 3.2,
};

// ---------- Live-Wiedergabe ----------

let live: { ctx: AudioContext; master: GainNode; chain: Chain } | null = null;
let volume = 0.8;

function liveChain() {
  if (typeof window === 'undefined') return null;
  if (!live) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = volume;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    master.connect(limiter).connect(ctx.destination);
    live = { ctx, master, chain: buildChain(ctx, master) };
    const chain = live.chain;
    loadSampleBank(ctx).then(
      (bank) => {
        chain.samples = bank;
      },
      (err) => console.warn('Aufgenommene Sounds nicht verfügbar – nutze Synthese.', err),
    );
    loadBattleBank(ctx).then(
      (bank) => {
        chain.battle = bank;
      },
      (err) => console.warn('Kampf-Sounds nicht verfügbar – nutze Synthese.', err),
    );
  }
  if (live.ctx.state === 'suspended') void live.ctx.resume();
  return live;
}

/** Muss einmal aus einer Nutzeraktion heraus aufgerufen werden (Browser-Autoplay-Regeln). */
export function unlockAudio() {
  liveChain();
}

export function setVolume(value: number) {
  volume = Math.min(1, Math.max(0, value));
  if (live) live.master.gain.setTargetAtTime(volume, live.ctx.currentTime, 0.02);
}

export function playSfx(kind: SfxKind) {
  const l = liveChain();
  if (!l || volume <= 0) return;
  renderInto(l.chain, kind, l.ctx.currentTime + 0.005);
}

export function playBattleSfx(kind: BattleSfx) {
  const l = liveChain();
  if (!l || volume <= 0) return;
  renderBattle(l.chain, kind, l.ctx.currentTime + 0.005);
}

// ---------- Offline-Prüfung ----------

export interface SfxStats {
  kind: SfxKind;
  peak: number;
  rms: number;
  /** Zeit, bis der Pegel dauerhaft unter -50 dB fällt */
  audibleSeconds: number;
  finite: boolean;
}

/** Rendert einen Effekt ohne Lautsprecher und misst Spitzenpegel, Lautheit und hörbare Länge. */
export async function analyseSfx(kind: SfxKind, sampleRate = 44100, withSamples = true): Promise<SfxStats> {
  const length = SFX_LENGTH[kind];
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * length), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  const chain = buildChain(ctx, master);
  if (withSamples) chain.samples = await loadSampleBank(ctx);
  renderInto(chain, kind, 0.01);
  const buffer = await ctx.startRendering();
  let peak = 0;
  let sum = 0;
  let lastLoud = 0;
  let finite = true;
  const threshold = Math.pow(10, -50 / 20);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (!Number.isFinite(v)) finite = false;
      if (v > peak) peak = v;
      sum += v * v;
      if (v > threshold && i > lastLoud) lastLoud = i;
    }
  }
  return {
    kind,
    peak,
    rms: Math.sqrt(sum / (buffer.length * buffer.numberOfChannels)),
    audibleSeconds: lastLoud / sampleRate,
    finite,
  };
}
