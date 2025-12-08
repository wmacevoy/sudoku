# sudoku

Business logic for the Sudoku UI now lives in `docs/sudoku-engine.js` so it can be tested without the browser.

- Run tests locally: `npm test` (Node built-in test runner).
- Docker test run: `docker build -t sudoku-tests . && docker run --rm sudoku-tests`.
