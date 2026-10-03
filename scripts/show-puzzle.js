// Print a puzzle from the ID shown in the app, e.g.  node scripts/show-puzzle.js check-2-200005-v3
const C = require('../js/engine.js');
const P = require('../js/puzzles.js');

const id = process.argv[2];
const parsed = P.parseId(id || '');
const glyph = (p) => (p ? (p[0] === 'w' ? p[1] : p[1].toLowerCase()) : '.');
function draw(pos) {
  for (let r = 7; r >= 0; r--) {
    let row = `${r + 1} `;
    for (let f = 0; f < 8; f++) row += glyph(pos.board[r * 8 + f]) + ' ';
    console.log(row);
  }
  console.log('  a b c d e f g h   (White = capitals, White to move)\n');
}
if (parsed && parsed.lichess) {
  const pz = P.lichessById(parsed.lichess);
  if (!pz) { console.error(`No puzzle ${id} in js/lichess-puzzles.js`); process.exit(1); }
  const pos = C.parseFEN(pz.fen);
  draw(pos);
  console.log(`ID:       ${pz.id} (Lichess rating ${pz.rating})`);
  console.log(`Theme:    ${P.THEME[pz.themeId].title}, level ${pz.level}`);
  console.log(`Prompt:   ${pz.prompt}`);
  console.log(`FEN:      ${pz.fen}   (after Black's move ${pz.setup})`);
  console.log(`Line:     ${pz.line.join(' ')}   (White, Black, White…; any checkmate also wins)`);
  console.log(`Lichess:  https://lichess.org/training/${parsed.lichess}  (shown from the other side if Lichess has you playing Black)`);
  process.exit(0);
}
if (!parsed || !P.THEME[parsed.themeId]) {
  console.error('Usage: node scripts/show-puzzle.js <puzzle-id>   (for example check-2-200005-v3 or lichess-8UBk3)');
  process.exit(1);
}
if (parsed.version && parsed.version !== P.VERSION) {
  console.warn(`Note: this ID was made by puzzle version ${parsed.version}, but the code is version ${P.VERSION}.`);
  console.warn('Check out the commit that matches that version to see the exact puzzle.\n');
}
const pz = P.makePuzzle(parsed.themeId, parsed.level, parsed.seed);
const pos = C.parseFEN(pz.fen);
draw(pos);
const name = (m) => `${m.piece[1]}${C.sqName(m.from)}${m.captured ? 'x' : '-'}${C.sqName(m.to)}`;
console.log(`ID:       ${pz.id}`);
console.log(`Theme:    ${P.THEME[pz.themeId].title}, level ${pz.level}`);
console.log(`Prompt:   ${pz.prompt}`);
console.log(`FEN:      ${pz.fen}`);
console.log(`Accepted: ${pz.solutions.map(name).join(', ')}`);
const rejected = C.legalMoves(pos).filter((m) => !pz.solutions.some((s) => C.sameMove(s, m)));
const notable = rejected.filter((m) => m.captured || C.givesCheck(pos, m));
if (notable.length) console.log(`Rejected checks/captures: ${notable.map((m) => `${name(m)} ("${P.GOALS[pz.goal].wrong(pos, m)}")`).join('; ')}`);
console.log(`Analyse:  https://lichess.org/analysis/${pz.fen.replace(/ /g, '_')}`);
