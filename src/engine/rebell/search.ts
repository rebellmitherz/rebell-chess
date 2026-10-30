import type { SearchLimits, SearchResult } from '../types';
import { moveFrom, movePromo, moveTo, moveToUci, Position, KING, PAWN, QUEEN } from './board';
import { evaluate, PIECE_VALUE } from './evaluate';

const INFINITE = 32_000;
const MATE = 31_000;
const MATE_BOUND = MATE - 1_000;
const MAX_PLY = 96;
const MAX_MOVES = 256;
const MAX_DEPTH = 64;

const TT_SIZE = 1 << 19;
const TT_MASK = TT_SIZE - 1;
const TT_EXACT = 1;
const TT_LOWER = 2;
const TT_UPPER = 3;

const SCORE_TT = 1 << 26;
const SCORE_GOOD_CAPTURE = 1 << 24;
const SCORE_KILLER = 1 << 23;
const SCORE_BAD_CAPTURE = -(1 << 23);
const HISTORY_MAX = 1 << 20;

const now = () => performance.now();

/** Spätere Züge werden flacher durchsucht; bestätigt sich ein Zug doch, kommt die volle Tiefe */
const REDUCTION = Array.from({ length: 64 }, (_, depth) =>
  Array.from({ length: MAX_MOVES }, (_, count) => (depth && count ? Math.floor(0.6 + Math.log(depth) * Math.log(count) * 0.42) : 0)),
);

/** Alpha-Beta-Suche mit iterativer Vertiefung, Hauptvarianten-Suche und Transpositionstabelle. */
export class Searcher {
  private pos = new Position('8/8/8/8/8/8/8/8 w - - 0 1');
  private readonly ttKey = new Int32Array(TT_SIZE);
  private readonly ttMove = new Int32Array(TT_SIZE);
  private readonly ttScore = new Int16Array(TT_SIZE);
  private readonly ttDepth = new Int8Array(TT_SIZE);
  private readonly ttFlag = new Uint8Array(TT_SIZE);
  private readonly moves = new Int32Array(MAX_PLY * MAX_MOVES);
  private readonly order = new Int32Array(MAX_PLY * MAX_MOVES);
  private readonly killers = new Int32Array(MAX_PLY * 2);
  private readonly history = new Int32Array(2 * 128 * 128);

  private nodes = 0;
  private maxNodes = Infinity;
  private deadline = Infinity;
  private stopped = false;
  private rootBest = 0;
  private rootScore = 0;

  /** Neue Partie: Gelerntes vergessen */
  clear() {
    this.ttFlag.fill(0);
    this.history.fill(0);
  }

