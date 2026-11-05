import type { Color, PieceSymbol } from '../core/types';
import { pick } from '../i18n';

/** Text in beiden Sprachen (Gegner-Sprüche und Namen stehen hier, nicht im Wörterbuch) */
export interface Bi {
  de: string;
  en: string;
}

export const say = (t: Bi): string => pick(t.de, t.en);

/**
 * Feldzug: sieben Gegner mit steigender Stärke (Stufen 1–7 der Rebell-KI). Jeder hat ein Wappen (Marmorfigur auf
 * farbigem Ring), einen Beinamen und eigene Sprüche zum Start und zum Ende. Der letzte ist der Rebell selbst.
 */
export interface Opponent {
  id: number;
  level: number;
  /** Figur im Wappen */
  piece: PieceSymbol;
  /** Farbe der Figur im Wappen */
  pieceColor: Color;
  /** Farbe des Rings */
  ring: string;
  name: Bi;
  title: Bi;
  greet: Bi[];
  /** Spruch, wenn der Gegner gewinnt */
  wins: Bi;
  /** Spruch, wenn der Spieler gewinnt */
  loses: Bi;
}

export const OPPONENTS: Opponent[] = [
  {
    id: 1,
    level: 1,
    piece: 'p',
    pieceColor: 'w',
    ring: '#7f9a52',
    name: { de: 'Benno der Bauer', en: 'Benno the Pawn' },
    title: { de: 'Ehrlich, aber ungeschickt', en: 'Honest but clumsy' },
    greet: [
      { de: 'Hallo! Bauern ziehen doch nach vorn, oder?', en: 'Hi! Pawns move forward, right?' },
      { de: 'Sei nett zu mir, ich übe noch.', en: 'Be nice, I am still learning.' },
    ],
    wins: { de: 'Ich … hab gewonnen? Wirklich?', en: 'I … won? Really?' },
    loses: { de: 'Gut gespielt! Kalle wartet schon auf dich.', en: 'Well played! Kit is waiting for you.' },
  },
  {
    id: 2,
    level: 2,
    piece: 'n',
    pieceColor: 'w',
    ring: '#4f87ad',
    name: { de: 'Kalle der Knappe', en: 'Kit the Squire' },
    title: { de: 'Springt gern hin und her', en: 'Loves to jump around' },
    greet: [
      { de: 'Hopp, hopp – meine Springer sind bereit!', en: 'Hop, hop – my knights are ready!' },
      { de: 'Ich bin schneller, als du denkst.', en: 'I am quicker than you think.' },
    ],
    wins: { de: 'Ha! Erwischt!', en: 'Ha! Gotcha!' },
    loses: { de: 'Uff. Lia wird dich nicht so leicht davonkommen lassen.', en: 'Phew. Lia will not let you off that easily.' },
  },
  {
    id: 3,
    level: 3,
    piece: 'b',
    pieceColor: 'w',
    ring: '#8d62c2',
    name: { de: 'Lia die Läuferin', en: 'Lia the Bishop' },
    title: { de: 'Blitzschnell auf langen Diagonalen', en: 'Lightning fast on long diagonals' },
    greet: [
      { de: 'Achte auf die Diagonalen. Ich tue es.', en: 'Watch the diagonals. I do.' },
      { de: 'Eine Partie? Gern. Aber ich schenke dir nichts.', en: 'A game? Sure. But I give nothing away.' },
    ],
    wins: { de: 'Die Diagonale war die ganze Zeit offen.', en: 'That diagonal was open the whole time.' },
    loses: { de: 'Respekt. Tobias hält seine Türme aber dicht.', en: 'Respect. But Tobias keeps his rooks tight.' },
  },
  {
    id: 4,
    level: 4,
    piece: 'r',
    pieceColor: 'w',
    ring: '#b8843a',
    name: { de: 'Tobias der Turmwächter', en: 'Tobias the Warden' },
    title: { de: 'Hält jede Linie dicht', en: 'Holds every file shut' },
    greet: [
      { de: 'Meine Mauern sind noch nie gefallen.', en: 'My walls have never fallen.' },
      { de: 'Plan, Geduld, Druck. In dieser Reihenfolge.', en: 'Plan, patience, pressure. In that order.' },
    ],
    wins: { de: 'Die Mauer steht. Wie immer.', en: 'The wall stands. As always.' },
    loses: { de: 'Eine Bresche! Dame Valeska wird das nicht freuen.', en: 'A breach! Lady Valeska will not like this.' },
  },
  {
    id: 5,
    level: 5,
    piece: 'q',
    pieceColor: 'w',
    ring: '#c4566a',
    name: { de: 'Dame Valeska', en: 'Lady Valeska' },
    title: { de: 'Gnadenlos präzise', en: 'Ruthlessly precise' },
    greet: [
      { de: 'Du bist weit gekommen. Hier endet es.', en: 'You have come far. It ends here.' },
      { de: 'Ein Fehler genügt mir.', en: 'One mistake is all I need.' },
    ],
    wins: { de: 'Ein Fehler. Ich sagte es doch.', en: 'One mistake. I told you.' },
    loses: { de: 'Beeindruckend. König Aurel erwartet dich.', en: 'Impressive. King Aurel awaits you.' },
  },
  {
    id: 6,
    level: 6,
    piece: 'k',
    pieceColor: 'w',
    ring: '#d4af37',
    name: { de: 'König Aurel', en: 'King Aurel' },
    title: { de: 'Herrscht seit hundert Partien', en: 'Has ruled for a hundred games' },
    greet: [
      { de: 'Knie nieder – oder spiel um deine Krone.', en: 'Kneel – or play for your crown.' },
      { de: 'Hundert Herausforderer. Keiner hat gewonnen.', en: 'A hundred challengers. None has won.' },
    ],
    wins: { de: 'Die Krone bleibt, wo sie ist.', en: 'The crown stays where it is.' },
    loses: { de: 'Unmöglich … Dann bleibt nur noch der Rebell.', en: 'Impossible … Then only the Rebel remains.' },
  },
  {
    id: 7,
    level: 7,
    piece: 'k',
    pieceColor: 'b',
    ring: '#e0322a',
    name: { de: 'Der Rebell', en: 'The Rebel' },
    title: { de: 'Herr des Bretts', en: 'Master of the board' },
    greet: [
      { de: 'Endlich. Zeig mir, was du gelernt hast.', en: 'At last. Show me what you have learned.' },
      { de: 'Jede Figur auf diesem Brett kämpft für mich.', en: 'Every piece on this board fights for me.' },
    ],
    wins: { de: 'Das Brett gehört mir. Komm wieder, wenn du bereit bist.', en: 'The board is mine. Come back when you are ready.' },
    loses: { de: 'Du … bist der neue Rebell.', en: 'You … are the new Rebel.' },
  },
];

