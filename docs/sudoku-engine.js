import { rngFromSeed } from './prng.js';

export const N = 9;
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function make2D(R, C, init) {
  return Array.from({ length: R }, (_, r) =>
    Array.from(
      { length: C },
      (_, c) => (typeof init === 'function' ? init(r, c) : init)
    )
  );
}

export function cloneBoard(b) {
  return b.map((row) => row.slice());
}

export function cloneCands(cs) {
  return cs.map((row) => row.map((set) => new Set([...set])));
}

function makeZeroBoard() {
  return Array.from({ length: N }, () => Array(N).fill(0));
}

export class SudokuEngine {
  constructor(options = {}) {
    const { seed = null } = options;
    this.setRNGSeed(seed);
    this.reset();
  }

  setRNGSeed(seed) {
    if (seed === undefined || seed === null) {
      this._rng = Math.random;
      this.rngSeed = null;
      return;
    }
    const s = String(seed);
    this._rng = rngFromSeed(s);
    this.rngSeed = s;
  }

  shuffle(a, rand = this._rng) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  reset() {
    this._board = makeZeroBoard();
    this._candidates = make2D(N, N, () => new Set(DIGITS));
    this._stack = [];
    this._initialBoard = cloneBoard(this._board);
    this.lastParsedUncertain = null;
  }

  clearBoard() {
    this.reset();
  }

  get board() {
    return this._board;
  }

  get candidates() {
    return this._candidates;
  }

  get uncertain() {
    return this._board.map((row) => row.map((v) => v === 0));
  }

  get stack() {
    return this._stack;
  }

  get initialBoard() {
    return this._initialBoard;
  }