  /**
   * Sucht den besten Zug. `line`: Partie bis zu `fen` (Ausgangsstellung und Züge),
   * damit die KI Wiederholungen kennt; ohne `line` beginnt die Rechnung bei `fen`.
   */
  search(fen: string, limits: SearchLimits, line?: { startFen: string; moves: string[] }): SearchResult {
    this.setup(fen, line);
    const pos = this.pos;
    const legal = pos.legalMoves();
    if (legal.length === 0) return pos.inCheck() ? { bestMove: null, depth: 0, mate: 0, pv: [] } : { bestMove: null, depth: 0, scoreCp: 0, pv: [] };

    this.prepare(limits);
    const started = now();
    const maxDepth = Math.min(limits.depth ?? MAX_DEPTH, MAX_DEPTH);
    this.rootBest = legal[0];
    this.rootScore = 0;
    let completed = 0;
    let best = legal[0];
    let bestScore = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      const score = this.rootWindow(depth, bestScore);
      if (this.stopped && depth > 1) {
        // Abgebrochene Tiefe: ein schon gefundener besserer Zug gilt trotzdem
        best = this.rootBest;
        bestScore = this.rootScore;
        break;
      }
      best = this.rootBest;
      bestScore = score;
      completed = depth;
      if (Math.abs(score) > MATE_BOUND && depth >= (MATE - Math.abs(score)) + 1) break;
      if (limits.movetime && now() - started > limits.movetime * 0.55) break;
      if (legal.length === 1 && depth >= 4) break;
    }
    return this.result(best, bestScore, completed);
  }

  /**
   * Schwächere Spielweise: bewertet jeden Zug auf `depth` und wählt zufällig unter denen,
   * die höchstens `margin` Centipawns schlechter sind als der beste – je näher, desto wahrscheinlicher.
   */
  searchWeak(fen: string, depth: number, margin: number, random: () => number, line?: { startFen: string; moves: string[] }): SearchResult {
    this.setup(fen, line);
    const pos = this.pos;
    const legal = pos.legalMoves();
    if (legal.length === 0) return { bestMove: null, depth: 0, scoreCp: 0, pv: [] };
    this.prepare({});
    const scored = legal.map((move) => {
      pos.make(move);
      const score = -this.negamax(depth - 1, -INFINITE, INFINITE, 1, true, true);
      pos.unmake(move);
      return { move, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0].score;
    // Ein Matt lässt auch die schwache KI nicht liegen, wenn sie es gesehen hat
    const range = Math.abs(top) > MATE_BOUND ? 0 : margin;
    const candidates = scored.filter((s) => s.score >= top - range);
    const weights = candidates.map((s) => 1 / (1 + (top - s.score) / Math.max(1, range / 3)));
    let pick = random() * weights.reduce((sum, w) => sum + w, 0);
    let chosen = candidates[0];
    for (let i = 0; i < candidates.length; i++) {
      pick -= weights[i];
      if (pick <= 0) {
        chosen = candidates[i];
        break;
      }
    }
    return this.result(chosen.move, chosen.score, depth);
  }

  private setup(fen: string, line?: { startFen: string; moves: string[] }) {
    if (line) {
      this.pos.setFen(line.startFen);
      if (line.moves.every((m) => this.pos.playUci(m))) return;
    }
    this.pos.setFen(fen);
  }

  private prepare(limits: SearchLimits) {
    this.nodes = 0;
    this.stopped = false;
    this.maxNodes = limits.nodes ?? Infinity;
    this.deadline = limits.movetime ? now() + limits.movetime : Infinity;
    this.killers.fill(0);
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 3;
  }

  private result(best: number, score: number, depth: number): SearchResult {
    const pv = this.principalVariation(best, depth);
    const base = { bestMove: moveToUci(best), depth, pv };
    if (Math.abs(score) > MATE_BOUND) {
      const moves = Math.ceil((MATE - Math.abs(score)) / 2);
      return { ...base, mate: score > 0 ? moves : -moves };
    }
    return { ...base, scoreCp: score };
  }

  private principalVariation(first: number, depth: number): string[] {
    const pos = this.pos;
    const line: number[] = [];
    let move = first;
    while (move && line.length < Math.max(depth, 1) && line.length < 16) {
      if (!pos.legalMoves().includes(move)) break;
      pos.make(move);
      line.push(move);
      const slot = pos.hashLo & TT_MASK;
      move = this.ttFlag[slot] && this.ttKey[slot] === pos.hashHi ? this.ttMove[slot] : 0;
    }
    const uci = line.map(moveToUci);
    for (let i = line.length - 1; i >= 0; i--) pos.unmake(line[i]);
    return uci;
  }

  /** Suche mit engem Fenster um den letzten Wert; springt der Wert heraus, wird das Fenster geweitet */
  private rootWindow(depth: number, guess: number): number {
    if (depth < 5) return this.negamax(depth, -INFINITE, INFINITE, 0, true, false);
    let delta = 25;
    let alpha = Math.max(-INFINITE, guess - delta);
    let beta = Math.min(INFINITE, guess + delta);
    for (;;) {
      const score = this.negamax(depth, alpha, beta, 0, true, false);
      if (this.stopped) return score;
      if (score <= alpha) {
        alpha = Math.max(-INFINITE, score - delta);
      } else if (score >= beta) {
        beta = Math.min(INFINITE, score + delta);
      } else {
        return score;
      }
      delta *= 2;
      if (delta > 800) {
        alpha = -INFINITE;
        beta = INFINITE;
      }
    }
  }

  private tick() {
    if ((++this.nodes & 2047) === 0 && now() > this.deadline) this.stopped = true;
    if (this.nodes >= this.maxNodes) this.stopped = true;
  }

  private negamax(depthIn: number, alphaIn: number, betaIn: number, ply: number, pvNode: boolean, allowNull: boolean): number {
    this.tick();
    if (this.stopped) return 0;
    const pos = this.pos;
    let alpha = alphaIn;
    let beta = betaIn;
    if (ply > 0) {
      if (pos.isDraw()) return 0;
      alpha = Math.max(alpha, -MATE + ply);
      beta = Math.min(beta, MATE - ply - 1);
      if (alpha >= beta) return alpha;
    }
    if (ply >= MAX_PLY - 1) return evaluate(pos);
    const inCheck = pos.inCheck();
    const depth = inCheck ? depthIn + 1 : depthIn;
    if (depth <= 0) return this.quiescence(alpha, beta, ply);

    const slot = pos.hashLo & TT_MASK;
    const hit = this.ttFlag[slot] !== 0 && this.ttKey[slot] === pos.hashHi;
    const ttMove = hit ? this.ttMove[slot] : 0;
    if (hit && !pvNode && ply > 0 && this.ttDepth[slot] >= depth) {
      const stored = fromTable(this.ttScore[slot], ply);
      const flag = this.ttFlag[slot];
      if (flag === TT_EXACT || (flag === TT_LOWER && stored >= beta) || (flag === TT_UPPER && stored <= alpha)) return stored;
    }

    const staticEval = inCheck ? -INFINITE : evaluate(pos);
    if (!pvNode && !inCheck) {
      // Weit über Beta: Der Gegner lässt das nicht zu
      if (depth <= 6 && staticEval - 90 * depth >= beta && Math.abs(beta) < MATE_BOUND) return staticEval;
      // Selbst nach Aussetzen noch über Beta: Stellung braucht keine genaue Suche
      if (allowNull && depth >= 3 && staticEval >= beta && pos.hasPieces()) {
        pos.makeNull();
        const score = -this.negamax(depth - 3 - (depth >> 3), -beta, -beta + 1, ply + 1, false, false);
        pos.unmakeNull();
        if (this.stopped) return 0;
        if (score >= beta) return Math.abs(score) > MATE_BOUND ? beta : score;
      }
    }

    const base = ply * MAX_MOVES;
    const end = pos.generate(this.moves, base, false);
    this.scoreMoves(base, end, ttMove, ply);
    let best = -INFINITE;
    let bestMove = 0;
    let legal = 0;
    let quiets = 0;
    const startAlpha = alpha;
    const futile = !pvNode && !inCheck && depth <= 3 && staticEval + 130 * depth <= alpha;

    for (let i = base; i < end; i++) {
      this.pickNext(i, end);
      const move = this.moves[i];
      const quiet = !this.isTactical(move);
      if (legal > 0 && quiet && !inCheck && !pvNode && best > -MATE_BOUND) {
        if (futile || (depth <= 3 && quiets > 3 + depth * depth)) {
          quiets++;
          continue;
        }
      }
      if (!pos.make(move)) continue;
      legal++;
      if (quiet) quiets++;
      const givesCheck = pos.inCheck();
      let score: number;
      if (legal === 1) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, pvNode, true);
      } else {
        let reduction = 0;
        if (depth >= 3 && quiet && !inCheck && !givesCheck && legal > (pvNode ? 4 : 2)) {
          reduction = REDUCTION[Math.min(depth, 63)][Math.min(legal, MAX_MOVES - 1)];
          if (pvNode) reduction--;
          reduction = Math.max(0, Math.min(reduction, depth - 2));
        }
        score = -this.negamax(depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, false, true);
        if (score > alpha && reduction > 0) score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, false, true);
        if (score > alpha && score < beta) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true, true);
      }
      pos.unmake(move);
      if (this.stopped) return 0;
      if (score > best) {
        best = score;
        bestMove = move;
        if (score > alpha) {
          alpha = score;
          if (ply === 0) {
            this.rootBest = move;
            this.rootScore = score;
          }
          if (score >= beta) {
            if (quiet) this.rewardQuiet(move, depth, ply);
            break;
          }
        }
      }
    }

    if (legal === 0) return inCheck ? -MATE + ply : 0;
    const flag = best >= beta ? TT_LOWER : best > startAlpha ? TT_EXACT : TT_UPPER;
    if (!hit || depth >= this.ttDepth[slot] - 2 || this.ttKey[slot] !== pos.hashHi) {
      this.ttKey[slot] = pos.hashHi;
      this.ttMove[slot] = bestMove || ttMove;
      this.ttScore[slot] = toTable(best, ply);
      this.ttDepth[slot] = depth;
      this.ttFlag[slot] = flag;
    }
    return best;
  }

  /** Ruhesuche: am Ende der Tiefe nur Schlagzüge weiterrechnen, sonst endet die Bewertung mitten im Abtausch */
  private quiescence(alphaIn: number, beta: number, ply: number): number {
    this.tick();
    if (this.stopped) return 0;
    const pos = this.pos;
    if (ply >= MAX_PLY - 1) return evaluate(pos);
    const inCheck = pos.inCheck();
    let alpha = alphaIn;
    let best = -INFINITE;
    let standPat = 0;
    if (!inCheck) {
      standPat = evaluate(pos);
      if (standPat >= beta) return standPat;
      if (standPat > alpha) alpha = standPat;
      best = standPat;
    }
    const base = ply * MAX_MOVES;
    const end = pos.generate(this.moves, base, !inCheck);
    this.scoreMoves(base, end, 0, ply);
    let legal = 0;
    for (let i = base; i < end; i++) {
      this.pickNext(i, end);
      const move = this.moves[i];
      if (!inCheck) {
        if (this.order[i] < 0) break; // Sortiert: ab hier nur noch Verlustschläge
        const victim = pos.board[moveTo(move)] & 7;
        if (standPat + PIECE_VALUE[victim] + 200 < alpha && !movePromo(move)) continue;
      }
      if (!pos.make(move)) continue;
      legal++;
      const score = -this.quiescence(-beta, -alpha, ply + 1);
      pos.unmake(move);
      if (this.stopped) return 0;
      if (score > best) {
        best = score;
        if (score > alpha) {
          alpha = score;
          if (score >= beta) break;
        }
      }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    return best;
  }

  private isTactical(move: number): boolean {
    return this.pos.board[moveTo(move)] !== 0 || movePromo(move) === QUEEN || (move >> 17 & 1) === 1;
  }

  /** Verliert der Schlagzug Material? Grob: Teurere Figur schlägt billigere auf einem bewachten Feld */
  private losingCapture(move: number, attacker: number, victim: number): boolean {
    if (attacker === KING || PIECE_VALUE[attacker] <= PIECE_VALUE[victim] + 30) return false;
    return this.pos.attacked(moveTo(move), this.pos.side ^ 1);
  }

  private scoreMoves(start: number, end: number, ttMove: number, ply: number) {
    const b = this.pos.board;
    const color = this.pos.side;
    const killer1 = this.killers[ply * 2];
    const killer2 = this.killers[ply * 2 + 1];
    for (let i = start; i < end; i++) {
      const move = this.moves[i];
      const to = moveTo(move);
      const from = moveFrom(move);
      let value: number;
      if (move === ttMove) {
        value = SCORE_TT;
      } else if (this.isTactical(move)) {
        const attacker = b[from] & 7;
        const victim = b[to] & 7 || PAWN;
        const gain = PIECE_VALUE[victim] * 16 - PIECE_VALUE[attacker] + (movePromo(move) === QUEEN ? 8000 : 0);
        value = this.losingCapture(move, attacker, victim) ? SCORE_BAD_CAPTURE + gain : SCORE_GOOD_CAPTURE + gain;
      } else if (move === killer1) {
        value = SCORE_KILLER;
      } else if (move === killer2) {
        value = SCORE_KILLER - 1;
      } else {
        value = this.history[(color << 14) | (from << 7) | to];
      }
      this.order[i] = value;
    }
  }

  private pickNext(index: number, end: number) {
    let bestAt = index;
    for (let i = index + 1; i < end; i++) {
      if (this.order[i] > this.order[bestAt]) bestAt = i;
    }
    if (bestAt !== index) {
      const move = this.moves[index];
      const value = this.order[index];
      this.moves[index] = this.moves[bestAt];
      this.order[index] = this.order[bestAt];
      this.moves[bestAt] = move;
      this.order[bestAt] = value;
    }
  }

  private rewardQuiet(move: number, depth: number, ply: number) {
    if (this.killers[ply * 2] !== move) {
      this.killers[ply * 2 + 1] = this.killers[ply * 2];
      this.killers[ply * 2] = move;
    }
    const key = (this.pos.side << 14) | (moveFrom(move) << 7) | moveTo(move);
    this.history[key] = Math.min(HISTORY_MAX, this.history[key] + depth * depth);
  }
}

// Mattwerte stehen in der Tabelle relativ zum Knoten, nicht zur Wurzel
const toTable = (score: number, ply: number) => (score > MATE_BOUND ? score + ply : score < -MATE_BOUND ? score - ply : score);
const fromTable = (score: number, ply: number) => (score > MATE_BOUND ? score - ply : score < -MATE_BOUND ? score + ply : score);
