import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import type { TrackedPiece } from '../core/pieceTracking';
import { coordsToSquare, squareToCoords, type Color, type Square } from '../core/types';
import { gameStore, useGame } from '../game/instance';
import { canHumanInteract, displayPly } from '../game/store';
import { tr } from '../i18n';
import { squareToWorld } from '../scene/boardMath';
import { ATTACK_IMPACT, KNOCK_TOTAL, knockPose, moveDuration, movePose, type MoveProfile } from '../scene/choreography';
import { emitImpact, subscribeImpacts, type Impact } from '../scene/ImpactFX';

/**
 * 2D-Ansicht: flaches Brett von oben als HTML statt 3D – klar lesbar, schnell, auch auf schwachen Handys.
 * Brett und Figuren sind Bilder aus den echten 3D-Bausteinen (scripts/build-sprites.mjs): das Marmorbrett von oben
 * und die Marmorfiguren frontal. Die Bewegungsabläufe (Abheben, Ansturm, Schlag, Zurückschleudern) und die Einschlag-
 * Effekte kommen aus denselben Funktionen wie in 3D. Kriegerkämpfe laufen weiter in der 3D-Szene: das 2D-Brett blendet
 * sich dafür kurz aus.
 */

const FILES = 'abcdefgh';
const DRAG_THRESHOLD_PX = 6;

function boardUrl(): string {
  return new URL('pieces2d/board.webp', document.baseURI).href;
}

export function spriteUrl(color: Color, type: string): string {
  return new URL(`pieces2d/${color}${type}.webp`, document.baseURI).href;
}

/** Mitte eines Weltpunkts auf dem Brett in Feldeinheiten von links/oben (0…8) */
function toGrid(x: number, z: number, side: Color): { gx: number; gy: number } {
  return side === 'w' ? { gx: x + 4, gy: z + 4 } : { gx: 4 - x, gy: 4 - z };
}

/** Spalte/Zeile auf dem Bildschirm (0 = links bzw. oben) */
function screenPos(square: Square, side: Color): { col: number; row: number } {
  const { file, rank } = squareToCoords(square);
  return side === 'w' ? { col: file, row: 7 - rank } : { col: 7 - file, row: rank };
}

function squareAt(col: number, row: number, side: Color): Square | null {
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return side === 'w' ? coordsToSquare(col, 7 - row) : coordsToSquare(7 - col, row);
}

const at = (square: Square, side: Color) => {
  const { col, row } = screenPos(square, side);
  return { transform: `translate(${col * 100}%, ${row * 100}%)` };
};

const cell = (gx: number, gy: number) => `translate(${(gx - 0.5) * 100}%, ${(gy - 0.5) * 100}%)`;

const sign = (v: number) => (v < 0 ? -1 : 1);

/** Zug: Figur gleitet/springt/stürmt wie in 3D (gleiche Bewegungsfunktionen), Höhe zeigt sich als Anheben und Wachsen */
function animateMove(wrap: HTMLElement, img: HTMLElement, from: Square, to: Square, profile: MoveProfile, side: Color) {
  const [fx, fz] = squareToWorld(from);
  const [tx, tz] = squareToWorld(to);
  const dur = moveDuration(profile, Math.hypot(tx - fx, tz - fz));
  const n = Math.max(10, Math.round(dur * 60));
  const dirX = sign(side === 'w' ? tx - fx : fx - tx);
  const moveKf: Keyframe[] = [];
  const imgKf: Keyframe[] = [];
  for (let i = 0; i <= n; i++) {
    const p = movePose(profile, fx, fz, tx, tz, (dur * i) / n);
    const { gx, gy } = toGrid(p.x, p.z, side);
    const grow = 1 + p.y * 0.4;
    moveKf.push({ transform: cell(gx, gy) });
    imgKf.push({
      transform: `translateY(${-p.y * 60}%) rotate(${p.tilt * dirX * 22}deg) scale(${(grow / Math.sqrt(p.squash)).toFixed(3)}, ${(grow * p.squash).toFixed(3)})`,
    });
  }
  wrap.style.zIndex = '6';
  const a = wrap.animate(moveKf, { duration: dur * 1000, easing: 'linear' });
  a.onfinish = a.oncancel = () => {
    wrap.style.zIndex = '';
  };
  img.animate(imgKf, { duration: dur * 1000, easing: 'linear' });
}

