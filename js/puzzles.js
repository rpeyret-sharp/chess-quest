/* Puzzle themes. Most puzzles are generated from a seed and verified by the engine,
 * so there is an endless supply and the answer is always correct. The tactics types
 * (pins, skewers and so on) use real puzzles from Lichess (js/lichess-puzzles.js).
 * White is always to move. */
(function (root) {
  'use strict';
  const C = root.Chess || require('./engine.js');
  const LP = root.LichessPuzzles || require('./lichess-puzzles.js');

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (rnd, n) => Math.floor(rnd() * n);
  const pick = (rnd, arr) => arr[ri(rnd, arr.length)];
  const between = (rnd, a, b) => a + ri(rnd, b - a + 1);
  const VALUE = C.VALUES;

  const emptyPos = () => ({ board: new Array(64).fill(null), turn: 'w', castling: '', ep: -1, half: 0, full: 1 });
  const near = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3))) <= 1;
  const onEdge = (s) => (s & 7) === 0 || (s & 7) === 7 || (s >> 3) === 0 || (s >> 3) === 7;
  const rankIn = (lo, hi) => (s) => (s >> 3) >= lo && (s >> 3) <= hi;

  function place(pos, piece, rnd, allowed) {
    for (let i = 0; i < 80; i++) {
      const s = ri(rnd, 64);
      if (pos.board[s]) continue;
      if (piece[1] === 'P' && (s < 8 || s >= 56)) continue;
      if (allowed && !allowed(s)) continue;
      pos.board[s] = piece;
      return s;
    }
    return -1;
  }

  function placeKings(pos, rnd, bkAllowed, wkAllowed) {
    const wk = place(pos, 'wK', rnd, wkAllowed || rankIn(0, 3));
    const bk = place(pos, 'bK', rnd, (s) => !near(s, wk) && (!bkAllowed || bkAllowed(s)));
    return wk >= 0 && bk >= 0;
  }

  function sane(pos) {
    const b = pos.board;
    const wk = C.findKing(b, 'w'), bk = C.findKing(b, 'b');
    if (wk < 0 || bk < 0 || near(wk, bk)) return false;
    for (let s = 0; s < 64; s++) if (b[s] && b[s][1] === 'P' && (s < 8 || s >= 56)) return false;
    return !C.inCheck(pos, 'b');
  }

  // ---- goal tests --------------------------------------------------------
  // Free = after the capture, Black has no legal way to take back.
  // Uses legal moves, so pinned defenders and kings that cannot recapture are handled.
  function canRecapture(pos, m) {
    const next = C.makeMove(pos, m);
    return C.legalMoves(next).some((r) => r.to === m.to);
  }
  function isFreeCapture(pos, m) {
    return !!m.captured && !canRecapture(pos, m);
  }
  // A guarded capture that still wins material (e.g. pawn takes a guarded knight).
  const isWinningTrade = (pos, m) => !!m.captured && canRecapture(pos, m) && VALUE[m.captured[1]] > VALUE[m.piece[1]];
  function isSafeCheck(pos, m) {
    return C.givesCheck(pos, m) && !canRecapture(pos, m);
  }
  function isMate(pos, m) {
    const next = C.makeMove(pos, m);
    return C.legalMoves(next).length === 0 && C.inCheck(next);
  }
  function isStalemate(pos, m) {
    const next = C.makeMove(pos, m);
    return C.legalMoves(next).length === 0 && !C.inCheck(next);
  }
  function forkTargets(pos, m) {
    if (m.piece !== 'wN') return [];
    const next = C.makeMove(pos, m);
    return C.KNIGHT[m.to].filter((s) => {
      const p = next.board[s];
      return p && p[0] === 'b' && (p[1] === 'K' || VALUE[p[1]] >= 3);
    });
  }
  function isFork(pos, m) {
    if (m.piece !== 'wN') return false;
    const t = forkTargets(pos, m);
    if (t.length < 2) return false;
    if (canRecapture(pos, m)) return false;
    const next = C.makeMove(pos, m);
    return t.some((s) => 'KQR'.includes(next.board[s][1]));
  }
  // Moves that keep a forced mate-in-2 (or mate at once).
  function isMate2Key(pos, m) {
    const next = C.makeMove(pos, m);
    const replies = C.legalMoves(next);
    if (!replies.length) return C.inCheck(next);
    for (const r of replies) {
      const after = C.makeMove(next, r);
      if (!C.legalMoves(after).some((mm) => isMate(after, mm))) return false;
    }
    return true;
  }

  const GOALS = {
    capture: {
      prompt: 'Find a piece you can capture for free!',
      test: isFreeCapture,
      wrong(pos, m) {
        if (!m.captured) return 'Look for an enemy piece you can capture.';
        return 'Careful! That piece is protected. They could capture you back.';
      },
    },
    check: {
      prompt: 'Put the black king in check!',
      test: (pos, m) => C.givesCheck(pos, m),
      wrong: () => 'That is not check. Attack the black king!',
    },
    safecheck: {
      prompt: 'Give check, and keep your piece safe!',
      test: isSafeCheck,
      wrong(pos, m) {
        if (C.givesCheck(pos, m)) return 'That is check, but your piece can be captured! Find a safe check.';
        return 'That is not check. Attack the black king!';
      },
    },
    escape: {
      prompt: 'Your king is in check! Get it to safety.',
      test: () => true,
      wrong: () => 'Your king is still in danger!',
    },
    mate1: {
      prompt: 'Find checkmate in one move!',
      test: isMate,
      wrong(pos, m) {
        if (isStalemate(pos, m)) return 'Oh no, stalemate! The king cannot move but is not in check. That is a draw.';
        if (C.givesCheck(pos, m)) return 'Check! But the king can still escape. Find checkmate!';
        return 'Look for a move that gives checkmate.';
      },
    },
    mate2: {
      prompt: 'Checkmate in 2 moves! Find the first move.',
      test: (pos, m) => isMate(pos, m) || isMate2Key(pos, m),
      wrong(pos, m) {
        if (isStalemate(pos, m)) return 'Oh no, stalemate! That is a draw. Try again.';
        return 'Not quite. Black can escape after that. Try another first move.';
      },
    },
    // Lichess puzzles: play the moves of the puzzle's line. Any checkmate also wins.
    line: {
      prompt: 'Find the best move!',
      test: (pos, m, want) => C.sameMove(m, want) || isMate(pos, m),
      wrong(pos, m) {
        if (isStalemate(pos, m)) return 'Oh no, stalemate! That is a draw. Try again.';
        if (C.givesCheck(pos, m)) return 'Check, but that is not the best move. Look again!';
        if (m.captured) return 'That capture is not the best move. Look again!';
        return 'Not the best move. Look again!';
      },
    },
    fork: {
      prompt: 'Jump your knight to attack two pieces at once!',
      test: isFork,
      wrong(pos, m) {
        if (m.piece === 'wN' && forkTargets(pos, m).length >= 2) return 'Nice idea, but your knight could be captured there!';
        if (m.piece !== 'wN') return 'Use your knight!';
        return 'Find a square where your knight attacks two pieces.';
      },
    },
  };

  const solutionsFor = (pos, goal) => C.legalMoves(pos).filter((m) => GOALS[goal].test(pos, m));

  // ---- generators -------------------------------------------------------
  // Each returns a position (white to move) or null to retry.

  function genCapture(rnd, level) {
    const pos = emptyPos();
    if (!placeKings(pos, rnd, rankIn(4, 7))) return null;
    // Level 4: a crowded board where three or more captures are traps and only one is free.
    const nW = level === 4 ? 4 : [1, 2, 3][level - 1];
    const nB = level === 4 ? between(rnd, 5, 6) : [between(rnd, 1, 2), between(rnd, 2, 3), between(rnd, 3, 4)][level - 1];
    for (let i = 0; i < nW; i++) place(pos, 'w' + pick(rnd, level === 1 ? 'QRBN' : 'QRBNNP'), rnd);
    for (let i = 0; i < nB; i++) place(pos, 'b' + pick(rnd, 'PPNBRQ'), rnd, level === 1 ? null : rankIn(2, 7));
    if (!sane(pos) || C.inCheck(pos, 'w')) return null;
    const caps = C.legalMoves(pos).filter((m) => m.captured);
    const good = caps.filter((m) => isFreeCapture(pos, m));
    const targets = new Set(good.map((m) => m.to));
    if (targets.size !== 1) return null;
    // Keep the lesson clean: no guarded captures that would still win material.
    if (caps.some((m) => isWinningTrade(pos, m))) return null;
    const bad = caps.length - good.length;
    if (level === 1 ? bad !== 0 : bad < level - 1) return null;
    return pos;
  }

  function genCheck(rnd, level) {
    const pos = emptyPos();
    if (!placeKings(pos, rnd, rankIn(4, 7))) return null;
    const nW = level === 1 ? 1 : level === 4 ? between(rnd, 3, 4) : between(rnd, 2, level);
    for (let i = 0; i < nW; i++) place(pos, 'w' + pick(rnd, 'QRBN'), rnd);
    const nB = level === 1 ? ri(rnd, 2) : level === 4 ? between(rnd, 3, 5) : between(rnd, 1, level);
    for (let i = 0; i < nB; i++) place(pos, 'b' + pick(rnd, 'PPNBR'), rnd);
    if (!sane(pos) || C.inCheck(pos, 'w')) return null;
    const moves = C.legalMoves(pos);
    const checks = moves.filter((m) => C.givesCheck(pos, m));
    // Level 1: every check on the board is safe, so the first idea a beginner finds is a good one.
    if (level === 1) return checks.length >= 1 && checks.length <= 3 && checks.every((m) => isSafeCheck(pos, m)) ? pos : null;
    const safe = checks.filter((m) => isSafeCheck(pos, m));
    if (safe.length < 1 || safe.length > (level === 2 ? 2 : 1)) return null;
    if (checks.length - safe.length < (level === 4 ? 2 : 1)) return null;
    return pos;
  }

  function genEscape(rnd, level) {
    const pos = emptyPos();
    if (!placeKings(pos, rnd, rankIn(4, 7), rankIn(0, 4))) return null;
    const nB = level === 1 ? 1 : between(rnd, 1, 2);
    for (let i = 0; i < nB; i++) place(pos, 'b' + pick(rnd, 'QRRBN'), rnd);
    if (level > 1) place(pos, 'b' + pick(rnd, 'PNB'), rnd);
    if (level === 4) place(pos, 'b' + pick(rnd, 'PPNB'), rnd);
    const nW = level === 1 ? ri(rnd, 2) : level === 4 ? between(rnd, 2, 3) : between(rnd, 1, 2);
    for (let i = 0; i < nW; i++) place(pos, 'w' + pick(rnd, 'RBNP'), rnd);
    if (!sane(pos) || !C.inCheck(pos, 'w')) return null;
    const wk = C.findKing(pos.board, 'w');
    if (C.attackers(pos.board, wk, 'b').length !== 1) return null;
    const moves = C.legalMoves(pos);
    if (!moves.length) return null;
    const kingMoves = moves.filter((m) => m.piece === 'wK');
    const tries = C.pseudoMoves(pos, wk).length;
    if (level === 1) return moves.length === kingMoves.length && moves.length <= 3 && tries - moves.length >= 2 ? pos : null;
    if (level === 2) return kingMoves.length < moves.length && moves.length <= 4 ? pos : null;
    // Level 4: lots of pieces, and exactly one move saves the king.
    if (level === 4) return moves.length === 1 && tries >= 3 ? pos : null;
    return moves.length <= 2 && tries >= 3 ? pos : null;
  }

  function genMate(rnd, level, kind) {
    const pos = emptyPos();
    const bkZone = level === 1 || rnd() < 0.85 ? onEdge : null;
    if (kind === 'rook' && level >= 3) {
      // Back-rank mate: king on the back rank behind its own pawns.
      const f = pick(rnd, [0, 1, 5, 6, 7]);
      pos.board[56 + f] = 'bK';
      for (const df of [-1, 0, 1]) {
        const ff = f + df;
        if (ff >= 0 && ff < 8 && (df === 0 || rnd() < 0.85)) pos.board[48 + ff] = 'bP';
      }
      place(pos, 'wK', rnd, rankIn(0, 2));
      place(pos, 'wR', rnd, rankIn(0, 4));
      if (rnd() < 0.5) place(pos, 'w' + pick(rnd, 'RBNP'), rnd, rankIn(0, 5));
      for (let i = ri(rnd, 3); i > 0; i--) place(pos, 'b' + pick(rnd, 'PNBR'), rnd, rankIn(2, 6));
      if (level === 4) {
        place(pos, 'w' + pick(rnd, 'QBNP'), rnd, rankIn(0, 5));
        for (let i = between(rnd, 2, 3); i > 0; i--) place(pos, 'b' + pick(rnd, 'PNBR'), rnd, rankIn(2, 6));
      }
    } else {
      if (!placeKings(pos, rnd, bkZone, kind === 'mix' ? null : (s) => true)) return null;
      if (kind === 'queen') {
        place(pos, 'wQ', rnd);
        if (level >= 2 && rnd() < 0.6) place(pos, 'wP', rnd, rankIn(1, 5));
        if (level >= 2) for (let i = ri(rnd, level); i > 0; i--) place(pos, 'bP', rnd, rankIn(2, 6));
        if (level === 3 && rnd() < 0.5) place(pos, 'b' + pick(rnd, 'NB'), rnd);
        if (level === 4) {
          place(pos, 'b' + pick(rnd, 'NBR'), rnd);
          place(pos, 'w' + pick(rnd, 'BNP'), rnd);
        }
      } else if (kind === 'rook') {
        place(pos, 'wR', rnd);
        if (level === 1) place(pos, 'wR', rnd);
        else for (let i = ri(rnd, 2); i > 0; i--) place(pos, 'bP', rnd, rankIn(2, 6));
      } else {
        const nW = level === 4 ? between(rnd, 3, 5) : between(rnd, 2, level + 1);
        for (let i = 0; i < nW; i++) place(pos, 'w' + pick(rnd, 'QRRBBNNP'), rnd);
        const nB = level === 4 ? between(rnd, 3, 5) : between(rnd, 1, level + 1);
        for (let i = 0; i < nB; i++) place(pos, 'b' + pick(rnd, 'PPPNBR'), rnd);
      }
    }
    if (!sane(pos) || C.inCheck(pos, 'w')) return null;
    const moves = C.legalMoves(pos);
    let mates = 0, checks = 0;
    for (const m of moves) {
      if (!C.givesCheck(pos, m)) continue;
      checks++;
      if (isMate(pos, m)) mates++;
    }
    if (mates < 1 || mates > [3, 2, 1, 1][level - 1]) return null;
    // Level 4: at least two checks that are not mate, to tempt her.
    if (level >= 2 && checks - mates < (level === 4 ? 2 : 1)) return null;
    return pos;
  }

  function genFork(rnd, level) {
    const pos = emptyPos();
    const F = between(rnd, 2, 5) + between(rnd, 1, 6) * 8; // fork square, away from edges
    const targets = C.KNIGHT[F].slice();
    const t1 = pick(rnd, targets);
    const t2 = pick(rnd, targets.filter((s) => s !== t1));
    const pairs = level === 1 ? [['K', 'Q'], ['K', 'R']] : level === 2 ? [['K', 'Q'], ['K', 'R'], ['Q', 'R'], ['R', 'R']] : [['K', 'Q'], ['Q', 'R'], ['R', 'R'], ['K', 'R'], ['Q', 'B']];
    const [a, b] = pick(rnd, pairs);
    pos.board[t1] = 'b' + a;
    pos.board[t2] = 'b' + b;
    if (a !== 'K' && b !== 'K' && place(pos, 'bK', rnd, rankIn(4, 7)) < 0) return null;
    const starts = C.KNIGHT[F].filter((s) => !pos.board[s]);
    if (!starts.length) return null;
    pos.board[pick(rnd, starts)] = 'wN';
    const bk = C.findKing(pos.board, 'b');
    if (place(pos, 'wK', rnd, (s) => (s >> 3) <= 3 && !near(s, bk)) < 0) return null;
    // Level 4: a second knight and a busier board, so she has to work out which knight forks.
    if (level === 4) place(pos, 'wN', rnd, (s) => (s >> 3) <= 4);
    const extras = level === 1 ? ri(rnd, 2) : level === 4 ? between(rnd, 3, 5) : between(rnd, 1, level + 1);
    for (let i = 0; i < extras; i++) place(pos, pick(rnd, level === 4 ? ['bP', 'bP', 'wP', 'wP', 'bN', 'wB', 'bB', 'wP'] : ['bP', 'bP', 'wP', 'wP', 'bN', 'wB']), rnd);
    if (!sane(pos) || C.inCheck(pos, 'w')) return null;
    const moves = C.legalMoves(pos);
    if (moves.some((m) => m.captured && VALUE[m.captured[1]] >= 3 && (isFreeCapture(pos, m) || isWinningTrade(pos, m)))) return null;
    const forks = moves.filter((m) => isFork(pos, m));
    return forks.length === 1 ? pos : null;
  }

  function genMate2(rnd, level) {
    const pos = emptyPos();
    if (!placeKings(pos, rnd, onEdge, (s) => true)) return null;
    const sets = level === 1 ? [['Q', 'R'], ['R', 'R']] : level === 2 ? [['Q'], ['R', 'R'], ['Q', 'N']] : [['Q'], ['R'], ['R', 'B'], ['Q', 'B'], ['R', 'N']];
    for (const t of pick(rnd, sets)) place(pos, 'w' + t, rnd);
    for (let i = ri(rnd, level + 1); i > 0; i--) place(pos, 'bP', rnd, rankIn(2, 6));
    if (level === 4) {
      place(pos, 'b' + pick(rnd, 'NB'), rnd);
      place(pos, 'wP', rnd, rankIn(1, 5));
    }
    if (!sane(pos) || C.inCheck(pos, 'w')) return null;
    const moves = C.legalMoves(pos);
    if (moves.some((m) => C.givesCheck(pos, m) && isMate(pos, m))) return null;
    let keys = 0;
    for (const m of moves) {
      if (isMate2Key(pos, m) && ++keys > [3, 2, 1, 1][level - 1]) return null;
    }
    return keys >= 1 ? pos : null;
  }

  const THEMES = [
    { id: 'capture', title: 'Free Snacks', icon: '🍓', goal: 'capture', gen: genCapture, about: 'Capture pieces that nobody is guarding.' },
    { id: 'check', title: 'Check!', icon: '⚡', goal: (lvl) => (lvl === 1 ? 'check' : 'safecheck'), gen: genCheck, about: 'Attack the king.' },
    { id: 'escape', title: 'Save the King', icon: '🛡️', goal: 'escape', gen: genEscape, about: 'Get your king out of check.' },
    { id: 'mateQ', title: 'Queen Checkmate', icon: '👑', goal: 'mate1', gen: (r, l) => genMate(r, l, 'queen'), about: 'Checkmate with your queen.' },
    { id: 'mateR', title: 'Rook Checkmate', icon: '🏰', goal: 'mate1', gen: (r, l) => genMate(r, l, 'rook'), about: 'Checkmate with your rooks.' },
    { id: 'fork', title: 'Knight Fork', icon: '🐴', goal: 'fork', gen: genFork, about: 'Attack two pieces at once.' },
    { id: 'mateMix', title: 'Checkmate Mix', icon: '🏆', goal: 'mate1', gen: (r, l) => genMate(r, l, 'mix'), about: 'Checkmate with any piece.' },
    { id: 'mate2', title: 'Mate in 2', icon: '🧠', goal: 'mate2', gen: genMate2, about: 'Plan two moves ahead.' },
    // Real puzzles from Lichess. `teach` is read the first time she opens the type.
    { id: 'promote', title: 'New Queen', icon: '✨', goal: 'line', lichess: true, about: 'Turn a pawn into a queen.',
      prompt: 'Find the best move! Can a pawn become a queen?',
      teach: 'When a pawn reaches the other side of the board, it becomes a queen! Sometimes you need a clever move first, to clear the way.' },
    { id: 'backRank', title: 'Back-Rank Mate', icon: '🧱', goal: 'line', lichess: true, about: 'Trap a king behind its own pawns.',
      prompt: 'Find checkmate! The king is stuck on its back row.',
      teach: 'A king behind its own pawns has nowhere to run. A rook or a queen on that back row can give checkmate!' },
    { id: 'double', title: 'Double Attack', icon: '✌️', goal: 'line', lichess: true, about: 'Attack two things at once, with any piece.',
      prompt: 'Find the best move! Attack two things at once.',
      teach: 'A double attack, or fork, hits two pieces at the same time. Your opponent can only save one!' },
    { id: 'pin', title: 'Pins', icon: '📌', goal: 'line', lichess: true, about: 'A piece that cannot move is easy to win.',
      prompt: 'Find the best move! Look for a piece that is stuck in a pin.',
      teach: 'A pin is when a piece cannot move, because a bigger piece is hiding behind it. Pinned pieces are easy to attack!' },
    { id: 'skewer', title: 'Skewers', icon: '🍢', goal: 'line', lichess: true, about: 'Chase a big piece, win the one behind.',
      prompt: 'Find the best move! Attack a big piece, and win the one behind it.',
      teach: 'A skewer attacks a big piece in a straight line. When it moves away, you capture the piece behind it!' },
    { id: 'discover', title: 'Surprise Attack', icon: '🎁', goal: 'line', lichess: true, about: 'Move one piece to uncover another.',
      prompt: 'Find the best move! Move one piece to uncover an attack.',
      teach: 'Move one piece out of the way, and the piece behind it attacks! It is called a discovered attack, and it is a big surprise.' },
  ];
  const THEME = Object.fromEntries(THEMES.map((t) => [t.id, t]));

  // Bump VERSION whenever a generator changes, because the same seed then makes a different puzzle.
  // An ID such as "check-2-200005-v3" always names one exact puzzle (see scripts/show-puzzle.js).
  const VERSION = 3;
  // A Lichess puzzle is named by its Lichess ID instead, e.g. "lichess-KRWGY".
  const puzzleId = (themeId, level, seed) => `${themeId}-${level}-${seed}-v${VERSION}`;
  function parseId(id) {
    const l = /^lichess-([A-Za-z0-9]+)$/.exec(String(id).trim());
    if (l) return { lichess: l[1] };
    const m = /^([A-Za-z0-9]+)-(\d)-(\d+)(?:-v(\d+))?$/.exec(String(id).trim());
    return m ? { themeId: m[1], level: +m[2], seed: +m[3], version: m[4] ? +m[4] : null } : null;
  }

  // Black's move is played on the board first; `fen` is the position White solves.
  function lichessPuzzle(themeId, level, seed, entry) {
    const [lid, before, setup, line, rating] = entry;
    const start = C.parseFEN(before);
    const pos = C.makeMove(start, C.fromUCI(start, setup));
    const moves = line.split(' ');
    return { id: `lichess-${lid}`, themeId, level, seed, goal: 'line', fen: C.toFEN(pos), before, setup, line: moves, rating,
      prompt: THEME[themeId].prompt, solutions: [C.fromUCI(pos, moves[0])] };
  }
  let lichessIndex = null;
  function lichessById(lid) {
    if (!lichessIndex) {
      lichessIndex = new Map();
      for (const t of THEMES) if (t.lichess) LP[t.id].forEach((list, i) => list.forEach((e) => lichessIndex.set(e[0], [t.id, i + 1, e])));
    }
    const hit = lichessIndex.get(lid);
    return hit ? lichessPuzzle(hit[0], hit[1], 0, hit[2]) : null;
  }

  function makePuzzle(themeId, level, seed) {
    const theme = THEME[themeId];
    if (theme.lichess) {
      const list = LP[themeId][level - 1];
      return lichessPuzzle(themeId, level, seed, list[(seed % 100000) % list.length]);
    }
    const goal = typeof theme.goal === 'function' ? theme.goal(level) : theme.goal;
    for (let attempt = 0; attempt < 40; attempt++) {
      const rnd = mulberry32((seed * 7919 + attempt * 104729) >>> 0);
      for (let i = 0; i < 4000; i++) {
        const pos = theme.gen(rnd, level);
        if (pos) {
          return { id: puzzleId(themeId, level, seed), themeId, level, seed, goal, fen: C.toFEN(pos), prompt: GOALS[goal].prompt, solutions: solutionsFor(pos, goal) };
        }
      }
    }
    return null;
  }

  // Black's reply in a mate-in-2: pick a reply that still loses, preferring the
  // one leaving White the fewest mates (the "toughest" defence).
  function defenceFor(pos) {
    const replies = C.legalMoves(pos);
    let best = null, fewest = Infinity;
    for (const r of replies) {
      const after = C.makeMove(pos, r);
      const n = C.legalMoves(after).filter((m) => isMate(after, m)).length;
      if (n < fewest) { fewest = n; best = r; }
    }
    return best;
  }

  const api = { VERSION, THEMES, THEME, GOALS, puzzleId, parseId, makePuzzle, lichessById, solutionsFor, defenceFor, isMate, isFreeCapture, isWinningTrade, mulberry32 };
  root.Puzzles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
