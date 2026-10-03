# Chess Quest

A chess learning app for a young beginner, built for the iPad. No accounts, no ads, no daily limits, and no dependencies: plain HTML, CSS and JavaScript.

## What's inside

- **Learn**: 12 short lessons. How each piece moves (collect the stars), capturing, free pieces, check, escaping check, checkmate and castling. Each stage earns 1 to 3 stars.
- **Puzzles**: 8 puzzle types that open one after another (solve 3 to open the next): Free Snacks (capture an unguarded piece), Check!, Save the King, Queen Checkmate, Rook Checkmate, Knight Fork, Checkmate Mix and Mate in 2. Each type gets harder over 3 levels as she solves more. Puzzles are generated from a seed and checked by the chess engine, so the supply never runs out and every answer is correct.
- **Today's Challenge**: 5 puzzles a day from the types she has opened, with a bonus and a day streak.
- **Play**: full games or Pawn Battle against four robots: Chick (random), Turtle (greedy), Fox and Owl. There are Undo and Hint buttons, and dots show where a piece can move.
- **Stickers**: 40 stickers to collect with stars.
- **Pip the pawn** reads every instruction aloud (tap Pip to hear it again), so she does not need to read fluently.
- **Grown-ups** (press and hold the link at the bottom of the home screen): name, sound, read-aloud, move dots, open all puzzle types, a progress summary, and a backup code to move progress between devices.

Wrong moves get a short explanation, such as "That piece is protected", "Check, but the king can escape" or "Stalemate! That's a draw", rather than just a buzzer. Two mistakes bring up a hint.

## Run it on a computer

```bash
npm start
```

Then open http://localhost:8765.

## Put it on the iPad

Progress is saved in the iPad's browser storage. Use the backup code under Grown-ups if you ever move devices.

**Option 1: GitHub Pages (recommended).** Push this folder to a GitHub repository, turn on Pages (Settings > Pages > Deploy from branch > `master` / root), then on the iPad open the Pages URL in Safari and choose **Share > Add to Home Screen**. It opens full-screen like an app and works offline after the first visit.

**Option 2: same Wi-Fi.** Run `npm start` on the Mac, find the Mac's IP address (System Settings > Wi-Fi > Details), and open `http://<that-ip>:8765` on the iPad. The Mac has to be on, and offline mode is not available this way.

## Reporting a problem puzzle

Every puzzle shows a small **Puzzle ID** next to the board, such as `check-2-200005-v3` (theme, level, number, puzzle version). Lesson stages show a Lesson ID. To see that exact puzzle with the moves the app accepts:

```bash
node scripts/show-puzzle.js check-2-200005-v3
```

## Development

```bash
npm test
```

This checks the move generator against standard perft counts, checks that every lesson stage can be solved, and checks 2,340 generated puzzles against their goals.

```bash
npm run build
```

This writes a single self-contained page to `dist/chess-quest.html`.

| File | Purpose |
|---|---|
| `js/engine.js` | Chess rules: legal moves, check, mate, castling, en passant, promotion |
| `js/ai.js` | Robot opponents (alpha-beta search) and Pawn Battle rules |
| `js/puzzles.js` | Puzzle generators and goal checks |
| `js/lessons.js`, `js/stage.js` | Lesson content and stage logic |
| `js/board.js` | Touch board: tap or drag, move dots, arrows, animations |
| `js/pieces.js` | Hand-drawn SVG pieces |
| `js/app.js` | Screens, progress, rewards, sound, read-aloud |
