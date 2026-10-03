/* Quick drills: Square Hunt (find a named square) and Where Can It Go? (tap every square a piece can reach). */
(function (root) {
  'use strict';
  const C = root.Chess || require('./engine.js');
  const P = root.Puzzles || require('./puzzles.js');

  const HUNT_ROUNDS = 10;
  const REACH_ROUNDS = 5;

  // Ten different squares to find, never the same one twice in a row.
  function huntSquares(rnd) {
    const out = [];
    while (out.length < HUNT_ROUNDS) {
      const s = Math.floor(rnd() * 64);
      if (!out.includes(s)) out.push(s);
    }
    return out;
  }

  // One white piece, with a few pieces in its way at the later rounds.
  // Returns {fen, from, targets}: targets are every square the piece can move to.
  function reachBoard(rnd, round) {
    const types = round < 2 ? 'RBNQK' : 'PNBRQK';
    for (let tries = 0; tries < 500; tries++) {
      const board = new Array(64).fill(null);
      const type = types[Math.floor(rnd() * types.length)];
      const from = Math.floor(rnd() * 64);
      if (type === 'P' && (from < 8 || from >= 56)) continue;
      board[from] = 'w' + type;
      // Round 1: the piece alone. Later: own pieces that block it and black pieces it can capture.
      const extras = round === 0 ? 0 : Math.min(4, round + 1);
      for (let i = 0; i < extras; i++) {
        const s = Math.floor(rnd() * 64);
        if (board[s] || s < 8 || s >= 56) continue;
        board[s] = rnd() < 0.5 ? 'wP' : 'b' + 'PNB'[Math.floor(rnd() * 3)];
      }
      // A pawn needs something to capture now and then, or it is too easy.
      if (type === 'P' && round >= 2) {
        const diag = [from + 7, from + 9].filter((s) => s < 64 && Math.abs((s & 7) - (from & 7)) === 1 && !board[s]);
        if (diag.length) board[diag[Math.floor(rnd() * diag.length)]] = 'bN';
      }
      const pos = { board, turn: 'w', castling: '', ep: -1, half: 0, full: 1 };
      const targets = [...new Set(C.legalMoves(pos, from).map((m) => m.to))];
      if (targets.length < 2) continue;
      return { fen: C.toFEN(pos), from, type, targets };
    }
    return null;
  }

  const api = { HUNT_ROUNDS, REACH_ROUNDS, huntSquares, reachBoard, mulberry32: P.mulberry32 };
  root.Drills = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
