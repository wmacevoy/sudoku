# Developer Notes

Intentional Sudoku is a static, browser-based Sudoku app with printing and contest-generation. Everything lives in `docs/`; there is no build step.

## Code layout
- `docs/sudoku-engine.js` — core logic: board state, candidates, solver, generator, ASCII import/export, move stack.
- `docs/sudoku-render.js` — stateless DOM renderer for grids (screen + print).
- `docs/sudoku-app.js` — UI controller for `index.html`: state wiring, input handling, notes/help, share links, localStorage, print.
- `docs/index.html` — play/print/share page.
- `docs/contest.html` — contest generator (counts/copies per difficulty, guideline toggle, prints puzzles + keys).
- `test/` — node test suite (engine correctness, UI smoke via selenium, contest print layout).

## Data model (engine)
- `board[r][c]`: number 0 (empty/uncertain) or 1–9.
- `uncertain[r][c]`: derived view of empties (`board[r][c] === 0`).
- `candidates[r][c]`: `Set` of possible digits; recomputed on placements.
- `stack`: moves for undo/toASCII (`{r,c,prev,val,prevCands,note}`).
- ASCII IO: `toASCII(includeMoves)` / `loadFromASCII`.
- RNG seed: `setRNGSeed(seed)`; `createPuzzle(diff)` uses it.

## UI state (app)
- `notes[r][c]` / `noteOffs[r][c]`: UI-only note sets; pruned when Help is on.
- `selected`, `activeDigit` (digit or `?`), `highlightDigit`, `showOptionGrid` (`#`), `helpEnabled`.
- Persistence/share: state serialized to localStorage (`sudoku_state_v2`) and URL hash for Share Link.

## Interaction semantics
- `#` off (option grid hidden): double-tap/Shift+digit places or clears a value; `?` on a filled cell marks it uncertain; `?` on an empty cell fills notes from row/col/box elimination.
- `#` on (option grid visible): tap digit toggles that candidate; double-tap places/clears the digit; `?` fills candidates; double-`?` on a filled cell marks it uncertain.
- Help checkbox (default on): notes/option grids auto-drop eliminated candidates on placements and highlight shows valid spots; when off, notes persist unless manually changed (solver still enforces Sudoku legality).
- Highlight: selecting a digit to highlight shades placed digits and, with Help on, candidate locations.

## Printing
- `index.html` print: uses current puzzle; `#` adds light mini-grid guides only (no candidate digits). Title + QR/link included.
- `contest.html`: generates lettered puzzles (A, B, …) per requested counts/copies; guideline toggle repeats digits around the mini-grid; keys are faint when guidelines are off. Prints both puzzles and keys.

## Tests
- `test/sudoku-engine.test.js` — solver/generator/ASCII invariants.
- `test/sudoku-ui.test.js` — selenium smoke tests for main UI (grid, buttons, solve).
- `test/contest-print.test.js` — selenium print-page count matches generated contest pages.

### Running tests
CLI uses Docker to get headless Chrome + chromedriver:
1) Build once: `docker compose build tests`
2) Run: `docker compose run --rm tests`

The default command is `npm test -- --test-reporter spec`; tweak via `command:` in `docker-compose.yml` if needed.

## Local dev tips
Serve `docs/` with any static file server (e.g., `python -m http.server 8000` from repo root) to avoid CORS issues; no build tooling required. CLI tests: `npm test` (requires headless Chrome + chromedriver).