/** Funkenregen wie `Burst` in 3D: Funken fliegen hoch und fallen zurück, Farbe nach getroffener Figur */
function sparks(fx: HTMLElement, cx: number, cy: number, sq: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.6 + Math.random() * 1.4;
    const vy = 1.6 + Math.random() * 2.2;
    const el = document.createElement('span');
    el.className = 'b2d-spark';
    const size = sq * (0.07 + Math.random() * 0.06);
    Object.assign(el.style, {
      left: `${cx}%`,
      top: `${cy}%`,
      width: `${size}px`,
      height: `${size}px`,
      background: `radial-gradient(circle, #fff 0%, ${color} 45%, transparent 72%)`,
    });
    const kf: Keyframe[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = (k / 12) * 0.95;
      const y = 0.25 + vy * t - 2.6 * t * t;
      const dx = Math.cos(a) * s * t * 0.45 * sq;
      const dy = -y * sq * 0.85 + Math.sin(a) * s * t * 0.45 * sq * 0.5;
      kf.push({ transform: `translate(${dx - size / 2}px, ${dy - size / 2}px)`, opacity: Math.max(0, 1 - t / 0.95) });
    }
    fx.appendChild(el);
    el.animate(kf, { duration: 950, easing: 'linear' }).onfinish = () => el.remove();
  }
}

