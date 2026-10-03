// Run: node tests/review.test.js
const assert = require('assert');
const C = require('../js/engine.js');
const A = require('../js/ai.js');

// Notation
const san = (fen, uci) => { const p = C.parseFEN(fen); return C.toSAN(p, C.fromUCI(p, uci)); };
assert.strictEqual(san(C.START_FEN, 'g1f3'), 'Nf3');
assert.strictEqual(san(C.START_FEN, 'e2e4'), 'e4');
assert.strictEqual(san('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 3', 'h5f7'), 'Qxf7#');
assert.strictEqual(san('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1g1'), 'O-O');
assert.strictEqual(san('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'a1d1'), 'Rd1');
assert.strictEqual(san('4k3/8/8/8/8/8/4K3/R6R w - - 0 1', 'a1d1'), 'Rad1');
assert.strictEqual(san('4k3/8/8/8/R7/8/4K3/R7 w - - 0 1', 'a1a2'), 'R1a2');
assert.strictEqual(san('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7a8q'), 'a8=Q+');
assert.strictEqual(san('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4d5'), 'exd5');

// Move ratings
const rate = (fen, uci) => { const p = C.parseFEN(fen); return A.analyseMove(p, C.fromUCI(p, uci), 2); };
// Hanging the queen for nothing is a blunder.
assert.strictEqual(rate('4k3/8/8/3p4/8/8/2Q5/4K3 w - - 0 1', 'c2c4').label, 'blunder');
// Taking a free queen is best.
assert.strictEqual(rate('4k3/8/8/3q4/8/8/3Q4/4K3 w - - 0 1', 'd2d5').label, 'best');
// Missing mate in one is flagged.
const miss = rate('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a2');
assert.strictEqual(miss.label, 'blunder');
assert(miss.missedMate);
// Only legal move is best.
assert.strictEqual(C.legalMoves(C.parseFEN('7k/8/8/8/8/8/6q1/7K w - - 0 1')).length, 1);
assert.strictEqual(rate('7k/8/8/8/8/8/6q1/7K w - - 0 1', 'h1g2').label, 'best');
console.log('review: all passed');
