// Run: node tests/pawns.test.js
const assert = require('assert');
const C = require('../js/engine.js');
const A = require('../js/ai.js');
const pawns = (fen) => Object.assign(C.parseFEN(fen), { variant: 'pawns', noPromo: true });

// Both sides blocked: draw, not a loss for the side to move.
let r = A.variantResult(pawns('8/8/8/3p4/3P4/8/8/8 w - - 0 1'));
assert.deepStrictEqual(r, { winner: null, reason: 'blocked' });
// Side to move blocked while the other side could still move: also a draw.
r = A.variantResult(pawns('8/8/2p5/3p4/3P4/8/8/8 w - - 0 1'));
assert.deepStrictEqual(r, { winner: null, reason: 'blocked' });
// A pawn on the last rank wins; capturing every enemy pawn wins.
assert.strictEqual(A.variantResult(pawns('3P4/8/8/8/8/8/p7/8 b - - 0 1')).winner, 'w');
assert.strictEqual(A.variantResult(pawns('8/8/8/8/8/8/PP6/8 b - - 0 1')).winner, 'w');
// With no legal moves the robot returns no move.
const m = A.botMove(pawns('8/8/8/8/8/8/8/8 w - - 0 1'), A.BOTS[2]);
assert.strictEqual(m, null);
console.log('pawns: all passed');
