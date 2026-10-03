/* Learn path. Stage types:
 *  stars   - move the piece to collect every star (no opponent moves)
 *  capture - capture every black piece (black pieces stand still)
 *  puzzle  - a generated puzzle with a fixed seed (same every time)
 *  fen     - a hand-written position with a goal (castling) */
(function (root) {
  'use strict';

  const S = (pieces, stars, say) => ({ type: 'stars', pieces, stars, say });
  const CAP = (pieces, say) => ({ type: 'capture', pieces, say });
  const PZ = (theme, level, seed, say) => ({ type: 'puzzle', theme, level, seed, say });

  const LESSONS = [
    {
      id: 'rook', title: 'The Rook', piece: 'wR',
      intro: 'The rook moves in straight lines: up, down, left and right, as far as it likes.',
      stages: [
        S({ c1: 'wR' }, ['c6'], 'Move the rook up to the star.'),
        S({ b2: 'wR' }, ['b7', 'g7'], 'Collect both stars.'),
        S({ a1: 'wR' }, ['a8', 'h8', 'h1'], 'Go all the way around the board!'),
        S({ d4: 'wR' }, ['d8', 'a8', 'a1', 'h1'], 'Can you get all four stars?'),
      ],
    },
    {
      id: 'bishop', title: 'The Bishop', piece: 'wB',
      intro: 'The bishop moves diagonally. It always stays on squares of the same colour.',
      stages: [
        S({ c1: 'wB' }, ['f4'], 'Slide the bishop to the star.'),
        S({ c1: 'wB' }, ['a3', 'e7'], 'Collect both stars.'),
        S({ f1: 'wB' }, ['h3', 'c8', 'a6'], 'Zig-zag to every star!'),
        S({ d4: 'wB' }, ['a7', 'g1', 'h2', 'b8'], 'Four stars. You can do it!'),
      ],
    },
    {
      id: 'queen', title: 'The Queen', piece: 'wQ',
      intro: 'The queen is the strongest piece. She moves like a rook AND like a bishop.',
      stages: [
        S({ d1: 'wQ' }, ['d7'], 'Move the queen to the star.'),
        S({ d1: 'wQ' }, ['h5', 'e8'], 'Straight or diagonal. Get both stars!'),
        S({ a1: 'wQ' }, ['h8', 'h1', 'a8', 'd5'], 'Collect all the stars.'),
        S({ e4: 'wQ' }, ['b7', 'g6', 'c2', 'a4', 'h1'], 'A big queen adventure!'),
      ],
    },
    {
      id: 'king', title: 'The King', piece: 'wK',
      intro: 'The king is the most important piece. He moves one square in any direction.',
      stages: [
        S({ e1: 'wK' }, ['e2', 'e3'], 'One step at a time.'),
        S({ e1: 'wK' }, ['f2', 'g3', 'h3'], 'The king can step diagonally too.'),
        S({ d4: 'wK' }, ['c5', 'e5', 'e3', 'c3'], 'Walk around in a circle!'),
      ],
    },
    {
      id: 'knight', title: 'The Knight', piece: 'wN',
      intro: 'The knight jumps in an L shape: two squares one way, then one square to the side. It can jump over pieces!',
      stages: [
        S({ b1: 'wN' }, ['c3'], 'Jump to the star.'),
        S({ g1: 'wN' }, ['f3', 'e5'], 'Hop, hop!'),
        S({ b1: 'wN' }, ['c3', 'd5', 'f6'], 'Follow the stars.'),
        S({ a1: 'wN' }, ['b3', 'c5', 'd7', 'f8'], 'Jump all the way up the board.'),
        S({ e4: 'wN' }, ['e5'], 'Tricky! The star is right next to you, but knights cannot step there directly.'),
      ],
    },
    {
      id: 'pawn', title: 'The Pawn', piece: 'wP',
      intro: 'Pawns march forward one square. On their very first move they can jump two!',
      stages: [
        S({ e2: 'wP' }, ['e4'], 'Move the pawn two squares on its first move.'),
        S({ c2: 'wP' }, ['c3', 'c6'], 'Pawns only go forward.'),
        CAP({ c2: 'wP', d3: 'bP', e4: 'bN', d5: 'bB' }, 'Pawns capture diagonally! Capture all the black pieces.'),
        S({ e6: 'wP' }, ['e8', 'a4'], 'When a pawn reaches the end, it becomes a queen! Then grab the last star.'),
      ],
    },
    {
      id: 'capture', title: 'Capture!', piece: 'bP',
      intro: 'You capture a piece by moving onto its square. Capture all the black pieces!',
      stages: [
        CAP({ a1: 'wR', a6: 'bP', e6: 'bN', e2: 'bB' }, 'Use the rook to capture everything.'),
        CAP({ c1: 'wB', f4: 'bP', d6: 'bN', b8: 'bR' }, 'Use the bishop.'),
        CAP({ b1: 'wN', c3: 'bP', e4: 'bB', f6: 'bQ' }, 'Use the knight.'),
        CAP({ d1: 'wQ', d5: 'bP', a8: 'bR', a2: 'bN' }, 'Use the queen.'),
      ],
    },
    {
      id: 'free', title: 'Free Pieces', piece: 'bN',
      intro: 'A piece is free when nobody guards it. Capture it and it cannot be won back!',
      stages: [PZ('capture', 1, 11), PZ('capture', 1, 12), PZ('capture', 1, 13), PZ('capture', 2, 14)],
    },
    {
      id: 'check', title: 'Check', piece: 'bK',
      intro: 'When a piece attacks the king, that is called check!',
      stages: [PZ('check', 1, 21), PZ('check', 1, 22), PZ('check', 1, 23), PZ('check', 1, 24)],
    },
    {
      id: 'escape', title: 'Escape Check', piece: 'wK',
      intro: 'When your king is in check, you must save him. Move away, block, or capture the attacker.',
      stages: [PZ('escape', 1, 31), PZ('escape', 1, 32), PZ('escape', 2, 33), PZ('escape', 2, 34)],
    },
    {
      id: 'mate', title: 'Checkmate', piece: 'wQ',
      intro: 'Checkmate is check where the king cannot escape. That wins the game!',
      stages: [PZ('mateQ', 1, 41), PZ('mateQ', 1, 42), PZ('mateR', 1, 43), PZ('mateR', 1, 44), PZ('mateQ', 2, 45)],
    },
    {
      id: 'castle', title: 'Castling', piece: 'wR',
      intro: 'Castling is a special move. The king jumps two squares toward a rook, and the rook hops over him. It keeps your king safe!',
      stages: [
        { type: 'fen', fen: '4k3/8/8/8/8/8/5PPP/4K2R w K - 0 1', goal: 'castle', say: 'Move your king two squares to the right to castle.' },
        { type: 'fen', fen: '4k3/8/8/8/8/8/PPP5/R3K3 w Q - 0 1', goal: 'castle', say: 'Now castle the other way: two squares to the left.' },
        { type: 'fen', fen: '4kr2/8/8/8/8/8/PP4PP/R3K2R w KQ - 0 1', goal: 'castle', say: 'The black rook guards f1, so you cannot castle that way. Castle on the other side!' },
      ],
    },
  ];

  const api = { LESSONS };
  root.Lessons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
