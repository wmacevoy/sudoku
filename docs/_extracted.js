import { SudokuEngine, DIGITS, N, make2D } from './sudoku-engine.js';
    import { SudokuRenderer } from './sudoku-render.js';

    const gridEl = document.getElementById('grid');
    const legendEl = document.getElementById('legend');
    const selDiff = document.getElementById('sel-diff');
    const btnNew = document.getElementById('btn-new');
    const btnSolve = document.getElementById('btn-solve');
    const btnPrint = document.getElementById('btn-print');
    const btnToggleOptions = document.getElementById('btn-toggle-options');
    const btnShare = document.getElementById('btn-share');
    const chkHelp = document.getElementById('chk-help');
    const keypadEl = document.getElementById('keypad');

    const game = new SudokuEngine();
    const notes = make2D(N, N, () => new Set());
    const noteOffs = make2D(N, N, () => new Set());
    let selected = { r: 0, c: 0 };
    let activeDigit = null; // number or '?' or null
    let highlightDigit = null;
    let showOptionGrid = false;
    let helpEnabled = true;

    const renderer = new SudokuRenderer({ container: gridEl });

    // --- Tap helpers (single vs double) ---
    function addTapTarget(el, onSingle, onDouble) {
      const threshold = 275;
      let last = 0;
      el.addEventListener('pointerdown', (e) => {
        const now = Date.now();
        if (now - last < threshold) {
          last = 0;
          if (onDouble) onDouble(e);
        } else {
          last = now;
          setTimeout(() => {
            if (last && Date.now() - last >= threshold) {
              last = 0;
              if (onSingle) onSingle(e);
            }
          }, threshold + 10);
        }
      });
    }

    // --- State helpers ---
    function clearNotes() {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          notes[r][c].clear();
          noteOffs[r][c].clear();
        }
      }
    }

    function serializeNotes() {
      return notes.map((row) => row.map((set) => [...set].sort((a, b) => a - b)));
    }

    function serializeNoteOffs() {
      return noteOffs.map((row) => row.map((set) => [...set].sort((a, b) => a - b)));
    }

    function restoreNotes(data) {
      clearNotes();
      if (!Array.isArray(data)) return;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const arr = data[r]?.[c];
          if (Array.isArray(arr)) {
            arr.forEach((d) => {
              if (DIGITS.includes(d)) notes[r][c].add(d);
            });
          }
        }
      }
    }

    function restoreNoteOffs(data) {
      if (!Array.isArray(data)) return;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const arr = data[r]?.[c];
          noteOffs[r][c].clear();
          if (Array.isArray(arr)) {
            arr.forEach((d) => {
              if (DIGITS.includes(d)) noteOffs[r][c].add(d);
            });
          }
        }
      }
    }

    function setLegend(msg) {
      if (legendEl) legendEl.textContent = msg;
    }

    function setActiveDigit(d) {
      activeDigit = d;
      if (!helpEnabled) highlightDigit = null;
      updateKeypadUI();
      render();
    }

    function toggleHighlightDigit(d) {
      highlightDigit = highlightDigit === d ? null : d;
      render();
      if (highlightDigit) {
        setLegend(
          helpEnabled
            ? `Highlighting ${highlightDigit}: filled cells and valid candidates are shaded.`
            : `Highlighting ${highlightDigit}: filled cells are shaded. Turn on Help to auto-highlight candidates.`
        );
      } else {
        setLegend('Highlight cleared.');
      }
    }

    function selectCell(r, c) {
      selected = { r, c };
      render();
    }

    function makeCertain(r, c, val) {
      if (game.board[r][c] === val) {
        game.place(r, c, 0, true);
        game.markUncertain(r, c, false);
      } else {
        game.markUncertain(r, c, false);
        game.place(r, c, val, true);
      }
      notes[r][c].clear();
      noteOffs[r][c].clear();
      render();
      saveState();
    }

    function makeUncertain(r, c) {
      game.place(r, c, 0, true);
      game.markUncertain(r, c, true);
      notes[r][c].clear();
      noteOffs[r][c].clear();
      render();
      saveState();
    }

    function toggleNote(r, c, d) {
      if (game.board[r][c] !== 0) return;
      const on = notes[r][c];
      const off = noteOffs[r][c];
      if (on.has(d)) {
        on.delete(d);
        off.add(d);
      } else if (off.has(d)) {
        off.delete(d);
      } else {
        on.add(d);
      }
      render();
      saveState();
    }

    function moveSelection(dr, dc) {
      const nr = Math.max(0, Math.min(N - 1, selected.r + dr));
      const nc = Math.max(0, Math.min(N - 1, selected.c + dc));
      if (nr === selected.r && nc === selected.c) return;
      selected = { r: nr, c: nc };
      render();
    }

    function isUniqueInRow(r, c, d) {
      for (let cc = 0; cc < N; cc++) {
        if (cc === c) continue;
        if (game.board[r][cc] !== 0) continue;
        if (game.candidates[r][cc].has(d)) return false;
      }
      return true;
    }

    function isUniqueInCol(r, c, d) {
      for (let rr = 0; rr < N; rr++) {
        if (rr === r) continue;
        if (game.board[rr][c] !== 0) continue;
        if (game.candidates[rr][c].has(d)) return false;
      }
      return true;
    }

    function isUniqueInBox(r, c, d) {
      const R = Math.floor(r / 3) * 3;
      const C = Math.floor(c / 3) * 3;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const rr = R + dr;
          const cc = C + dc;
          if (rr === r && cc === c) continue;
          if (game.board[rr][cc] !== 0) continue;
          if (game.candidates[rr][cc].has(d)) return false;
        }
      }
      return true;
    }

    function autoFillOptions(r, c) {
      if (game.board[r][c] !== 0) return;
      const candSet = game.candidates[r][c];
      const blocked = noteOffs[r][c];
      const baseCands = (candSet.size ? [...candSet] : [...DIGITS]).filter((d) => !blocked.has(d));
      const uniques = [];
      for (const d of baseCands) {
        if (isUniqueInRow(r, c, d) || isUniqueInCol(r, c, d) || isUniqueInBox(r, c, d)) {
          uniques.push(d);
        }
      }
      const target = uniques.length ? uniques : baseCands;
      notes[r][c].clear();
      target.forEach((d) => notes[r][c].add(d));
      render();
      saveState();
      setLegend(
        uniques.length
          ? `Auto-filled r${r + 1}c${c + 1} with unique candidate${uniques.length > 1 ? 's' : ''}: ${uniques.join(' ')}.`
          : `Auto-filled r${r + 1}c${c + 1} with basic candidates: ${target.join(' ')}.`
      );
    }

    function refreshAutoOptions({ reset = false } = {}) {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (game.board[r][c] !== 0) continue;
          const candSet = game.candidates[r][c];
          const base = candSet.size ? candSet : new Set(DIGITS);
          const off = noteOffs[r][c];
          const note = notes[r][c];
          if (reset) {
            off.clear();
            note.clear();
            base.forEach((d) => note.add(d));
          } else if (helpEnabled) {
            for (const d of [...note]) {
              if (!base.has(d) || off.has(d)) note.delete(d);
            }
          }
        }
      }
    }

    function updateOptionToggleUI() {
      btnToggleOptions.classList.toggle('active', showOptionGrid);
      btnToggleOptions.setAttribute('aria-pressed', showOptionGrid ? 'true' : 'false');
      chkHelp.checked = helpEnabled;
    }

    function handleKeydown(e) {
      const tag = (e.target && e.target.tagName) || '';
      if (/^(input|textarea|select|button)$/i.test(tag)) return;

      switch (e.key) {
        case 'ArrowUp':
          moveSelection(-1, 0);
          e.preventDefault();
          return;
        case 'ArrowDown':
          moveSelection(1, 0);
          e.preventDefault();
          return;
        case 'ArrowLeft':
          moveSelection(0, -1);
          e.preventDefault();
          return;
        case 'ArrowRight':
          moveSelection(0, 1);
          e.preventDefault();
          return;
        default:
          break;
      }

      const shiftDigitMap = { '!': 1, '@': 2, '#': 3, '$': 4, '%': 5, '^': 6, '&': 7, '*': 8, '(': 9 };
      let digit = null;
      let isQuestion = false;
      let isDouble = false;

      if (e.key === '?' || e.key === '/') {
        isQuestion = true;
        isDouble = e.shiftKey;
      } else if (/^[1-9]$/.test(e.key)) {
        digit = Number(e.key);
        isDouble = e.shiftKey;
      } else if (shiftDigitMap[e.key]) {
        digit = shiftDigitMap[e.key];
        isDouble = true;
      }

      if (isQuestion) {
        setActiveDigit('?');
        if (isDouble) handleCellDoubleTap(selected.r, selected.c);
        else handleCellSingleTap(selected.r, selected.c);
        e.preventDefault();
        return;
      }
      if (digit) {
        setActiveDigit(digit);
        if (isDouble) handleCellDoubleTap(selected.r, selected.c);
        else handleCellSingleTap(selected.r, selected.c);
        e.preventDefault();
      }
    }

    // --- Rendering ---
    function render() {
      renderer.setShowOptionGrid(showOptionGrid);
      renderer.render({
        board: game.board,
        uncertain: game.uncertain,
        notes,
        noteOffs,
        candidates: game.candidates,
        selected,
        highlightDigit: helpEnabled ? highlightDigit : null,
        activeDigit,
        helpEnabled,
        showOptionGrid,
        addTapTarget,
        onCellSingleTap: handleCellSingleTap,
        onCellDoubleTap: handleCellDoubleTap
      });
      updateKeypadUI();
      updateOptionToggleUI();
    }

    function updateKeypadUI() {
      keypadEl.querySelectorAll('button').forEach((btn) => {
        const digit = btn.dataset.digit;
        btn.classList.toggle(
          'active',
          (digit === '?' && activeDigit === '?') ||
            (digit !== '?' && Number(digit) === activeDigit)
        );
        btn.classList.toggle(
          'highlighting',
          digit !== '?' && Number(digit) === highlightDigit
        );
      });
    }

    // --- Interaction handlers ---
    function handleCellSingleTap(r, c) {
      selectCell(r, c);
      const val = game.board[r][c];
      if (activeDigit === '?') {
        if (val !== 0) {
          if (!showOptionGrid) {
            makeUncertain(r, c);
            setLegend(`Marked r${r + 1}c${c + 1} as uncertain.`);
          } else {
            setLegend('Double tap to mark this cell uncertain.');
          }
          return;
        }
        autoFillOptions(r, c);
        return;
      }
      const forceDouble = !showOptionGrid && typeof activeDigit === 'number';
      if (forceDouble) {
        handleCellDoubleTap(r, c);
        return;
      }
      if (val === 0 && typeof activeDigit === 'number') {
        toggleNote(r, c, activeDigit);
        setLegend(`Toggled option ${activeDigit} at r${r + 1}c${c + 1}.`);
      }
    }

    function handleCellDoubleTap(r, c) {
      if (activeDigit === '?') {
        if (game.board[r][c] !== 0) {
          makeUncertain(r, c);
          setLegend(`Marked r${r + 1}c${c + 1} as uncertain.`);
        } else {
          autoFillOptions(r, c);
        }
        return;
      }
      if (typeof activeDigit === 'number') {
        makeCertain(r, c, activeDigit);
        setLegend(`Placed ${activeDigit} at r${r + 1}c${c + 1}. (Double tap with same digit to clear.)`);
      }
    }

    function toggleOptionGrid() {
      showOptionGrid = !showOptionGrid;
      render();
      saveState();
      setLegend(
        showOptionGrid
          ? 'Showing option grid in each cell. Tap digits to update as usual.'
          : 'Option grid hidden.'
      );
    }

    function toggleHelp() {
      helpEnabled = chkHelp.checked;
      if (helpEnabled) {
        refreshAutoOptions({ reset: true });
      }
      highlightDigit = null;
      render();
      saveState();
      setLegend(helpEnabled ? 'Help on: candidates auto-highlight and eliminate.' : 'Help off: manage options manually.');
    }

    function openPrintView() {
      const win = window.open('', '_blank', 'width=900,height=1100');
      if (!win) {
        setLegend('Pop-up blocked. Please allow pop-ups to print.');
        return;
      }
      const board = game.board;
      const includeOptions = showOptionGrid;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Sudoku Print</title>
          <style>
            *{box-sizing:border-box;}
            body{margin:20px; font-family: "Inter", ui-sans-serif, system-ui; color:#000;}
            h1{margin:0 0 12px 0; font-size:20px;}
            .p-grid{display:grid; grid-template-columns:repeat(9,1fr); grid-template-rows:repeat(9,1fr); width:90vw; max-width:720px; aspect-ratio:1/1; border:0.6mm solid #000; margin:0 auto;}
            .p-cell{border:0.12mm solid rgba(0,0,0,0.45); position:relative; display:flex; align-items:center; justify-content:center; font-size:60px; font-weight:700; min-height:60px;}
            .p-cell[data-row="1"], .p-cell[data-row="4"], .p-cell[data-row="7"]{border-top:0.6mm solid #000;}
            .p-cell[data-col="1"], .p-cell[data-col="4"], .p-cell[data-col="7"]{border-left:0.6mm solid #000;}
            .p-cell[data-col="9"]{border-right:0.6mm solid #000;}
            .p-cell[data-row="9"]{border-bottom:0.6mm solid #000;}
            .p-cands{position:absolute; top:0; left:20%; width:60%; height:60%; display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); font-size:11px; color:#666; line-height:1.1;}
            .p-cand{display:flex; align-items:flex-start; justify-content:center;}
            .p-cand.is-five{align-items:flex-start; justify-content:center;}
            body.with-guides .p-cell::before{
              content:'';
              position:absolute;
              inset:0;
              pointer-events:none;
              background-image:
                linear-gradient(#999 0 0),
                linear-gradient(#999 0 0),
                linear-gradient(#999 0 0),
                linear-gradient(#999 0 0);
              background-size:100% 1px, 100% 1px, 1px 100%, 1px 100%;
              background-position:0 25%, 0 75%, 25% 0, 75% 0;
              background-repeat:no-repeat;
              opacity:0.6;
            }
            .p-qr{margin:16px auto 0 auto; display:flex; align-items:center; gap:12px; width:90vw; max-width:720px;}
            .p-qr img{width:120px; height:120px;}
            .p-qr .txt{font-size:12pt; color:#000;}
            @media print{
              body{margin:0.5in;}
            }
          </style>
        </head>
        <body class="${includeOptions ? 'with-guides' : ''}">
          <h1>Sudoku</h1>
          <div class="p-grid">
            ${board
              .map((row, r) =>
                row
                  .map((val, c) => {
                    const notesArr = includeOptions ? [...notes[r][c]].sort((a, b) => a - b) : [];
                    const candHTML =
                      includeOptions && notesArr.length && val === 0
                        ? `<div class="p-cands">${DIGITS.map(
                            (d) =>
                              `<div class="p-cand${d === 5 ? ' is-five' : ''}">${notesArr.includes(d) ? d : ''}</div>`
                          ).join('')}</div>`
                        : '';
                    return `<div class="p-cell" data-row="${r + 1}" data-col="${c + 1}">${
                      val || ''
                    }${candHTML}</div>`;
                  })
                  .join('')
              )
              .join('')}
          </div>
          <section class="p-qr" aria-label="QR code to play online">
            <img id="qr-img" alt="QR code to play online">
            <div class="txt">
              <div><strong>Scan to play this puzzle online.</strong></div>
              <div>${createPuzzleOnlyLink()}</div>
            </div>
          </section>
          <script src="${new URL('./qrcode.min.js', window.location.href).href}"></script>
          <script>
            (function(){
              var qrData = ${JSON.stringify(createPuzzleOnlyLink())};
              var img = document.getElementById('qr-img');
              try{
                var q = new QRCode(qrData, { width: 120, height: 120, colorDark: '#000', colorLight: '#fff' });
                if(q && q._el && q._el.firstChild && q._el.firstChild.toDataURL){
                  img.src = q._el.firstChild.toDataURL();
                }else{
                  img.style.display='none';
                }
              }catch(e){
                img.style.display='none';
              }
            })();
          <\/script>
        </body>
        </html>
      `;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch (_) {}
      }, 120);
    }

    function solvePuzzle() {
      const { status, solution } = game.solve(game.board);
      if (status === 'unique' && solution) {
        game.loadBoard(solution);
        clearNotes();
        highlightDigit = null;
        selected = { r: 0, c: 0 };
        render();
        saveState();
        setLegend('Solved! Unique solution applied to the board.');
      } else if (status === 'impossible') {
        setLegend('No solution exists for this grid.');
      } else if (status === 'multiple') {
        setLegend('More than one solution exists; puzzle is ambiguous.');
      } else {
        setLegend('Solve check failed.');
      }
    }

    // --- Keypad setup ---
    function buildKeypad() {
      keypadEl.innerHTML = '';
      const keys = ['?', ...DIGITS];
      keys.forEach((d) => {
        const btn = document.createElement('button');
        btn.dataset.digit = String(d);
        btn.textContent = d;
        addTapTarget(
          btn,
          () => {
            setActiveDigit(d === '?' ? '?' : Number(d));
            setLegend(`Active digit: ${d === '?' ? '?' : d}. Double tap a cell to apply.`);
          },
          () => {
            setActiveDigit(d === '?' ? '?' : Number(d));
            setLegend(`Active digit: ${d === '?' ? '?' : d}. Double tap a cell to apply.`);
          }
        );
        keypadEl.appendChild(btn);
      });
    }

    // --- Sharing helpers ---
    function base64Encode(str) {
      return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
    }
    function base64Decode(b64) {
      return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    }

    function createPuzzleOnlyLink() {
      const payload = game.currentState({
        diff: selDiff.value,
        notes: [],
        notesOff: [],
        active: null,
        highlight: null,
        optionGrid: showOptionGrid,
        help: helpEnabled,
        unknown: []
      });
      const b64 = base64Encode(JSON.stringify(payload));
      const url = new URL(window.location.href);
      url.hash = 's=' + b64;
      return url.toString();
    }

    function currentState() {
      return game.currentState({
        diff: selDiff.value,
        notes: serializeNotes(),
        notesOff: serializeNoteOffs(),
        active: activeDigit === '?' ? '?' : activeDigit,
        highlight: highlightDigit,
        optionGrid: showOptionGrid,
        help: helpEnabled
      });
    }

    function applyShareState(state) {
      if (!state || !state.initial) return false;
      if (state.rngSeed) game.setRNGSeed(state.rngSeed);
      if (!game.applyState(state)) return false;
      selDiff.value = state.diff || 'medium';
      activeDigit =
        state.active === '?'
          ? '?'
          : Number.isInteger(state.active)
          ? state.active
          : null;
      helpEnabled = state.help !== false;
      highlightDigit = Number.isInteger(state.highlight) ? state.highlight : null;
      showOptionGrid = !!state.optionGrid;
      restoreNotes(state.notes);
      restoreNoteOffs(state.notesOff);
      render();
      return true;
    }

    function createShareLink() {
      const payload = currentState();
      const b64 = base64Encode(JSON.stringify(payload));
      const url = new URL(window.location.href);
      url.hash = 's=' + b64;
      return url.toString();
    }

    async function copyShareLink() {
      const link = createShareLink();
      if (navigator.share) {
        try {
          await navigator.share({ url: link, title: 'Intentional Sudoku' });
          setLegend('Share link opened.');
          return;
        } catch (_) {
          // fall through to clipboard
        }
      }
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(link);
          setLegend('Share link copied to clipboard.');
          return;
        } catch (_) {
          // fall back to prompt
        }
      }
      prompt('Copy your share link:', link);
    }

    function saveState() {
      try {
        localStorage.setItem('sudoku_state_v2', JSON.stringify(currentState()));
      } catch (_) {}
    }

    function restoreFromLocal() {
      try {
        const raw = localStorage.getItem('sudoku_state_v2');
        if (!raw) return false;
        const st = JSON.parse(raw);
        if (!st || !st.initial) return false;
        return applyShareState(st);
      } catch (_) {
        return false;
      }
    }

    function restoreFromURL() {
      const h = location.hash;
      if (!h || !h.startsWith('#s=')) return false;
      try {
        const b64 = h.slice(3);
        const json = base64Decode(b64);
        const st = JSON.parse(json);
        if (!st || !st.initial) return false;
        return applyShareState(st);
      } catch (_) {
        return false;
      }
    }

    // --- Puzzle setup ---
    function newPuzzle(diff) {
      const next = game.createPuzzle(diff);
      game.loadBoard(next);
      clearNotes();
      highlightDigit = null;
      selected = { r: 0, c: 0 };
      if (helpEnabled) {
        refreshAutoOptions({ reset: true });
      }
      render();
      saveState();
      setLegend(`New ${diff} puzzle loaded.`);
    }

    // --- Bootstrap ---
    function init() {
      buildKeypad();
      btnNew.addEventListener('click', () => newPuzzle(selDiff.value));
      btnSolve.addEventListener('click', solvePuzzle);
      btnPrint.addEventListener('click', openPrintView);
      btnToggleOptions.addEventListener('click', toggleOptionGrid);
      btnShare.addEventListener('click', copyShareLink);
      chkHelp.addEventListener('change', toggleHelp);
      document.addEventListener('keydown', handleKeydown);
      selDiff.addEventListener('change', () => {
        saveState();
        setLegend(`Difficulty set to ${selDiff.value}. Use "New" for a fresh puzzle.`);
      });

      if (!restoreFromURL()) {
        if (!restoreFromLocal()) {
          newPuzzle('medium');
        }
      }
      render();
    }

    init();
