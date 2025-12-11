import { N, DIGITS } from './sudoku-engine.js';

export class SudokuRenderer {
  constructor({ container, showOptionGrid = false } = {}) {
    if (!container) {
      throw new Error('SudokuRenderer requires a container element.');
    }
    this.container = container;
    this.showOptionGrid = !!showOptionGrid;
  }

  setShowOptionGrid(flag) {
    this.showOptionGrid = !!flag;
  }

  render({
    board,
    uncertain,
    notes,
    noteOffs,
    candidates,
    selected,
    activeDigit = null,
    highlightDigit,
    helpEnabled = true,
    showOptionGrid = this.showOptionGrid,
    addTapTarget,
    onCellSingleTap,
    onCellDoubleTap
  }) {
    const showOptions = (this.showOptionGrid = showOptionGrid);
    this.container.innerHTML = '';

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(r + 1);
        cell.dataset.col = String(c + 1);
        if ((((r / 3) | 0) + ((c / 3) | 0)) % 2 === 1) {
          cell.classList.add('box-alt');
        }

        const val = board[r][c];
        const isUncertain = uncertain[r][c];
        const noteSet = notes[r][c];
        const offSet = noteOffs?.[r]?.[c] ?? new Set();
        const candSet = candidates[r][c];
        const isSelected = selected?.r === r && selected?.c === c;
        const targetDigit =
          helpEnabled && Number.isInteger(activeDigit) ? Number(activeDigit) : null;

        if (isSelected) cell.classList.add('selected');
        if (isUncertain) cell.classList.add('uncertain');

        if (highlightDigit) {
          if (val === highlightDigit) cell.classList.add('highlight-hit');
          else if (val === 0 && helpEnabled && candSet.has(highlightDigit))
            cell.classList.add('highlight-maybe');
        }

        const valueEl = document.createElement('div');
        valueEl.className = 'value';
        cell.appendChild(valueEl);

        let activeOptions = [];
        const computeActive = (d) => {
          const isPlaced = val === d;
          const baseActive = helpEnabled && candSet.has(d);
          const isActive = noteSet.has(d) || (!offSet.has(d) && baseActive) || isPlaced;
          if (isActive && !isPlaced && !activeOptions.includes(d)) activeOptions.push(d);
          return { isActive, isPlaced };
        };

        if (showOptions) {
          const optionsEl = document.createElement('div');
          optionsEl.className = 'options';
          for (const d of DIGITS) {
            const opt = document.createElement('span');
            opt.className = 'option';
            opt.dataset.digit = String(d);
            opt.textContent = d;
            const { isActive, isPlaced } = computeActive(d);
            if (isActive) opt.classList.add('active');
            if (isPlaced) opt.classList.add('placed');
            if (highlightDigit === d) opt.classList.add('highlight');
            if (d === 5) opt.classList.add('is-five');
            optionsEl.appendChild(opt);
          }
          if (val) optionsEl.classList.add('hidden');
          else if (isSelected) optionsEl.classList.add('cover');
          cell.appendChild(optionsEl);
        } else if (isUncertain && noteSet.size) {
          const notesEl = document.createElement('div');
          notesEl.className = 'notes';
          notesEl.textContent = [...noteSet].sort((a, b) => a - b).join(' ');
          cell.appendChild(notesEl);
          activeOptions = [...noteSet];
        } else if (!showOptions && helpEnabled && val === 0) {
          DIGITS.forEach((d) => computeActive(d));
        }

        valueEl.textContent = val ? val : '';

        const singleTap = () => onCellSingleTap?.(r, c);
        const doubleTap = () => onCellDoubleTap?.(r, c);
        if (typeof addTapTarget === 'function') {
          addTapTarget(cell, singleTap, doubleTap);
        } else {
          cell.addEventListener('click', singleTap);
          cell.addEventListener('dblclick', doubleTap);
        }

        if (targetDigit !== null) {
          const isOption =
            val === targetDigit ||
            (val === 0 &&
              !offSet.has(targetDigit) &&
              (candSet.has(targetDigit) || noteSet.has(targetDigit)));
          if (isOption) {
            cell.classList.add('option-focus');
          }
        }

        this.container.appendChild(cell);
      }
    }
  }
}

const PRINT_STYLE_ID = 'sudoku-print-style';

const PRINT_STYLES = `
.sudoku-print{font-family:"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color:#000; background:#fff;}
.sudoku-print .print-wrapper{margin:0 auto; padding:1cm; width:100%; max-width:900px; color:#000; background:#fff;}
.sudoku-print h1{text-align:center; margin:0 0 12px 0; font-size:24px;}
.sudoku-print .p-grid{display:grid; grid-template-columns:repeat(9,1fr); grid-template-rows:repeat(9,1fr); width:100%; aspect-ratio:1/1; border:0.6mm solid #000; margin:0 auto;}
.sudoku-print .p-cell{border:0.12mm solid rgba(0,0,0,0.45); position:relative; display:flex; align-items:center; justify-content:center; font-size:64px; font-weight:700; min-height:64px;}
.sudoku-print .p-cell[data-row="1"], .sudoku-print .p-cell[data-row="4"], .sudoku-print .p-cell[data-row="7"]{border-top:0.6mm solid #000;}
.sudoku-print .p-cell[data-col="1"], .sudoku-print .p-cell[data-col="4"], .sudoku-print .p-cell[data-col="7"]{border-left:0.6mm solid #000;}
.sudoku-print .p-cell[data-col="9"]{border-right:0.6mm solid #000;}
.sudoku-print .p-cell[data-row="9"]{border-bottom:0.6mm solid #000;}
.sudoku-print .p-cell.guideline{display:grid; grid-template-columns:1fr 2fr 1fr; grid-template-rows:1fr 2fr 1fr; font-size:16px; gap:0; padding:3px;}
.sudoku-print .p-cell.guideline .mini{display:flex; align-items:center; justify-content:center; line-height:1; color:#000; border:1px solid rgba(0,0,0,0.18); box-sizing:border-box;}
.sudoku-print .p-cell.guideline .mini.blank{color:transparent;}
.sudoku-print .key-faint{opacity:0.2;}
.sudoku-print .print-qr{margin:16px auto 0 auto; display:flex; align-items:center; gap:12px; width:90vw; max-width:720px;}
.sudoku-print .print-qr img{width:120px; height:120px;}
.sudoku-print .print-qr .txt{font-size:12pt; color:#000;}
.sudoku-print .with-guides .p-cell::before{
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
`;

export function ensurePrintStyles(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  if (doc.getElementById(PRINT_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_STYLES;
  doc.head.appendChild(style);
}

export function renderPrintGrid({ board, showGuides = false, asKey = false, faint = false }) {
  const cells = board
    .map((row, r) =>
      row
        .map((val, c) => {
          const content = val === 0 ? '' : val;
          if (showGuides && (asKey || content === '')) {
            const minis = Array.from({ length: 9 }, (_, idx) => {
              const isCenter = idx === 4;
              const digit = asKey && content && !isCenter ? content : '';
              const blank = !digit;
              return `<span class="mini${blank ? ' blank' : ''}">${digit}</span>`;
            }).join('');
            return `<div class="p-cell guideline" data-row="${r + 1}" data-col="${c + 1}">${minis}</div>`;
          }
          return `<div class="p-cell" data-row="${r + 1}" data-col="${c + 1}">${content}</div>`;
        })
        .join('')
    )
    .join('');
  const classes = ['p-grid'];
  if (faint) classes.push('key-faint');
  return `<div class="${classes.join(' ')}">${cells}</div>`;
}
