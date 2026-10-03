/* Robot opponents: alpha-beta search with quiescence, plus the Pawn Battle variant. */
(function (root) {
  'use strict';
  const C = root.Chess || require('./engine.js');

  const VAL = { P: 100, N: 310, B: 320, R: 500, Q: 900, K: 0 };
  const MATE = 100000;

  // Piece-square tables from White's view, index a1..h8 (rank 1 first).
  const PST = {
    P: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0,
      5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
    N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    R: [0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0, 0, 5, 5, 5, 5, 0, -5,
      -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    K: [20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20,
      -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30],
    KE: [-50, -30, -30, -30, -30, -30, -30, -50, -30, -30, 0, 0, 0, 0, -30, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -20, -10, 0, 0, -10, -20, -30, -50, -40, -30, -20, -20, -30, -40, -50],
  };

  // --- Pawn Battle variant -------------------------------------------------
  // No kings. You win by getting a pawn to the far side or capturing every enemy pawn.
  // If the side to move has no moves, it is a draw (like stalemate in chess).
  function pawnWinner(pos) {
    const b = pos.board;
    let w = 0, bl = 0;
    for (let s = 0; s < 64; s++) {
      if (b[s] === 'wP') { w++; if (s >= 56) return 'w'; }
      else if (b[s] === 'bP') { bl++; if (s < 8) return 'b'; }
    }
    if (!w) return 'b';
    if (!bl) return 'w';
    return null;
  }

  function variantResult(pos, moves) {
    // returns {winner:'w'|'b'|null, reason} or null if game continues
    if (pos.variant === 'pawns') {
      const w = pawnWinner(pos);
      if (w) return { winner: w, reason: 'pawns' };
      moves = moves || C.legalMoves(pos);
      if (!moves.length) return { winner: null, reason: 'blocked' };
      return null;
    }
    moves = moves || C.legalMoves(pos);
    const st = C.status(pos, moves);
    if (!st) return null;
    if (st === 'checkmate') return { winner: C.other(pos.turn), reason: st };
    return { winner: null, reason: st };
  }

  function evaluate(pos) {
    const b = pos.board;
    let score = 0;
    if (pos.variant === 'pawns') {
      for (let s = 0; s < 64; s++) {
        const p = b[s];
        if (!p) continue;
        const r = s >> 3, f = s & 7;
        const adv = p[0] === 'w' ? r - 1 : 6 - r;
        let v = 100 + adv * adv * 8;
        // passed pawn bonus
        let passed = true;
        const step = p[0] === 'w' ? 1 : -1;
        for (let rr = r + step; rr >= 0 && rr < 8 && passed; rr += step) {
          for (let ff = f - 1; ff <= f + 1; ff++) {
            if (ff >= 0 && ff < 8 && b[rr * 8 + ff] === (p[0] === 'w' ? 'bP' : 'wP')) { passed = false; break; }
          }
        }
        if (passed) v += 30 + adv * adv * 15;
        score += p[0] === 'w' ? v : -v;
      }
      return pos.turn === 'w' ? score : -score;
    }
    let nonPawn = 0;
    for (let s = 0; s < 64; s++) { const p = b[s]; if (p && p[1] !== 'P' && p[1] !== 'K') nonPawn += VAL[p[1]]; }
    const endgame = nonPawn <= 1300;
    for (let s = 0; s < 64; s++) {
      const p = b[s];
      if (!p) continue;
      const t = p[1];
      const idx = p[0] === 'w' ? s : (7 - (s >> 3)) * 8 + (s & 7);
      const v = VAL[t] + (t === 'K' && endgame ? PST.KE : PST[t])[idx];
      score += p[0] === 'w' ? v : -v;
    }
    // In won endgames push the losing king to the edge and bring ours closer.
    if (endgame && Math.abs(score) > 300) {
      const strong = score > 0 ? 'w' : 'b';
      const wk = C.findKing(b, strong), lk = C.findKing(b, C.other(strong));
      if (wk >= 0 && lk >= 0) {
        const lf = lk & 7, lr = lk >> 3;
        const edge = Math.max(3 - lf, lf - 4) + Math.max(3 - lr, lr - 4);
        const dist = Math.abs((wk & 7) - lf) + Math.abs((wk >> 3) - lr);
        const bonus = edge * 20 + (14 - dist) * 6;
        score += strong === 'w' ? bonus : -bonus;
      }
    }
    return pos.turn === 'w' ? score : -score;
  }

  function orderMoves(moves) {
    for (const m of moves) {
      m._o = (m.captured ? VAL[m.captured[1]] * 10 - VAL[m.piece[1]] / 10 + 1000 : 0) + (m.promo ? VAL[m.promo] : 0);
    }
    return moves.sort((a, b) => b._o - a._o);
  }

  function quiesce(pos, alpha, beta, ctx, qdepth) {
    ctx.nodes++;
    const stand = evaluate(pos);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qdepth <= 0) return alpha;
    const caps = orderMoves(C.legalMoves(pos).filter((m) => m.captured || m.promo === 'Q'));
    for (const m of caps) {
      const score = -quiesce(C.makeMove(pos, m), -beta, -alpha, ctx, qdepth - 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(pos, depth, alpha, beta, ply, ctx) {
    ctx.nodes++;
    const moves = C.legalMoves(pos);
    if (pos.variant === 'pawns') {
      const r = variantResult(pos, moves);
      if (r) return !r.winner ? 0 : r.winner === pos.turn ? MATE - ply : -MATE + ply;
    } else {
      if (!moves.length) return C.inCheck(pos) ? -MATE + ply : 0;
      if (ply > 0 && (pos.half >= 100 || C.insufficientMaterial(pos) || ctx.seen.has(C.posKey(pos)))) return 0;
    }
    if (depth <= 0) return ctx.quiesce ? quiesce(pos, alpha, beta, ctx, 6) : evaluate(pos);
    orderMoves(moves);
    for (const m of moves) {
      const score = -negamax(C.makeMove(pos, m), depth - 1, -beta, -alpha, ply + 1, ctx);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  // Score every root move. Returns [{move, score}] best first.
  function scoreMoves(pos, depth, opts) {
    opts = opts || {};
    const ctx = { nodes: 0, quiesce: opts.quiesce !== false, seen: new Set(opts.history || []) };
    const moves = orderMoves(C.legalMoves(pos));
    const out = [];
    for (const m of moves) {
      const next = C.makeMove(pos, m);
      let score;
      if (pos.variant === 'pawns') {
        const r = variantResult(next);
        score = r ? (!r.winner ? 0 : r.winner === pos.turn ? MATE : -MATE) : -negamax(next, depth - 1, -MATE - 1, MATE + 1, 1, ctx);
      } else {
        score = -negamax(next, depth - 1, -MATE - 1, MATE + 1, 1, ctx);
      }
      out.push({ move: m, score });
    }
    out.sort((a, b) => b.score - a.score);
    out.nodes = ctx.nodes;
    return out;
  }

  // Best move only, with the alpha-beta window narrowed at the root too, so a deeper search stays quick.
  function bestMove(pos, depth, opts) {
    opts = opts || {};
    const ctx = { nodes: 0, quiesce: opts.quiesce !== false, seen: new Set(opts.history || []) };
    let alpha = -MATE - 1, best = null;
    for (const m of orderMoves(C.legalMoves(pos))) {
      if (m.promo && m.promo !== 'Q') continue;
      const score = -negamax(C.makeMove(pos, m), depth - 1, -MATE - 1, -alpha, 1, ctx);
      if (score > alpha || !best) { alpha = Math.max(alpha, score); best = m; }
    }
    return best;
  }

  // Robot personalities, weakest first. `noise` adds random centipawns per move, and `slip` is the
  // chance of a careless random move, so the in-between robots make human-like mistakes.
  const BOTS = [
    { id: 'chick', name: 'Chick', emoji: '🐣', blurb: 'Just learning. Moves almost at random.', depth: 0, noise: 0, stars: 1 },
    { id: 'mouse', name: 'Mouse', emoji: '🐭', blurb: 'Nibbles free pieces, but often forgets to look.', depth: 1, noise: 80, slip: 0.45, quiesce: false, stars: 2 },
    { id: 'turtle', name: 'Turtle', emoji: '🐢', blurb: 'Grabs anything it can. Watch for traps!', depth: 1, noise: 60, quiesce: false, stars: 3 },
    { id: 'puppy', name: 'Puppy', emoji: '🐶', blurb: 'Looks ahead a little, but gets too excited.', depth: 2, noise: 70, slip: 0.15, stars: 4 },
    { id: 'fox', name: 'Fox', emoji: '🦊', blurb: 'Sneaky. Thinks one move ahead.', depth: 2, noise: 40, stars: 5 },
    { id: 'bear', name: 'Bear', emoji: '🐻', blurb: 'Strong and steady, but a bit sleepy.', depth: 3, noise: 35, slip: 0.06, stars: 6 },
    { id: 'owl', name: 'Owl', emoji: '🦉', blurb: 'Wise and careful. A real challenge!', depth: 3, noise: 12, stars: 8 },
    { id: 'dragon', name: 'Dragon', emoji: '🐲', blurb: 'The champion. Thinks far ahead!', depth: 4, noise: 0, stars: 12 },
  ];

  function pick(list, rnd) { return list[Math.floor(rnd() * list.length)]; }

  function botMove(pos, bot, opts) {
    opts = opts || {};
    const rnd = opts.random || Math.random;
    const moves = C.legalMoves(pos);
    if (!moves.length) return null;
    if (bot.depth === 0) {
      // Chick: random, but takes a free piece or mates now and then.
      if (rnd() < 0.35) {
        const scored = scoreMoves(pos, 1, { quiesce: true, history: opts.history });
        if (scored[0].score > 150) return scored[0].move;
      }
      const nonPromoOrQueen = moves.filter((m) => !m.promo || m.promo === 'Q');
      return pick(nonPromoOrQueen, rnd);
    }
    // A slip: a random move, but never one that throws away a mate it can see.
    if (bot.slip && rnd() < bot.slip) {
      const quick = scoreMoves(pos, 1, { quiesce: false, history: opts.history });
      if (quick[0].score < MATE / 2) return pick(moves.filter((m) => !m.promo || m.promo === 'Q'), rnd);
    }
    // Pawn Battle positions are simple, so search deeper there.
    const depth = pos.variant === 'pawns' ? bot.depth + 2 : bot.depth;
    if (!bot.noise) return bestMove(pos, depth, { quiesce: bot.quiesce !== false, history: opts.history }) || moves[0];
    const scored = scoreMoves(pos, depth, { quiesce: bot.quiesce !== false, history: opts.history });
    let best = null, bestScore = -Infinity;
    for (const s of scored) {
      if (s.move.promo && s.move.promo !== 'Q' && s.score < MATE / 2) continue;
      const mateish = Math.abs(s.score) > MATE / 2;
      const v = s.score + (mateish ? 0 : (rnd() * 2 - 1) * bot.noise);
      if (v > bestScore) { bestScore = v; best = s.move; }
    }
    return best || scored[0].move;
  }

  // Rate a move the way ChessKids does, by how much worse it is than the best move
  // (in hundredths of a pawn, from a short search). Checkmates count as 15 pawns.
  const LABELS = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'];
  function analyseMove(pos, move, depth) {
    const scored = scoreMoves(pos, depth || 2, { quiesce: true });
    if (!scored.length) return { label: 'best', loss: 0, best: null, missedMate: false };
    const cap = (v) => Math.max(-1500, Math.min(1500, v));
    const best = scored[0];
    const mine = scored.find((s) => C.sameMove(s.move, move)) || best;
    const loss = Math.max(0, cap(best.score) - cap(mine.score));
    const label = scored.length === 1 || C.sameMove(best.move, move) || loss <= 15 ? 'best'
      : loss < 60 ? 'good' : loss < 150 ? 'inaccuracy' : loss < 300 ? 'mistake' : 'blunder';
    const missedMate = best.score > MATE / 2 && mine.score < MATE / 2;
    return { label, loss, best: best.move, missedMate };
  }

  function hintMove(pos, history) {
    const scored = scoreMoves(pos, 2, { quiesce: true, history });
    return scored.length ? scored[0].move : null;
  }

  const api = { BOTS, LABELS, botMove, bestMove, hintMove, analyseMove, scoreMoves, evaluate, variantResult, MATE };
  root.ChessAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
