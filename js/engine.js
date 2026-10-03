/* Chess rules engine: move generation, legality, game status.
 * Board: array of 64, index = rank*8 + file (a1 = 0, h8 = 63).
 * Pieces: 'wP','wN','wB','wR','wQ','wK','bP',... or null.
 * Positions without kings are allowed (used by lessons and Pawn Battle). */
(function (root) {
  'use strict';

  const FILES = 'abcdefgh';
  const VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  const sqName = (i) => FILES[i & 7] + ((i >> 3) + 1);
  const sqIndex = (s) => FILES.indexOf(s[0]) + (parseInt(s[1], 10) - 1) * 8;
  const other = (c) => (c === 'w' ? 'b' : 'w');

  function table(steps) {
    const t = [];
    for (let s = 0; s < 64; s++) {
      const f = s & 7, r = s >> 3, list = [];
      for (const [df, dr] of steps) {
        const ff = f + df, rr = r + dr;
        if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) list.push(rr * 8 + ff);
      }
      t.push(list);
    }
    return t;
  }
  const KNIGHT = table(KNIGHT_JUMPS);
  const KING = table(KING_STEPS);

  // RAYS[s][d] = list of squares from s going in direction d (0-3 rook, 4-7 bishop)
  const ALL_DIRS = ROOK_DIRS.concat(BISHOP_DIRS);
  const RAYS = [];
  for (let s = 0; s < 64; s++) {
    RAYS.push(ALL_DIRS.map(([df, dr]) => {
      const ray = [];
      let f = (s & 7) + df, r = (s >> 3) + dr;
      while (f >= 0 && f < 8 && r >= 0 && r < 8) { ray.push(r * 8 + f); f += df; r += dr; }
      return ray;
    }));
  }

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  function parseFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    const board = new Array(64).fill(null);
    const rows = parts[0].split('/');
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r] || '') {
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        board[(7 - r) * 8 + f] = color + ch.toUpperCase();
        f++;
      }
    }
    return {
      board,
      turn: parts[1] === 'b' ? 'b' : 'w',
      castling: parts[2] && parts[2] !== '-' ? parts[2] : '',
      ep: parts[3] && parts[3] !== '-' ? sqIndex(parts[3]) : -1,
      half: +(parts[4] || 0),
      full: +(parts[5] || 1),
    };
  }

  function toFEN(pos) {
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      let row = '', empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = pos.board[r * 8 + f];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += p[0] === 'w' ? p[1] : p[1].toLowerCase();
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return [rows.join('/'), pos.turn, pos.castling || '-', pos.ep >= 0 ? sqName(pos.ep) : '-', pos.half, pos.full].join(' ');
  }

  // Key used for repetition detection.
  const posKey = (pos) => toFEN(pos).split(' ').slice(0, 4).join(' ');

  function findKing(board, color) {
    const k = color + 'K';
    for (let s = 0; s < 64; s++) if (board[s] === k) return s;
    return -1;
  }

  function attacked(board, sq, by) {
    const f = sq & 7, r = sq >> 3;
    const pr = by === 'w' ? r - 1 : r + 1;
    if (pr >= 0 && pr < 8) {
      const pawn = by + 'P';
      if (f > 0 && board[pr * 8 + f - 1] === pawn) return true;
      if (f < 7 && board[pr * 8 + f + 1] === pawn) return true;
    }
    const n = by + 'N', k = by + 'K';
    for (const t of KNIGHT[sq]) if (board[t] === n) return true;
    for (const t of KING[sq]) if (board[t] === k) return true;
    const rays = RAYS[sq];
    for (let d = 0; d < 8; d++) {
      const ray = rays[d];
      for (let i = 0; i < ray.length; i++) {
        const p = board[ray[i]];
        if (!p) continue;
        if (p[0] === by) {
          const t = p[1];
          if (t === 'Q' || (d < 4 ? t === 'R' : t === 'B')) return true;
        }
        break;
      }
    }
    return false;
  }

  // Squares attacked by `by` that hold an enemy piece or are empty (used by puzzle checks).
  function attackers(board, sq, by) {
    const list = [];
    const f = sq & 7, r = sq >> 3;
    const pr = by === 'w' ? r - 1 : r + 1;
    if (pr >= 0 && pr < 8) {
      if (f > 0 && board[pr * 8 + f - 1] === by + 'P') list.push(pr * 8 + f - 1);
      if (f < 7 && board[pr * 8 + f + 1] === by + 'P') list.push(pr * 8 + f + 1);
    }
    for (const t of KNIGHT[sq]) if (board[t] === by + 'N') list.push(t);
    for (const t of KING[sq]) if (board[t] === by + 'K') list.push(t);
    const rays = RAYS[sq];
    for (let d = 0; d < 8; d++) {
      for (const t of rays[d]) {
        const p = board[t];
        if (!p) continue;
        if (p[0] === by && (p[1] === 'Q' || (d < 4 ? p[1] === 'R' : p[1] === 'B'))) list.push(t);
        break;
      }
    }
    return list;
  }

  function inCheck(pos, color) {
    color = color || pos.turn;
    const k = findKing(pos.board, color);
    return k >= 0 && attacked(pos.board, k, other(color));
  }

  function pseudoMoves(pos, onlyFrom) {
    const board = pos.board, us = pos.turn, them = other(us);
    const moves = [];
    const dir = us === 'w' ? 1 : -1, startRank = us === 'w' ? 1 : 6, lastRank = us === 'w' ? 7 : 0;
    const addPawn = (from, to, piece, captured) => {
      if ((to >> 3) === lastRank && !pos.noPromo) {
        for (const pr of ['Q', 'R', 'B', 'N']) moves.push({ from, to, piece, captured, promo: pr });
      } else moves.push({ from, to, piece, captured });
    };
    for (let s = 0; s < 64; s++) {
      const p = board[s];
      if (!p || p[0] !== us) continue;
      if (onlyFrom != null && s !== onlyFrom) continue;
      const t = p[1], f = s & 7, r = s >> 3;
      if (t === 'P') {
        const r1 = r + dir;
        if (r1 < 0 || r1 > 7) continue;
        const one = r1 * 8 + f;
        if (!board[one]) {
          addPawn(s, one, p, null);
          const two = (r + 2 * dir) * 8 + f;
          if (r === startRank && !board[two]) moves.push({ from: s, to: two, piece: p, captured: null, flag: 'double' });
        }
        for (const df of [-1, 1]) {
          const ff = f + df;
          if (ff < 0 || ff > 7) continue;
          const to = r1 * 8 + ff, c = board[to];
          if (c && c[0] === them) addPawn(s, to, p, c);
          else if (to === pos.ep && !c) moves.push({ from: s, to, piece: p, captured: them + 'P', flag: 'ep' });
        }
      } else if (t === 'N' || t === 'K') {
        for (const to of (t === 'N' ? KNIGHT : KING)[s]) {
          const c = board[to];
          if (!c || c[0] === them) moves.push({ from: s, to, piece: p, captured: c });
        }
        if (t === 'K' && pos.castling) addCastles(pos, s, moves);
      } else {
        const d0 = t === 'B' ? 4 : 0, d1 = t === 'R' ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          for (const to of RAYS[s][d]) {
            const c = board[to];
            if (!c) { moves.push({ from: s, to, piece: p, captured: null }); continue; }
            if (c[0] === them) moves.push({ from: s, to, piece: p, captured: c });
            break;
          }
        }
      }
    }
    return moves;
  }

  function addCastles(pos, s, moves) {
    const b = pos.board, us = pos.turn, them = other(us);
    const home = us === 'w' ? 4 : 60;
    if (s !== home) return;
    const kSide = us === 'w' ? 'K' : 'k', qSide = us === 'w' ? 'Q' : 'q';
    const rook = us + 'R';
    if (pos.castling.includes(kSide) && b[home + 3] === rook && !b[home + 1] && !b[home + 2] &&
        !attacked(b, home, them) && !attacked(b, home + 1, them) && !attacked(b, home + 2, them)) {
      moves.push({ from: home, to: home + 2, piece: us + 'K', captured: null, flag: 'castle' });
    }
    if (pos.castling.includes(qSide) && b[home - 4] === rook && !b[home - 1] && !b[home - 2] && !b[home - 3] &&
        !attacked(b, home, them) && !attacked(b, home - 1, them) && !attacked(b, home - 2, them)) {
      moves.push({ from: home, to: home - 2, piece: us + 'K', captured: null, flag: 'castle' });
    }
  }

  function makeMove(pos, m) {
    const b = pos.board.slice();
    const us = pos.turn;
    b[m.from] = null;
    b[m.to] = m.promo ? us + m.promo : m.piece;
    if (m.flag === 'ep') b[m.to + (us === 'w' ? -8 : 8)] = null;
    if (m.flag === 'castle') {
      if (m.to === 6) { b[7] = null; b[5] = 'wR'; }
      else if (m.to === 2) { b[0] = null; b[3] = 'wR'; }
      else if (m.to === 62) { b[63] = null; b[61] = 'bR'; }
      else if (m.to === 58) { b[56] = null; b[59] = 'bR'; }
    }
    let c = pos.castling;
    if (c) {
      if (m.piece[1] === 'K') c = c.replace(us === 'w' ? /[KQ]/g : /[kq]/g, '');
      for (const s of [m.from, m.to]) {
        if (s === 0) c = c.replace('Q', '');
        else if (s === 7) c = c.replace('K', '');
        else if (s === 56) c = c.replace('q', '');
        else if (s === 63) c = c.replace('k', '');
      }
    }
    const next = Object.assign({}, pos);
    next.board = b;
    next.turn = other(us);
    next.castling = c;
    next.ep = m.flag === 'double' ? (m.from + m.to) / 2 : -1;
    next.half = m.piece[1] === 'P' || m.captured ? 0 : pos.half + 1;
    next.full = pos.full + (us === 'b' ? 1 : 0);
    return next;
  }

  function isLegalAfter(pos, m) {
    const next = makeMove(pos, m);
    const k = m.piece[1] === 'K' ? m.to : findKing(next.board, pos.turn);
    return k < 0 || !attacked(next.board, k, next.turn);
  }

  function legalMoves(pos, onlyFrom) {
    return pseudoMoves(pos, onlyFrom).filter((m) => isLegalAfter(pos, m));
  }

  function insufficientMaterial(pos) {
    const rest = pos.board.filter((p) => p && p[1] !== 'K');
    if (rest.length === 0) return findKing(pos.board, 'w') >= 0 && findKing(pos.board, 'b') >= 0;
    if (rest.length === 1) return rest[0][1] === 'N' || rest[0][1] === 'B';
    return false;
  }

  // 'checkmate' | 'stalemate' | 'material' | 'fifty' | null
  function status(pos, moves) {
    moves = moves || legalMoves(pos);
    if (moves.length === 0) return inCheck(pos) ? 'checkmate' : 'stalemate';
    if (insufficientMaterial(pos)) return 'material';
    if (pos.half >= 100) return 'fifty';
    return null;
  }

  const givesCheck = (pos, m) => inCheck(makeMove(pos, m), other(pos.turn));
  const sameMove = (a, b) => a.from === b.from && a.to === b.to && (a.promo || 'Q') === (b.promo || 'Q');

  // Standard algebraic notation, e.g. Nf3, exd5, O-O, e8=Q, Qh5#.
  function toSAN(pos, m) {
    let san;
    if (m.flag === 'castle') san = (m.to & 7) === 6 ? 'O-O' : 'O-O-O';
    else if (m.piece[1] === 'P') {
      san = (m.captured ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo : '');
    } else {
      const rivals = legalMoves(pos).filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
      let dis = '';
      if (rivals.length) {
        if (!rivals.some((o) => (o.from & 7) === (m.from & 7))) dis = FILES[m.from & 7];
        else if (!rivals.some((o) => (o.from >> 3) === (m.from >> 3))) dis = String((m.from >> 3) + 1);
        else dis = sqName(m.from);
      }
      san = m.piece[1] + dis + (m.captured ? 'x' : '') + sqName(m.to);
    }
    const next = makeMove(pos, m);
    if (inCheck(next)) san += legalMoves(next).length ? '+' : '#';
    return san;
  }

  const toUCI = (m) => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');
  function fromUCI(pos, uci) {
    const from = sqIndex(uci.slice(0, 2)), to = sqIndex(uci.slice(2, 4)), promo = uci[4] ? uci[4].toUpperCase() : undefined;
    return legalMoves(pos, from).find((m) => m.to === to && (m.promo || undefined) === promo) || null;
  }

  function perft(pos, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(pos);
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) n += perft(makeMove(pos, m), depth - 1);
    return n;
  }

  const api = {
    FILES, VALUES, START_FEN, KNIGHT, KING, RAYS,
    sqName, sqIndex, other, parseFEN, toFEN, posKey, findKing, attacked, attackers, inCheck,
    pseudoMoves, legalMoves, makeMove, isLegalAfter, status, givesCheck, sameMove, insufficientMaterial, perft, toSAN, toUCI, fromUCI,
  };
  root.Chess = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
