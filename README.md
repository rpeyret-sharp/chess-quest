# Chess Quest

A chess learning app for a young beginner, built for the iPad. No accounts, no ads, no daily limits, and no dependencies: plain HTML, CSS and JavaScript.

## What's inside

- **Learn**: 12 short lessons. How each piece moves (collect the stars), capturing, free pieces, check, escaping check, checkmate and castling. Each stage earns 1 to 3 stars.
- **Puzzles**: 8 puzzle types that open one after another (solve 3 to open the next): Free Snacks (capture an unguarded piece), Check!, Save the King, Queen Checkmate, Rook Checkmate, Knight Fork, Checkmate Mix and Mate in 2. Each type gets harder over 4 levels as she solves more. Level 4 crowds the board with extra pieces and traps (guarded pieces, unsafe checks, checks that are not mate, a second knight), and has exactly one right answer. Puzzles are generated from a seed and checked by the chess engine, so the supply never runs out and every answer is correct.
- **Mix it up**: endless puzzles that switch to a different open puzzle type every time. Each one still counts toward its own type's level.
- **Level bars**: each puzzle type shows a progress bar toward its next level (5 solved for level 2, 15 for level 3, 30 for level 4), with a "Level up!" message when she gets there.
- **Today's Challenge**: 5 puzzles a day from the types she has opened, with a bonus and a day streak.
- **Hints cost stars**: a puzzle is worth 2 stars and each hint (2 at most: first the piece, then the move) costs 1. In lessons each hint or mistake takes one star off (minimum 1). In games, up to 3 hints, each taking a star off a win. Every hint has a wait before it unlocks (20 seconds by default, adjustable under Grown-ups) so hints cannot be tapped straight away.
- **Replay and My puzzles**: every puzzle has Start over and Play it again buttons, and **My puzzles** (on the Puzzles screen) lists every puzzle she has seen, with filters for unsolved ones and by type. Replays are practice and earn no stars, unless the puzzle was never solved.
- **Play**: full games or Pawn Battle against four robots: Chick (random), Turtle (greedy), Fox and Owl. There are Undo and Hint buttons, and dots show where a piece can move.
- **My games and game review**: the last 50 games are saved (Play > My games). Replay any game move by move. Each of her moves is rated like on ChessKids: ★ Best, ✓ Good, ?! Inaccuracy, ? Mistake, ?? Blunder (including "missed a checkmate"), and for weaker moves **Show better move** draws her move in red and a better one in green. The game-over screen has a Review game button.
- **Stickers**: 40 stickers to collect with stars.
- **Pip the pawn** reads every instruction aloud in a natural recorded voice (tap Pip to hear it again), so she does not need to read fluently.
- **Grown-ups** (press and hold the link at the bottom of the home screen, then answer a times-table question such as 7 × 8): name, sound, read-aloud, move dots, open all puzzle types, hint wait time, a progress summary, and a backup code to move progress between devices.

Wrong moves get a short explanation, such as "That piece is protected", "Check, but the king can escape" or "Stalemate! That's a draw", rather than just a buzzer.

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

### Read-aloud voice

Every sentence the app says is pre-recorded with [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), a free neural text-to-speech model that runs on the Mac, and stored as small AAC clips in `audio/voice/`. The app plays them through Web Audio and only uses the device's own voice for a sentence that has no clip.

After changing any text the app says, record the new sentences (needs macOS and `brew install uv`; the first run downloads the model):

```bash
npm run voice
```

`npm test` fails with the list of sentences that have no clip, so a forgotten recording shows up. Sentences with a player's name in them ("Hi …!", "Go, …!") are recorded for each name in `scripts/voice-names.json`; any other name is read with the device voice. If Kokoro says a word wrongly, give it the phonemes in `PRONOUNCE` in `scripts/make-voice.js` (as done for Éléonore).

| File | Purpose |
|---|---|
| `js/engine.js` | Chess rules: legal moves, check, mate, castling, en passant, promotion |
| `js/ai.js` | Robot opponents (alpha-beta search) and Pawn Battle rules |
| `js/puzzles.js` | Puzzle generators and goal checks |
| `js/lessons.js`, `js/stage.js` | Lesson content and stage logic |
| `js/board.js` | Touch board: tap or drag, move dots, arrows, animations |
| `js/pieces.js` | Hand-drawn SVG pieces |
| `js/app.js` | Screens, progress, rewards, sound, read-aloud |
| `js/voice.js`, `js/voice-clips.js` | Read-aloud sentence splitting, and the generated table of recorded clips |
| `scripts/make-voice.js`, `scripts/voice-lines.js`, `scripts/voice-tts.py` | Find every spoken sentence and record it with Kokoro |
