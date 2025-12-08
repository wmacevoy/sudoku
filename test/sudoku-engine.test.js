import test from 'node:test';
import assert from 'node:assert/strict';
import { SudokuEngine } from '../docs/sudoku-engine.js';

test('place updates board and candidates', () => {
  const engine = new SudokuEngine();
  engine.place(0, 0, 5);

  assert.equal(engine.board[0][0], 5);
  for (let i = 0; i < 9; i++) {
    if (i !== 0) {
      assert.ok(!engine.candidates[0][i].has(5));
      assert.ok(!engine.candidates[i][0].has(5));
    }
  }
});

test('revertTo rebuilds board state', () => {
  const engine = new SudokuEngine();
  engine.place(0, 0, 1);
  engine.place(0, 1, 2);

  engine.revertTo(1);
  assert.equal(engine.board[0][0], 1);
  assert.equal(engine.board[0][1], 0);
  assert.equal(engine.stack.length, 1);
});

test('ASCII roundtrip preserves moves and uncertainty', () => {
  const engine = new SudokuEngine();
  engine.place(0, 0, 1);
  engine.place(1, 1, 2);
  engine.markUncertain(2, 2, true);

  const ascii = engine.toASCII(true);

  const other = new SudokuEngine();
  other.loadFromASCII(ascii);

  assert.equal(other.board[0][0], 1);
  assert.equal(other.board[1][1], 2);
  assert.ok(other.uncertain[2][2]);
  assert.equal(other.stack.length, engine.stack.length);
});

test('generated puzzles remain unique for the requested difficulty', () => {
  const diffs = ['simple', 'easy', 'medium', 'hard'];
  for (const diff of diffs) {
    const engine = new SudokuEngine({ seed: `unit-test-${diff}` });
    const puzzle = engine.createPuzzle(diff);

    const blanks = puzzle.flat().filter((v) => v === 0).length;
    assert.ok(blanks > 0);
    assert.equal(engine.countSolutions(puzzle, 2), 1);
  }
});

test('simple puzzles are gentler than easy puzzles', () => {
  const seed = 'simple-learning-mode';
  const simpleEngine = new SudokuEngine({ seed });
  const easyEngine = new SudokuEngine({ seed });

  const simplePuzzle = simpleEngine.createPuzzle('simple');
  const easyPuzzle = easyEngine.createPuzzle('easy');

  const blanksSimple = simplePuzzle.flat().filter((v) => v === 0).length;
  const blanksEasy = easyPuzzle.flat().filter((v) => v === 0).length;

  assert.ok(
    blanksSimple < blanksEasy,
    `simple should expose more givens; saw ${blanksSimple} vs ${blanksEasy}`
  );
  assert.equal(simpleEngine.countSolutions(simplePuzzle, 2), 1);
});

test('solve reports unique solution and returns solved grid', () => {
  const puzzle = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
  ];
  const expected = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];
  const engine = new SudokuEngine();
  const result = engine.solve(puzzle);
  assert.equal(result.status, 'unique');
  assert.deepEqual(result.solution, expected);
  assert.equal(puzzle[0][2], 0); // original puzzle unchanged
});

test('solve detects impossible puzzles', () => {
  const impossible = [
    [1, 1, 0, 0, 0, 0, 0, 0, 0], // duplicate 1 in row
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];
  const engine = new SudokuEngine();
  const result = engine.solve(impossible);
  assert.equal(result.status, 'impossible');
  assert.equal(result.solution, null);
});

test('solve detects multiple solutions', () => {
  const empty = Array.from({ length: 9 }, () => Array(9).fill(0));
  const engine = new SudokuEngine();
  const result = engine.solve(empty);
  assert.equal(result.status, 'multiple');
  assert.equal(result.solution, null);
});