/** Alle Einschlag-Effekte von 3D auf dem flachen Brett: Blitz, Druckwelle, Glutball, Funken, Beben */
function playImpact(imp: Impact, side: Color, board: HTMLElement, grid: HTMLElement, fx: HTMLElement) {
  const { gx, gy } = toGrid(imp.x, imp.z, side);
  const cx = gx * 12.5;
  const cy = gy * 12.5;
  const sq = grid.clientWidth / 8;
  const gold = imp.victim === 'w';
  const add = (css: Partial<CSSStyleDeclaration>, kf: Keyframe[], ms: number, cls = '') => {
    const el = document.createElement('div');
    el.className = `b2d-fx-el ${cls}`;
    Object.assign(el.style, { left: `${cx}%`, top: `${cy}%`, ...css });
    fx.appendChild(el);
    el.animate(kf, { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
  };
  // Blitz auf dem Brett (das Licht in 3D)
  add(
    { width: `${sq * 5}px`, height: `${sq * 5}px`, background: 'radial-gradient(circle, rgba(255,226,160,0.9) 0%, rgba(255,200,110,0.35) 35%, transparent 70%)', mixBlendMode: 'screen' },
    [
      { transform: 'translate(-50%,-50%) scale(0.5)', opacity: Math.min(1, 0.55 * imp.power + 0.2) },
      { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0 },
    ],
    450,
  );
  if (imp.ring) {
    add(
      { width: `${sq}px`, height: `${sq}px`, border: `${Math.max(2, sq * 0.07)}px solid ${gold ? '#ffd27a' : '#dfe6ff'}`, borderRadius: '50%', mixBlendMode: 'screen' },
      [
        { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0.85 },
        { transform: 'translate(-50%,-50%) scale(5)', opacity: 0 },
      ],
      400,
    );
  }
  if (imp.burst) {
    const ball = 1.35 * imp.power;
    add(
      { width: `${sq}px`, height: `${sq}px`, background: `radial-gradient(circle, #fff 0%, ${gold ? '#ffd27a' : '#ff9a5a'} 35%, transparent 70%)`, borderRadius: '50%', mixBlendMode: 'screen' },
      [
        { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 1 },
        { transform: `translate(-50%,-50%) scale(${(0.25 + ball * 1.6).toFixed(2)})`, opacity: 0 },
      ],
      280,
    );
    sparks(fx, cx, cy, sq, gold ? '#ffd27a' : '#e4ebff', Math.round(36 + imp.power * 12));
  }
  // Beben des Bretts: abklingendes Zittern in Schlagrichtung
  const a = imp.power * sq * 0.07;
  const sx = sign(side === 'w' ? imp.dirX : -imp.dirX) * (imp.dirX === 0 ? 0 : 1);
  const sy = sign(side === 'w' ? imp.dirZ : -imp.dirZ) * (imp.dirZ === 0 ? 0 : 1);
  const kf: Keyframe[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) * 0.35;
    const k = a * Math.exp(-t * 11);
    kf.push({ transform: `translate(${Math.sin(t * 95) * k + sx * k * 0.6}px, ${Math.cos(t * 83) * k + sy * k * 0.6}px)` });
  }
  board.animate(kf, { duration: 350, easing: 'linear' });
}

/** Pfeil für den Trainingshinweis (Brett = 8 × 8 Einheiten) */
function HintArrow({ from, to, side }: { from: Square; to: Square; side: Color }) {
  const a = screenPos(from, side);
  const b = screenPos(to, side);
  const x1 = a.col + 0.5;
  const y1 = a.row + 0.5;
  const dx = b.col - a.col;
  const dy = b.row - a.row;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const x2 = b.col + 0.5 - ux * 0.22;
  const y2 = b.row + 0.5 - uy * 0.22;
  const head = 0.38;
  const hx = x2 - ux * head;
  const hy = y2 - uy * head;
  return (
    <svg className="b2d-arrow" viewBox="0 0 8 8" aria-hidden="true">
      <line x1={x1 + ux * 0.2} y1={y1 + uy * 0.2} x2={hx} y2={hy} stroke="currentColor" strokeWidth={0.16} strokeLinecap="round" />
      <polygon fill="currentColor" points={`${x2},${y2} ${hx - uy * 0.24},${hy + ux * 0.24} ${hx + uy * 0.24},${hy - ux * 0.24}`} />
    </svg>
  );
}

interface PieceProps {
  piece: TrackedPiece;
  square: Square;
  side: Color;
  profile: MoveProfile;
  lifted: boolean;
  inCheck: boolean;
  mated: boolean;
  turned: boolean;
  /** Zeigerposition in px relativ zum Brett, solange die Figur gezogen wird */
  drag: { x: number; y: number } | null;
  /** Nach dem Loslassen einer gezogenen Figur gibt es keinen Zug-Ablauf mehr (sie ist schon da) */
  skipAnim: MutableRefObject<string | null>;
}

function Piece2D({ piece, square, side, profile, lifted, inCheck, mated, turned, drag, skipAnim }: PieceProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const prevSquare = useRef(square);
  const prevType = useRef(piece.type);

  useLayoutEffect(() => {
    const from = prevSquare.current;
    prevSquare.current = square;
    if (from === square) return;
    if (skipAnim.current === piece.id) {
      skipAnim.current = null;
      return;
    }
    animateMove(wrap.current!, img.current!, from, square, profile, side);
    // profile gehört zum Zug, nicht zur Rückkehr auf dasselbe Feld
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [square]);

  // Umwandlung: neue Figur „poppt“ auf
  useEffect(() => {
    if (prevType.current === piece.type) return;
    prevType.current = piece.type;
    img.current?.animate(
      [
        { transform: 'scale(0.6)', filter: 'brightness(2.2)' },
        { transform: 'scale(1.3)', filter: 'brightness(1.5)', offset: 0.45 },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: 520, easing: 'ease-out' },
    );
  }, [piece.type]);

  const dragging = drag !== null;
  return (
    <div
      ref={wrap}
      className={`b2d-piece c-${piece.color}${dragging ? ' lifted' : ''}${lifted && !dragging ? ' lift' : ''}${inCheck ? ' check' : ''}${mated ? ` mated ${piece.color}` : ''}${turned ? ' turned' : ''}`}
      style={dragging ? { transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -58%)` } : at(square, side)}
    >
      <img ref={img} src={spriteUrl(piece.color, piece.type)} alt="" draggable={false} />
    </div>
  );
}

interface GhostData {
  key: string;
  piece: TrackedPiece;
  /** Schlagrichtung (vom Angreifer weg) – null = einfaches Verschwinden */
  dir: { dirX: number; dirZ: number } | null;
}

/** Geschlagene Figur: zittert bis zum Einschlag, wird zurückgeschleudert, überschlägt sich, prallt auf und verblasst */
function Ghost2D({ ghost, side, turned, onDone }: { ghost: GhostData; side: Color; turned: boolean; onDone: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const { piece, dir } = ghost;
    const [x, z] = squareToWorld(piece.square);
    const timers: number[] = [];
    if (dir) {
      const len = Math.hypot(dir.dirX, dir.dirZ) || 1;
      const dx = dir.dirX / len;
      const dz = dir.dirZ / len;
      const spinSign = sign(side === 'w' ? dx : -dx);
      const n = 48;
      const total = KNOCK_TOTAL + 0.1;
      const moveKf: Keyframe[] = [];
      const imgKf: Keyframe[] = [];
      for (let i = 0; i <= n; i++) {
        const k = knockPose(dx, dz, (total * i) / n);
        const { gx, gy } = toGrid(x + k.dx, z + k.dz, side);
        moveKf.push({ transform: cell(gx, gy), opacity: k.opacity });
        imgKf.push({ transform: `translateY(${-k.y * 50}%) rotate(${k.spin * spinSign * 40}deg) scale(${1 + k.y * 0.25})` });
      }
      wrap.current!.animate(moveKf, { duration: total * 1000, easing: 'linear', fill: 'forwards' });
      img.current!.animate(imgKf, { duration: total * 1000, easing: 'linear', fill: 'forwards' });
      timers.push(window.setTimeout(() => emitImpact({ x, z, dirX: dx, dirZ: dz, victim: piece.color, power: 1.25, ring: false }), ATTACK_IMPACT * 1000));
      timers.push(window.setTimeout(onDone, total * 1000));
    } else {
      // Ohne Kampf-Animation: versinkt kurz und verpufft mit Funken
      img.current!.animate(
        [
          { transform: 'translateY(0) scale(1) rotate(0)', opacity: 1 },
          { transform: 'translateY(-6%) scale(0.85) rotate(30deg)', opacity: 0.6, offset: 0.5 },
          { transform: 'translateY(8%) scale(0.45) rotate(80deg)', opacity: 0 },
        ],
        { duration: 600, easing: 'ease-in', fill: 'forwards' },
      );
      emitImpact({ x, z, dirX: 0, dirZ: 0, victim: piece.color, power: 0.4, ring: false });
      timers.push(window.setTimeout(onDone, 700));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // einmal beim Einhängen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={wrap} className={`b2d-piece ghost c-${ghost.piece.color}${turned ? ' turned' : ''}`} style={at(ghost.piece.square, side)}>
      <img ref={img} src={spriteUrl(ghost.piece.color, ghost.piece.type)} alt="" draggable={false} />
    </div>
  );
}

interface Drag {
  pointerId: number;
  from: Square;
  pieceId: string;
  startX: number;
  startY: number;
  /** Auswahl vor dem Antippen (erneutes Antippen hebt sie auf) */
  wasSelected: boolean;
  active: boolean;
}

export function Board2D({ left, right, top, bottom, hidden }: { left: number; right: number; top: number; bottom: number; hidden: boolean }) {
  const side = useGame((s) => s.viewSide);
  const livePieces = useGame((s) => s.pieces);
  const viewPieces = useGame((s) => s.view?.pieces ?? null);
  const selected = useGame((s) => s.selected);
  const targets = useGame((s) => s.targets);
  const pending = useGame((s) => s.pendingPromotion);
  const last = useGame((s) => {
    const ply = displayPly(s);
    return ply > 0 ? s.history[ply - 1] : undefined;
  });
  const ply = useGame((s) => displayPly(s));
  const viewing = useGame((s) => s.viewPly !== null);
  const checkSquare = useGame((s) => (s.viewPly !== null ? (s.view?.checkSquare ?? null) : s.status.checkSquare));
  const hint = useGame((s) => s.hint);
  const showLegal = useGame((s) => s.prefs.showLegalMoves);
  const showLast = useGame((s) => s.prefs.showLastMove);
  const coords = useGame((s) => s.prefs.showCoordinates);
  const theme = useGame((s) => s.prefs.pieceStyle);
  const battleOn = useGame((s) => s.prefs.battleMode !== 'off');
  const faceToFace = useGame((s) => s.prefs.faceToFace && s.settings.mode === 'local');
  const interactive = useGame(canHumanInteract);
  const mateSquare = useGame((s) => {
    const p = displayPly(s);
    return p > 0 && s.history[p - 1].isCheckmate ? checkSquare : null;
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const skipAnim = useRef<string | null>(null);
  const [dragView, setDragView] = useState<{ id: string; x: number; y: number; over: Square | null } | null>(null);
  const [ghosts, setGhosts] = useState<GhostData[]>([]);

  // Abgebrochene Partie, Kampf oder Analyse: laufendes Ziehen verwerfen
  useEffect(() => {
    if (!interactive && drag.current) {
      drag.current = null;
      setDragView(null);
    }
  }, [interactive]);

  // Einschläge (Schlag, Matt, Kampfschläge) wie in 3D auf dem flachen Brett zeigen
  const sideRef = useRef(side);
  sideRef.current = side;
  useEffect(
    () =>
      subscribeImpacts((imp) => {
        if (boardRef.current && gridRef.current && fxRef.current) playImpact(imp, sideRef.current, boardRef.current, gridRef.current, fxRef.current);
      }),
    [],
  );

  const pieces: TrackedPiece[] = viewPieces ?? livePieces;

  // Geschlagene Figuren: Geister, die zurückgeschleudert werden (nur echte Schlagzüge, nicht das Zurücksetzen der Partie)
  const prevPieces = useRef<TrackedPiece[]>(pieces);
  useEffect(() => {
    const ids = new Set(pieces.map((p) => p.id));
    const removed = prevPieces.current.filter((p) => !ids.has(p.id));
    prevPieces.current = pieces;
    const s = gameStore.getState();
    // Läuft ein Kriegerkampf, übernehmen die Krieger
    if (removed.length === 0 || removed.length > 2 || s.battle !== null || s.viewPly !== null) return;
    const move = s.history[s.history.length - 1];
    let dir: GhostData['dir'] = null;
    if (battleOn && move?.isCapture) {
      const [fx, fz] = squareToWorld(move.from);
      const [tx, tz] = squareToWorld(move.to);
      dir = { dirX: tx - fx, dirZ: tz - fz };
    }
    const stamp = performance.now();
    setGhosts((g) => [...g, ...removed.map((p) => ({ key: `${p.id}-${stamp}`, piece: p, dir }))]);
  }, [pieces, battleOn]);

  // Umwandlung: Funkenschauer auf dem Feld (wie in 3D)
  const lastPly = useRef(ply);
  useEffect(() => {
    if (ply === lastPly.current + 1 && !viewing && last?.promotion) {
      const [x, z] = squareToWorld(last.to);
      emitImpact({ x, z, dirX: 0, dirZ: 0, victim: 'w', power: 0.5, ring: false });
    }
    lastPly.current = ply;
  }, [ply, viewing, last]);

  const squareFromEvent = (e: { clientX: number; clientY: number }): Square | null => {
    const r = gridRef.current!.getBoundingClientRect();
    return squareAt(Math.floor(((e.clientX - r.left) / r.width) * 8), Math.floor(((e.clientY - r.top) / r.height) * 8), side);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || drag.current) return;
    const square = squareFromEvent(e);
    if (!square) return;
    const s = gameStore.getState();
    const piece = s.pieces.find((p) => p.square === square);
    if (canHumanInteract(s) && piece && piece.color === s.status.turn) {
      const wasSelected = s.selected === square;
      // Eigene Figur: sofort auswählen (Punkte zeigen), dann ziehen oder loslassen
      if (!wasSelected) s.selectSquare(square);
      drag.current = { pointerId: e.pointerId, from: square, pieceId: piece.id, startX: e.clientX, startY: e.clientY, wasSelected, active: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    s.selectSquare(square);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
    d.active = true;
    const r = gridRef.current!.getBoundingClientRect();
    setDragView({ id: d.pieceId, x: e.clientX - r.left, y: e.clientY - r.top, over: squareFromEvent(e) });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragView(null);
    const s = gameStore.getState();
    const over = squareFromEvent(e);
    if (d.active) {
      if (over && over !== d.from && s.targets.some((t) => t.to === over)) skipAnim.current = d.pieceId;
      s.dropPiece(d.from, over);
    } else if (d.wasSelected && over === d.from) s.selectSquare(d.from);
  };

  const onPointerCancel = () => {
    drag.current = null;
    setDragView(null);
  };

  // Offene Umwandlungsauswahl: Bauer steht schon auf dem Zielfeld, eine geschlagene Figur ist weg
  const shown = pieces.flatMap((p) => {
    if (pending && p.square === pending.to) return [];
    return pending && p.square === pending.from ? [{ ...p, square: pending.to }] : [p];
  });
  const dropLegal = dragView?.over && targets.some((t) => t.to === dragView.over) ? dragView.over : null;
  const squares: Square[] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) squares.push(squareAt(col, row, side)!);
  // Das Marmorbrett hat helle Felder, wo Datei + Reihe gerade ist (so liegt es auch in 3D)
  const real = theme === 'real';
  const attackProfile = (p: TrackedPiece): MoveProfile =>
    battleOn && last?.isCapture && last.to === p.square && last.color === p.color ? 'attack' : p.type === 'n' ? 'hop' : 'glide';

  return (
    <div className={`b2d-stage${hidden ? ' hidden' : ''}`} style={{ left, right, top, bottom }}>
      <div ref={boardRef} className={`b2d-board theme-${theme}`} data-side={side} style={real ? { ['--board-img' as string]: `url("${boardUrl()}")` } : undefined}>
        <div
          ref={gridRef}
          className={`b2d-grid${interactive ? ' interactive' : ''}`}
          role="grid"
          aria-label={tr('Schachbrett')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {squares.map((sq, i) => {
            const { file, rank } = squareToCoords(sq);
            const light = real ? (file + rank) % 2 === 0 : (file + rank) % 2 === 1;
            const col = i % 8;
            const row = Math.floor(i / 8);
            return (
              <div key={sq} className={`b2d-sq ${light ? 'light' : 'dark'}`}>
                {coords && col === 0 && <span className="b2d-rank">{rank + 1}</span>}
                {coords && row === 7 && <span className="b2d-file">{FILES[file]}</span>}
              </div>
            );
          })}
          {showLast && last && (
            <>
              <div className="b2d-mark last" style={at(last.from, side)} />
              <div className="b2d-mark last" style={at(last.to, side)} />
            </>
          )}
          {selected && <div className="b2d-mark selected" style={at(selected, side)} />}
          {dropLegal && <div className="b2d-mark drop" style={at(dropLegal, side)} />}
          {checkSquare && <div className={`b2d-mark check${mateSquare ? ' mated' : ''}`} style={at(checkSquare, side)} />}
          {shown.map((p) => (
            <Piece2D
              key={p.id}
              piece={p}
              square={p.square}
              side={side}
              profile={attackProfile(p)}
              lifted={p.square === selected && !pending}
              inCheck={p.type === 'k' && p.square === checkSquare}
              mated={p.type === 'k' && p.square === mateSquare}
              turned={faceToFace && p.color !== side}
              drag={dragView?.id === p.id ? dragView : null}
              skipAnim={skipAnim}
            />
          ))}
          {ghosts.map((g) => (
            <Ghost2D key={g.key} ghost={g} side={side} turned={faceToFace && g.piece.color !== side} onDone={() => setGhosts((all) => all.filter((x) => x.key !== g.key))} />
          ))}
          {showLegal &&
            targets.map((t) => <div key={t.to} className={`b2d-mark ${t.isCapture ? 'capture' : 'target'}`} style={at(t.to, side)} />)}
          {hint?.status === 'ready' && hint.from && hint.to && <HintArrow from={hint.from} to={hint.to} side={side} />}
          <div ref={fxRef} className="b2d-fx" />
        </div>
      </div>
    </div>
  );
}
