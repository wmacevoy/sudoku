# Intentional Sudoku

Minimal, printable Sudoku web app. Open docs/index.html locally or visit intentionalsudoku.com.

## Play
- Controls: difficulty selector (Simple/Easy/Medium/Hard), New, Solve, # Option Grid, Help (auto-candidates/highlighting), Print, Share Link, Contest.
- State: last puzzle is saved locally; share link copies the full state (board, notes, help/# toggles, RNG seed) into the URL hash.

## Input
Default: `#` off, Help on.
- Keyboard, # off: arrows move; 1–9 places/clears that digit in the selected cell; `?` clears and marks the cell uncertain.
- Keyboard, # on: 1–9 toggles that candidate; Shift+1–9 places/clears the digit; `?` fills candidates from row/col/box elimination; Shift+`?` marks a filled cell uncertain.
- Mouse/touch, # off: tap a digit or `?`, then double-tap a cell to place/clear; `?` double-tap on a filled cell marks it uncertain.
- Mouse/touch, # on: tap a digit to toggle that candidate; double-tap to place/clear the digit; tap `?` to auto-fill candidates; `?` double-tap on a filled cell marks it uncertain.

## Help
When Help is on (default) the UI keeps options in sync with the rules: placing a digit removes it from candidate grids in the same row/column/box, highlights track valid spots, and `?` re-fills candidates from row/column/box elimination. Turn Help off to manage notes manually; the solver still enforces Sudoku legality when you place digits.

## Printing
Print uses the current puzzle; turning `#` on adds light mini-grid guides but never prints candidate digits. A title and QR/link are included.

## Contest
contest.html generates printable contests: set counts/copies per difficulty, choose `#` (guides on blanks) or not, and use the seed field (random 16-letter groups by default, “New Seed” for another). The same seed reproduces the same contest; keys are plain solved grids.