  computeCandidatesForBoard(b) {
    const cands = make2D(N, N, () => new Set(DIGITS));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const val = b[r][c];
        if (!val) continue;
        cands[r][c].clear();
        for (let i = 0; i < 9; i++) {
          cands[r][i].delete(val);
          cands[i][c].delete(val);
        }
        const R = Math.floor(r / 3) * 3;
        const C = Math.floor(c / 3) * 3;
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            cands[R + dr][C + dc].delete(val);
          }
        }
      }
    }
    return cands;
  }

  recomputeCandidatesFromBoard() {
    this._candidates = make2D(N, N, () => new Set(DIGITS));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const val = this._board[r][c];
        if (val) this.eliminate(r, c, val);
      }
    }
  }

  loadBoard(b) {
    this._board = cloneBoard(b);
    this._initialBoard = cloneBoard(b);
    this.recomputeCandidatesFromBoard();
    this._stack = [];
    this.lastParsedUncertain = null;
  }

  markUncertain(r, c, value = true) {
    // Uncertainty is derived from board[r][c] === 0; no-op retained for compatibility.
    if (!value) return;
    if (this._board[r][c] !== 0) {
      this.place(r, c, 0, true);
    }
  }

  eliminate(r, c, val) {
    this._board[r][c] = val;
    this._candidates[r][c].clear();
    for (let i = 0; i < 9; i++) {
      this._candidates[r][i].delete(val);
      this._candidates[i][c].delete(val);
    }
    const R = Math.floor(r / 3) * 3;
    const C = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        this._candidates[R + dr][C + dc].delete(val);
      }
    }
  }

  place(r, c, val, { push = true, note = '' } = {}) {
    if (this._board[r][c] === val) return;
    const prev = this._board[r][c];
    const prevCands = cloneCands(this._candidates);
    if (val === 0) {
      this._board[r][c] = 0;
      this.recomputeCandidatesFromBoard();
    } else {
      this.markUncertain(r, c, false);
      this.eliminate(r, c, val);
    }
    if (push) {
      this._stack.push({ r, c, prev, val, prevCands, note });
    }
  }

  revertTo(idx = 0) {
    if (!Array.isArray(this._stack)) return;
    if (idx < 0) idx = 0;
    if (idx > this._stack.length) idx = this._stack.length;

    const base = this._initialBoard
      ? cloneBoard(this._initialBoard)
      : makeZeroBoard();
    for (let i = 0; i < idx; i++) {
      const mv = this._stack[i];
      base[mv.r][mv.c] = mv.val;
    }
    this._board = cloneBoard(base);
    this.recomputeCandidatesFromBoard();
    this._stack = this._stack.slice(0, idx);
  }

  precomputeCounts(board = this._board, candidates = this._candidates) {
    const row = Array.from({ length: 9 }, () => Array(10).fill(0));
    const col = Array.from({ length: 9 }, () => Array(10).fill(0));
    const box = Array.from({ length: 9 }, () => Array(10).fill(0));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) continue;
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        for (const d of candidates[r][c]) {
          row[r][d]++;
          col[c][d]++;
          box[b][d]++;
        }
      }
    }
    return { row, col, box };
  }

  generateFull() {
    const b = makeZeroBoard();
    const backtrack = () => {
      let r = -1,
        c = -1;
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          if (b[i][j] === 0) {
            r = i;
            c = j;
            break;
          }
        }
        if (r !== -1) break;
      }
      if (r === -1) return true;
      const opts = this.shuffle([...DIGITS], this._rng);
      for (const d of opts) {
        const used = new Set();
        for (let i = 0; i < 9; i++) {
          if (b[r][i]) used.add(b[r][i]);
          if (b[i][c]) used.add(b[i][c]);
        }
        const R = Math.floor(r / 3) * 3;
        const C = Math.floor(c / 3) * 3;
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            if (b[R + dr][C + dc]) used.add(b[R + dr][C + dc]);
          }
        }
        if (!used.has(d)) {
          b[r][c] = d;
          if (backtrack()) return true;
          b[r][c] = 0;
        }
      }
      return false;
    };
    backtrack();
    return b;
  }

  countSolutions(inputBoard, limit = 2) {
    const b = cloneBoard(inputBoard);
    let count = 0;
    const backtrack = () => {
      if (count >= limit) return;
      let r = -1,
        c = -1;
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          if (b[i][j] === 0) {
            r = i;
            c = j;
            break;
          }
        }
        if (r !== -1) break;
      }
      if (r === -1) {
        count++;
        return;
      }
      const used = new Set();
      for (let i = 0; i < 9; i++) {
        if (b[r][i]) used.add(b[r][i]);
        if (b[i][c]) used.add(b[i][c]);
      }
      const R = Math.floor(r / 3) * 3;
      const C = Math.floor(c / 3) * 3;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          if (b[R + dr][C + dc]) used.add(b[R + dr][C + dc]);
        }
      }
      const opts = DIGITS.filter((d) => !used.has(d));
      for (const d of opts) {
        b[r][c] = d;
        backtrack();
        if (count >= limit) break;
      }
      b[r][c] = 0;
    };
    backtrack();
    return count;
  }

  /**
   * Solve a Sudoku grid.
   * Returns { status: 'unique'|'impossible'|'multiple', solution: number[][] | null }
   * - unique: exactly one solution; solution is provided
   * - impossible: no solutions
   * - multiple: more than one solution exists (solution is null)
   */
  solve(inputBoard = this._board) {
    const b = cloneBoard(inputBoard);
    const solutions = [];
    const limit = 2; // stop after detecting a second solution
    const rowUsed = Array.from({ length: 9 }, () => new Set());
    const colUsed = Array.from({ length: 9 }, () => new Set());
    const boxUsed = Array.from({ length: 9 }, () => new Set());

    let givens = 0;
    // Validate existing clues; duplicates mean impossible.
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = b[r][c];
        if (!v) continue;
        givens++;
        const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        if (rowUsed[r].has(v) || colUsed[c].has(v) || boxUsed[box].has(v)) {
          return { status: 'impossible', solution: null };
        }
        rowUsed[r].add(v);
        colUsed[c].add(v);
        boxUsed[box].add(v);
      }
    }

    // Empty (or extremely underconstrained) but valid grid will have many solutions.
    if (givens === 0) return { status: 'multiple', solution: null };

    const optionsFor = (r, c) => {
      const used = new Set();
      for (let i = 0; i < 9; i++) {
        if (b[r][i]) used.add(b[r][i]);
        if (b[i][c]) used.add(b[i][c]);
      }
      const R = Math.floor(r / 3) * 3;
      const C = Math.floor(c / 3) * 3;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          if (b[R + dr][C + dc]) used.add(b[R + dr][C + dc]);
        }
      }
      return DIGITS.filter((d) => !used.has(d));
    };

    const backtrack = () => {
      if (solutions.length >= limit) return;
      let best = null;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (b[r][c] !== 0) continue;
          const opts = optionsFor(r, c);
          if (opts.length === 0) return; // dead end
          if (!best || opts.length < best.opts.length) {
            best = { r, c, opts };
            if (opts.length === 1) break; // cannot do better
          }
        }
        if (best && best.opts.length === 1) break;
      }
      if (!best) {
        solutions.push(cloneBoard(b));
        return;
      }
      const { r, c, opts } = best;
      for (const d of opts) {
        b[r][c] = d;
        backtrack();
        if (solutions.length >= limit) break;
      }
      b[r][c] = 0;
    };

    backtrack();
    if (solutions.length === 0) return { status: 'impossible', solution: null };
    if (solutions.length > 1) return { status: 'multiple', solution: null };
    return { status: 'unique', solution: solutions[0] };
  }

  createPuzzle(diff = 'medium') {
    // More clues = simpler puzzle. Keep existing levels; add "simple" for newcomers.
    const targetByDiff = {
      simple: 54, // heavily pre-filled grid for first-time/young players
      easy: 40,
      medium: 32,
      hard: 26
    };
    const targetClues = targetByDiff[diff] ?? targetByDiff.medium;
    const solution = this.generateFull();
    const puzzle = cloneBoard(solution);
    const cells = this.shuffle(Array.from({ length: 81 }, (_, i) => i));
    let clues = 81;
    for (const idx of cells) {
      if (clues <= targetClues) break;
      const r = Math.floor(idx / 9);
      const c = idx % 9;
      const saved = puzzle[r][c];
      puzzle[r][c] = 0;
      const copy = cloneBoard(puzzle);
      if (this.countSolutions(copy, 2) !== 1) {
        puzzle[r][c] = saved;
      } else {
        clues--;
      }
    }
    return puzzle;
  }

  gridToASCII(b = this._board, mask = null) {
    const derivedMask = mask ?? b.map((row) => row.map((v) => v === 0));
    const cell = (v, r, c) => (v ? ` ${v} ` : derivedMask[r][c] ? ' ? ' : ' . ');
    const groupLen = 9;
    const MAJOR = `+${'-'.repeat(groupLen)}+${'-'.repeat(groupLen)}+${'-'.repeat(groupLen)}+`;
    let out = '';
    for (let r = 0; r < 9; r++) {
      if (r % 3 === 0) out += MAJOR + '\n';
      let line = '|';
      for (let c = 0; c < 9; c++) {
        line += cell(b[r][c], r, c);
        if (c % 3 === 2) line += '|';
      }
      out += line + '\n';
    }
    out += MAJOR;
    return out;
  }

  parseGridFromLines(lines) {
    const digits = [];
    const mask = make2D(N, N, false);
    let rr = 0;
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) continue;
      if (l[0] === '+' || l[0] === '-') continue;
      if (l[0] === '|' || /[.0-9?]/.test(l[0])) {
        const row = [];
        let cc = 0;
        for (const ch of l) {
          if (/[\|\s]/.test(ch)) continue;
          if (ch === '.' || ch === '0') {
            row.push(0);
            if (rr < 9 && cc < 9) mask[rr][cc] = false;
            cc++;
          } else if (ch === '?') {
            row.push(0);
            if (rr < 9 && cc < 9) mask[rr][cc] = true;
            cc++;
          } else if (/[1-9]/.test(ch)) {
            row.push(Number(ch));
            if (rr < 9 && cc < 9) mask[rr][cc] = false;
            cc++;
          }
        }
        if (row.length) {
          digits.push(row);
          rr++;
        }
      }
    }
    if (digits.length !== 9 || digits.some((r) => r.length !== 9)) {
      throw new Error('Expecting 9 rows × 9 columns in ASCII grid.');
    }
    return { digits, mask };
  }

  fromASCII(text) {
    if (/SUDOKU-ASCII\s*v1/i.test(text)) {
      const gridBlock = [];
      const moveBlock = [];
      let mode = '';
      for (const ln of text.split(/\r?\n/)) {
        const t = ln.trim();
        if (/^GRID:?$/i.test(t) || /^FINAL:?$/i.test(t)) {
          mode = 'grid';
          continue;
        }
        if (/^MOVES:?$/i.test(t)) {
          mode = 'moves';
          continue;
        }
        if (/^END$/i.test(t)) {
          mode = '';
          continue;
        }
        if (!t) continue;
        if (mode === 'grid') gridBlock.push(ln);
        else if (mode === 'moves') moveBlock.push(ln);
      }
      const { digits, mask } = this.parseGridFromLines(gridBlock);
      const moves = moveBlock
        .map((line) => this.parseMoveLine(line))
        .filter(Boolean);
      this.lastParsedUncertain = mask;
      return { digits: cloneBoard(digits), mask, moves };
    }
    const { digits, mask } = this.parseGridFromLines(text.split(/\r?\n/));
    this.lastParsedUncertain = mask;
    return { digits, mask, moves: [] };
  }

  loadFromASCII(text) {
    const { digits, mask, moves } = this.fromASCII(text);
    const base = cloneBoard(digits);
    const finalBoard = cloneBoard(base);
    if (Array.isArray(moves)) {
      for (const mv of moves) {
        if (
          Number.isInteger(mv.r) &&
          Number.isInteger(mv.c) &&
          Number.isInteger(mv.val)
        ) {
          finalBoard[mv.r][mv.c] = mv.val;
        }
      }
    }
    this._initialBoard = base;
    this._board = finalBoard;
    this.recomputeCandidatesFromBoard();
    this._stack = Array.isArray(moves)
      ? moves.map((mv) => ({
          r: mv.r,
          c: mv.c,
          prev: mv.prev ?? 0,
          val: mv.val ?? 0,
          note: mv.note || '',
          prevCands: null
        }))
      : [];
    return { digits: finalBoard, mask, moves };
  }

  toASCII(includeMoves = false) {
    const gridTxt = this.gridToASCII(this._board);
    if (!includeMoves || this._stack.length === 0) {
      return gridTxt;
    }
    const header = '### SUDOKU-ASCII v1\nGRID:\n';
    const movesTxt = this._stack
      .map((m, i) => this.formatMoveLine(i, m))
      .join('\n');
    return `${header}${gridTxt}\nMOVES:\n${movesTxt}\nEND`;
  }

  formatMoveLine(i, m) {
    const note = (m.note || '').replace(/\n/g, ' ');
    return `move ${String(i + 1).padStart(2, '0')}: r=${m.r + 1} c=${
      m.c + 1
    } prev=${m.prev || 0} val=${m.val || 0}${note ? ` note=${note}` : ''}`;
  }

  parseMoveLine(line) {
    const m =
      /r\s*=\s*(\d+)\s+c\s*=\s*(\d+)\s+prev\s*=\s*(\d+)\s+val\s*=\s*(\d+)(?:\s+note\s*=\s*(.*))?/i.exec(
        line
      );
    if (!m) return null;
    const [, r, c, prev, val, note] = m;
    return {
      r: Number(r) - 1,
      c: Number(c) - 1,
      prev: Number(prev),
      val: Number(val),
      note: note ? note.trim() : ''
    };
  }

  currentState(extra = {}) {
    const unknown = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this._board[r][c] === 0) unknown.push({ r, c });
      }
    }
    return {
      initial: this._initialBoard
        ? cloneBoard(this._initialBoard)
        : makeZeroBoard(),
      moves: this._stack.map(({ r, c, prev, val, note }) => ({
        r,
        c,
        prev,
        val,
        note
      })),
      unknown,
      rngSeed: this.rngSeed,
      ...extra
    };
  }

  applyState(state) {
    if (!state || !Array.isArray(state.initial)) return false;
    const base = cloneBoard(state.initial);
    const moves = Array.isArray(state.moves) ? state.moves : [];
    const final = cloneBoard(base);
    for (const mv of moves) {
      if (
        Number.isInteger(mv.r) &&
        Number.isInteger(mv.c) &&
        Number.isInteger(mv.val)
      ) {
        final[mv.r][mv.c] = mv.val;
      }
    }
    this._initialBoard = base;
    this._board = final;
    this.recomputeCandidatesFromBoard();
    this._stack = moves.map((mv) => ({
      r: mv.r,
      c: mv.c,
      prev: mv.prev ?? 0,
      val: mv.val ?? 0,
      note: mv.note || '',
      prevCands: null
    }));
    return true;
  }
}

export function formatCandidatesForPrint(set) {
  return [...set].sort((a, b) => a - b).join(' ');
}
