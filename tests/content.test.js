// Run: node tests/content.test.js
// Checks every lesson stage is solvable and every puzzle theme generates valid puzzles.
const assert = require('assert');
const C = require('../js/engine.js');
const P = require('../js/puzzles.js');
const { LESSONS } = require('../js/lessons.js');
const St = require('../js/stage.js');

let stages = 0;
for (const lesson of LESSONS) {
  lesson.stages.forEach((stage, i) => {
    const built = St.buildStage(stage);
    const label = `${lesson.id} stage ${i + 1}`;
    if (built.kind === 'stars' || built.kind === 'capture') {
      assert(built.par > 0, `${label} is not solvable`);
      if (built.kind === 'stars') for (const s of built.stars) assert(!built.pos.board[s], `${label}: star on an occupied square`);
    } else if (built.kind === 'fen') {
      const castles = C.legalMoves(built.pos).filter((m) => m.flag === 'castle');
      assert(castles.length === 1, `${label}: expected exactly one legal castle, got ${castles.length}`);
    } else {
      assert(built.puzzle && built.puzzle.solutions.length > 0, `${label}: no puzzle`);
    }
    stages++;
  });
}

let puzzles = 0;
for (const theme of P.THEMES) {
  for (const level of [1, 2, 3]) {
    for (let seed = 1; seed <= (theme.id === 'capture' ? 300 : 30); seed++) {
      const pz = P.makePuzzle(theme.id, level, seed);
      assert(pz, `${theme.id} L${level} seed ${seed} failed to generate`);
      const pos = C.parseFEN(pz.fen);
      assert(!C.inCheck(pos, 'b'), 'black must not be in check');
      assert(pz.solutions.length >= 1, 'puzzle needs a solution');
      for (const m of pz.solutions) assert(P.GOALS[pz.goal].test(pos, m));
      if (pz.goal === 'capture') {
        // Every accepted capture must be impossible to take back, and there must be
        // no guarded capture that still wins material (it would confuse the lesson).
        for (const m of pz.solutions) assert(!C.legalMoves(C.makeMove(pos, m)).some((r) => r.to === m.to), `${theme.id} L${level} seed ${seed}: accepted capture can be taken back`);
        for (const m of C.legalMoves(pos)) assert(!P.isWinningTrade(pos, m), `${theme.id} L${level} seed ${seed}: has a winning trade`);
      }
      if (pz.goal === 'mate1') for (const m of pz.solutions) assert(P.isMate(pos, m));
      if (pz.goal === 'mate2') {
        const m = pz.solutions[0];
        const after = C.makeMove(pos, m);
        const reply = P.defenceFor(after);
        assert(reply, 'mate2 needs a black reply');
        const after2 = C.makeMove(after, reply);
        assert(C.legalMoves(after2).some((mm) => P.isMate(after2, mm)), 'mate2 must finish with mate');
      }
      puzzles++;
    }
  }
}
console.log(`content: ${stages} lesson stages and ${puzzles} puzzles verified`);
