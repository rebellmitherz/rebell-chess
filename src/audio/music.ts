import { liveAudio } from './sound';

/**
 * Hintergrundmusik, vollständig mit der Web Audio API erzeugt (keine Audiodatei, keine Fremdlizenz):
 * ruhige, leicht epische Stimmung in d-Moll. Ein weicher Flächenklang trägt die Akkordfolge
 * d – B – F – C (je 8 Sekunden), darunter ein leiser Bass, darüber vereinzelte Harfentöne aus dem Akkord
 * und bei jedem Akkordwechsel ein dumpfer Paukenschlag. Jede Runde klingt anders (Zufall bei den Harfentönen).
 * Bewusst leise, damit Zugklänge und Kriegerkampf darüber klar bleiben.
 */

const CHORDS: number[][] = [
  // Grundton, Terz, Quinte (MIDI-Nummern) – d-Moll, B-Dur, F-Dur, C-Dur
  [50, 53, 57],
  [46, 50, 53],
  [53, 57, 60],
  [48, 52, 55],
];
const CHORD_SECONDS = 8;
const LEVEL = 0.18;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface Running {
  ctx: AudioContext;
  out: GainNode;
  timer: number;
  nextChord: number;
  chord: number;
}

let running: Running | null = null;
let wanted = false;

function pad(r: Running, chord: number[], start: number) {
  const { ctx, out } = r;
  const end = start + CHORD_SECONDS + 2.5;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(500, start);
  filter.frequency.linearRampToValueAtTime(1100, start + CHORD_SECONDS * 0.5);
  filter.frequency.linearRampToValueAtTime(600, end);
  filter.Q.value = 0.7;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(0.11, start + 2.2);
  env.gain.setValueAtTime(0.11, start + CHORD_SECONDS - 0.5);
  env.gain.linearRampToValueAtTime(0.0001, end);
  filter.connect(env).connect(out);
  for (const note of chord) {
    for (const detune of [-7, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = hz(note);
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.18;
      osc.connect(g).connect(filter);
      osc.start(start);
      osc.stop(end + 0.1);
    }
  }
  // Bass eine Oktave unter dem Grundton
  const bass = ctx.createOscillator();
  bass.type = 'sine';
  bass.frequency.value = hz(chord[0] - 12);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, start);
  bg.gain.linearRampToValueAtTime(0.22, start + 1.5);
  bg.gain.setValueAtTime(0.22, start + CHORD_SECONDS - 0.3);
  bg.gain.linearRampToValueAtTime(0.0001, start + CHORD_SECONDS + 1.2);
  bass.connect(bg).connect(out);
  bass.start(start);
  bass.stop(start + CHORD_SECONDS + 1.3);
}

/** Gezupfter Ton (Harfe): Dreieck mit schnellem Anschlag und langem Ausklingen, viel Hall */
function pluck(r: Running, midi: number, start: number, gain: number) {
  const { ctx, out } = r;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = hz(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 2.4);
  osc.connect(g).connect(out);
  const audio = liveAudio();
  if (audio) {
    const send = ctx.createGain();
    send.gain.value = 1.4;
    g.connect(send).connect(audio.wet);
  }
  osc.start(start);
  osc.stop(start + 2.5);
}

/** Dumpfer Paukenschlag beim Akkordwechsel */
function drum(r: Running, midi: number, start: number) {
  const { ctx, out } = r;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(hz(midi) * 1.6, start);
  osc.frequency.exponentialRampToValueAtTime(hz(midi), start + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.35, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 1.6);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + 1.7);
}

function scheduleChord(r: Running, start: number) {
  const chord = CHORDS[r.chord % CHORDS.length];
  pad(r, chord, start);
  if (r.chord % 2 === 0) drum(r, chord[0] - 12, start);
  // Harfe: zufällige Akkordtöne in den oberen Oktaven, nicht auf jedem Schlag
  const tones = [...chord.map((n) => n + 12), ...chord.map((n) => n + 24)];
  for (let beat = 0; beat < CHORD_SECONDS * 2; beat++) {
    if (Math.random() < (beat % 4 === 0 ? 0.7 : 0.28)) {
      pluck(r, tones[Math.floor(Math.random() * tones.length)], start + beat * 0.5 + Math.random() * 0.03, 0.05 + Math.random() * 0.04);
    }
  }
  r.chord++;
}

function start() {
  if (running) return;
  const audio = liveAudio();
  if (!audio) return;
  const { ctx, master } = audio;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + 3);
  out.connect(master);
  const r: Running = { ctx, out, timer: 0, nextChord: ctx.currentTime + 0.2, chord: 0 };
  // Vorausplanen: immer einen Akkord im Voraus
  const tick = () => {
    while (r.nextChord < ctx.currentTime + CHORD_SECONDS) {
      scheduleChord(r, r.nextChord);
      r.nextChord += CHORD_SECONDS;
    }
  };
  tick();
  r.timer = window.setInterval(tick, 1000);
  running = r;
}

function stop() {
  const r = running;
  if (!r) return;
  running = null;
  window.clearInterval(r.timer);
  const t = r.ctx.currentTime;
  r.out.gain.cancelScheduledValues(t);
  r.out.gain.setValueAtTime(r.out.gain.value, t);
  r.out.gain.linearRampToValueAtTime(0.0001, t + 1.2);
  setTimeout(() => r.out.disconnect(), 1500);
}

/** Musik ein- oder ausschalten (startet erst nach der ersten Nutzeraktion, wegen der Autoplay-Regeln) */
export function setMusic(on: boolean) {
  wanted = on;
  if (on && !document.hidden) start();
  else stop();
}

// Im Hintergrund (anderer Tab, Portal-Werbung) schweigt die Musik
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (wanted) start();
  });
}
