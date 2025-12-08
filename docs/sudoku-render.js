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
    const showOptions = this.showOptionGrid = showOptionGrid;
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
