/* Touch-friendly chessboard: tap-tap or drag, legal-move dots, animations, stars, arrows. */
(function (root) {
  'use strict';
  const C = root.Chess;

  const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" fill="#FFC93C" stroke="#E0A100" stroke-width="1.2" stroke-linejoin="round"/></svg>';

  class Board {
    constructor(el, opts) {
      this.el = el;
      this.opts = Object.assign({ orientation: 'w', showDots: true, autoQueen: false }, opts);
      this.pos = null;
      this.selected = -1;
      this.marks = {};
      this.locked = false;
      this.build();
    }

    build() {
      this.el.classList.add('board');
      this.el.innerHTML = '';
      this.squares = [];
      for (let i = 0; i < 64; i++) {
        const sq = document.createElement('div');
        sq.className = 'sq';
        this.el.appendChild(sq);
        this.squares.push(sq);
      }
      this.arrowLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.arrowLayer.setAttribute('viewBox', '0 0 8 8');
      this.arrowLayer.classList.add('arrows');
      this.el.appendChild(this.arrowLayer);
      this.layoutSquares();
      this.el.addEventListener('pointerdown', (e) => this.onDown(e));
      this.el.addEventListener('pointermove', (e) => this.onMoveEvt(e));
      this.el.addEventListener('pointerup', (e) => this.onUp(e));
      this.el.addEventListener('pointercancel', () => this.cancelDrag());
      this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Visual slot (0..63, top-left first) for a board square.
    slot(s) {
      const f = s & 7, r = s >> 3;
      return this.opts.orientation === 'w' ? (7 - r) * 8 + f : r * 8 + (7 - f);
    }

    layoutSquares() {
      for (let s = 0; s < 64; s++) {
        const el = this.squares[s];
        const slot = this.slot(s);
        el.style.gridRow = String((slot >> 3) + 1);
        el.style.gridColumn = String((slot & 7) + 1);
        el.dataset.sq = s;
        const f = s & 7, r = s >> 3;
        el.classList.toggle('light', (f + r) % 2 === 1);
        el.classList.toggle('dark', (f + r) % 2 === 0);
        let coords = '';
        const bottomRow = (slot >> 3) === 7, leftCol = (slot & 7) === 0;
        if (leftCol) coords += `<span class="rank">${r + 1}</span>`;
        if (bottomRow) coords += `<span class="file">${C.FILES[f]}</span>`;
        el.dataset.coords = coords;
      }
    }

    setOrientation(color) {
      if (this.opts.orientation === color) return;
      this.opts.orientation = color;
      this.layoutSquares();
      this.render();
    }

    // marks: {last:[from,to], check:sq, stars:[sq], hint:[sq], arrows:[[from,to]], wrong:sq}
    set(pos, marks, animate) {
      this.pos = pos;
      this.marks = marks || {};
      this.selected = -1;
      this.render(animate);
    }

    setMarks(extra) {
      Object.assign(this.marks, extra);
      this.render();
    }

    render(animate) {
      const pos = this.pos;
      const m = this.marks;
      const targets = new Set();
      const captureTargets = new Set();
      if (this.selected >= 0 && this.opts.showDots && pos) {
        for (const mv of C.legalMoves(pos, this.selected)) {
          targets.add(mv.to);
          if (mv.captured) captureTargets.add(mv.to);
        }
      }
      for (let s = 0; s < 64; s++) {
        const el = this.squares[s];
        const p = pos ? pos.board[s] : null;
        let html = el.dataset.coords || '';
        if (m.stars && m.stars.includes(s)) html += `<div class="star">${STAR_SVG}</div>`;
        if (p) html += `<div class="piece" style="background-image:url('${root.Pieces.uri(p)}')"></div>`;
        if (targets.has(s)) html += `<div class="${captureTargets.has(s) ? 'ring' : 'dot'}"></div>`;
        el.innerHTML = html;
        el.classList.toggle('last', !!(m.last && m.last.includes(s)));
        el.classList.toggle('sel', s === this.selected);
        el.classList.toggle('check', m.check === s);
        el.classList.toggle('hint', !!(m.hint && m.hint.includes(s)));
        el.classList.toggle('good', m.good === s);
      }
      this.drawArrows(m.arrows || []);
      if (animate) this.animate(animate);
    }

    animate(move) {
      const el = this.squares[move.to].querySelector('.piece');
      if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const a = this.slot(move.from), b = this.slot(move.to);
      const dx = ((a & 7) - (b & 7)) * 100, dy = ((a >> 3) - (b >> 3)) * 100;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}%, ${dy}%)`;
      el.style.zIndex = 5;
      el.getBoundingClientRect();
      el.style.transition = 'transform 220ms cubic-bezier(.3,.7,.4,1)';
      el.style.transform = '';
      if (move.flag === 'castle') {
        const rookFrom = { 6: 7, 2: 0, 62: 63, 58: 56 }[move.to], rookTo = { 6: 5, 2: 3, 62: 61, 58: 59 }[move.to];
        this.animate({ from: rookFrom, to: rookTo });
      }
    }

    // arrows: [[from, to, colour?]] where colour is 'blue' (default), 'green' or 'red'
    drawArrows(arrows) {
      const COLORS = { blue: '#2F8FCE', green: '#2F9E55', red: '#E0483F' };
      let html = '<defs>' + Object.entries(COLORS).map(([k, c]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.2" markerHeight="2.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('') + '</defs>';
      for (const [from, to, colour] of arrows) {
        const k = COLORS[colour] ? colour : 'blue';
        const a = this.slot(from), b = this.slot(to);
        const x1 = (a & 7) + 0.5, y1 = (a >> 3) + 0.5, x2 = (b & 7) + 0.5, y2 = (b >> 3) + 0.5;
        const len = Math.hypot(x2 - x1, y2 - y1), f = (len - 0.3) / len;
        html += `<line x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * f}" y2="${y1 + (y2 - y1) * f}" stroke="${COLORS[k]}" stroke-width="0.17" stroke-linecap="round" opacity="0.85" marker-end="url(#ah-${k})"/>`;
      }
      this.arrowLayer.innerHTML = html;
    }

    squareAt(e) {
      const r = this.el.getBoundingClientRect();
      const col = Math.floor(((e.clientX - r.left) / r.width) * 8);
      const row = Math.floor(((e.clientY - r.top) / r.height) * 8);
      if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
      return this.opts.orientation === 'w' ? (7 - row) * 8 + col : row * 8 + (7 - col);
    }

    canMove(s) {
      if (this.locked || !this.pos || s < 0) return false;
      const p = this.pos.board[s];
      const side = this.opts.movable ? this.opts.movable() : this.pos.turn;
      return !!(p && side && p[0] === side && this.pos.turn === side);
    }

    onDown(e) {
      if (this.locked) return;
      const s = this.squareAt(e);
      if (s < 0) return;
      e.preventDefault();
      this.downSq = s;
      this.tapTarget = -1;
      this.wasSelected = false;
      if (this.selected >= 0 && s !== this.selected && (!this.canMove(s) || this.castleViaRook(this.selected, s).length)) {
        this.tapTarget = s;
        return;
      }
      if (this.canMove(s)) {
        this.wasSelected = this.selected === s;
        if (this.selected !== s) { this.selected = s; this.render(); }
        this.drag = { from: s, x: e.clientX, y: e.clientY, active: false, el: this.squares[s].querySelector('.piece') };
        try { this.el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        if (this.opts.onSelect) this.opts.onSelect(s);
      } else if (this.selected >= 0) {
        this.selected = -1;
        this.render();
      }
    }

    onMoveEvt(e) {
      const d = this.drag;
      if (!d || !d.el) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.active && Math.hypot(dx, dy) < 6) return;
      d.active = true;
      d.el.classList.add('dragging');
      d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.25)`;
    }

    cancelDrag() {
      if (this.drag && this.drag.el) { this.drag.el.classList.remove('dragging'); this.drag.el.style.transform = ''; }
      this.drag = null;
    }

    onUp(e) {
      if (this.locked) { this.cancelDrag(); return; }
      const s = this.squareAt(e);
      const d = this.drag;
      if (d) {
        const dragged = d.active;
        this.cancelDrag();
        if (dragged) {
          if (s >= 0 && s !== d.from) this.tryMove(d.from, s, true);
          return;
        }
        if (this.wasSelected && s === d.from) { this.selected = -1; this.render(); }
        return;
      }
      if (this.tapTarget >= 0 && s === this.tapTarget && this.selected >= 0) this.tryMove(this.selected, s, false);
      this.tapTarget = -1;
    }

    // Kids often tap or drop the king onto its rook to castle.
    castleViaRook(from, to) {
      const b = this.pos.board;
      if (!b[from] || b[from][1] !== 'K' || b[to] !== this.pos.turn + 'R') return [];
      return C.legalMoves(this.pos, from).filter((m) => m.flag === 'castle' && Math.sign(m.to - from) === Math.sign(to - from));
    }

    tryMove(from, to, dragged) {
      const pos = this.pos;
      let moves = C.legalMoves(pos, from).filter((m) => m.to === to);
      if (!moves.length) moves = this.castleViaRook(from, to);
      this.selected = -1;
      if (!moves.length) {
        const pseudo = C.pseudoMoves(pos, from).some((m) => m.to === to);
        this.render();
        if (this.opts.onIllegal) this.opts.onIllegal(from, to, pseudo ? 'check' : 'rule');
        return;
      }
      const finish = (m) => { if (this.opts.onMove) this.opts.onMove(m, dragged); };
      if (moves.length > 1 && moves[0].promo) {
        if (this.opts.autoQueen) return finish(moves.find((m) => m.promo === 'Q'));
        this.render();
        return this.askPromotion(moves, finish);
      }
      finish(moves[0]);
    }

    askPromotion(moves, done) {
      const color = moves[0].piece[0];
      const box = document.createElement('div');
      box.className = 'promo';
      box.innerHTML = '<div class="promo-card"><p>Pick a new piece!</p><div class="promo-row">' +
        ['Q', 'R', 'B', 'N'].map((t) => `<button type="button" data-p="${t}" aria-label="${t}" style="background-image:url('${root.Pieces.uri(color + t)}')"></button>`).join('') +
        '</div></div>';
      box.addEventListener('pointerdown', (e) => e.stopPropagation());
      box.addEventListener('pointerup', (e) => e.stopPropagation());
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        box.remove();
        done(moves.find((m) => m.promo === b.dataset.p));
      });
      this.el.appendChild(box);
    }

    shake(s) {
      const el = this.squares[s];
      if (!el) return;
      el.classList.remove('wrong');
      el.getBoundingClientRect();
      el.classList.add('wrong');
      setTimeout(() => el.classList.remove('wrong'), 600);
    }
  }

  root.Board = Board;
})(window);