export function getOpponent(id: number): Opponent | undefined {
  return OPPONENTS.find((o) => o.id === id);
}

/** Sprüche zu Ereignissen in der Partie (für alle Gegner) */
export const LINES: Record<'aiCaptures' | 'playerCaptures' | 'aiChecks' | 'playerChecks' | 'duel' | 'draw', Bi[]> = {
  aiCaptures: [
    { de: 'Das gehört jetzt mir!', en: 'That one is mine now!' },
    { de: 'Danke für das Geschenk.', en: 'Thanks for the gift.' },
    { de: 'Zack – weg damit!', en: 'Bam – gone!' },
    { de: 'Hast du das übersehen?', en: 'Did you miss that?' },
  ],
  playerCaptures: [
    { de: 'Autsch!', en: 'Ouch!' },
    { de: 'Das tat weh.', en: 'That hurt.' },
    { de: 'Nicht schlecht …', en: 'Not bad …' },
    { de: 'Das merke ich mir!', en: 'I will remember that!' },
  ],
  aiChecks: [
    { de: 'Schach! Pass auf deinen König auf.', en: 'Check! Mind your king.' },
    { de: 'Schach!', en: 'Check!' },
    { de: 'Dein König wackelt …', en: 'Your king is wobbling …' },
  ],
  playerChecks: [
    { de: 'Huch – Schach?', en: 'Whoa – check?' },
    { de: 'Mein König! Ruhig bleiben …', en: 'My king! Stay calm …' },
    { de: 'Frech!', en: 'Cheeky!' },
  ],
  duel: [
    { de: 'Zu den Waffen!', en: 'To arms!' },
    { de: 'Jetzt wird gekämpft!', en: 'Now we fight!' },
    { de: 'Klingen raus!', en: 'Draw your blades!' },
  ],
  draw: [{ de: 'Unentschieden. Nächstes Mal entscheiden wir es.', en: 'A draw. Next time we settle it.' }],
};
