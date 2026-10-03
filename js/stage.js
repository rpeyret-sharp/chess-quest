/* Shared helpers for lesson stages: building positions and finding the fewest moves. */
(function (root) {
  'use strict';
  const C = root.Chess || require('./engine.js');
  const P = root.Puzzles || require('./puzzles.js');

  function posFromPieces(pieces) {
    const board = new Array(64).fill(null);
    for (const [sq, p] of Object.entries(pieces)) board[C.sqIndex(sq)] = p;
    return { board, turn: 'w', castling: '', ep: -1, half: 0, full: 1 };
  }

  // Lesson positions never let black move: after White moves, it is White's turn again.
  function lessonMove(pos, m) {
    const next = C.makeMove(pos, m);
    next.turn = 'w';
    next.ep = -1;
    return next;
  }

  const blackLeft = (pos) => pos.board.some((p) => p && p[0] === 'b');

  // Breadth-first search for the fewest moves that finish a stars/capture stage.
  function par(stage) {
    let pos = posFromPieces(stage.pieces);
    const starIdx = (stage.stars || []).map(C.sqIndex);
    const full = (1 << starIdx.length) - 1;
    const key = (p, mask) => p.board.join(',') + '|' + mask;
    let frontier = [[pos, 0]];
    const seen = new Set([key(pos, 0)]);
    for (let depth = 1; depth <= 12; depth++) {
      const next = [];
      for (const [p, mask] of frontier) {
        for (const m of C.legalMoves(p)) {
          const q = lessonMove(p, m);
          const i = starIdx.indexOf(m.to);
          const nm = i >= 0 ? mask | (1 << i) : mask;
          const done = stage.type === 'stars' ? nm === full : !blackLeft(q);
          if (done) return depth;
          const k = key(q, nm);
          if (!seen.has(k)) { seen.add(k); next.push([q, nm]); }
        }
      }
      frontier = next;
    }
    return -1;
  }

  // Build a playable stage: {pos, goal, stars, par, say}
  function buildStage(stage) {
    if (stage.type === 'stars' || stage.type === 'capture') {
      return { kind: stage.type, pos: posFromPieces(stage.pieces), stars: (stage.stars || []).map(C.sqIndex), par: par(stage), say: stage.say };
    }
    if (stage.type === 'puzzle') {
      const pz = P.makePuzzle(stage.theme, stage.level, stage.seed);
      return { kind: 'puzzle', pos: C.parseFEN(pz.fen), goal: pz.goal, puzzle: pz, say: stage.say || pz.prompt };
    }
    return { kind: 'fen', pos: C.parseFEN(stage.fen), goal: stage.goal, say: stage.say };
  }

  const api = { posFromPieces, lessonMove, par, buildStage, blackLeft };
  root.Stage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
