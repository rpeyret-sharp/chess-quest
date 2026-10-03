// Run: node tests/voice.test.js
// Checks every sentence the app reads aloud has a recorded clip, and every clip file exists.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const V = require('../js/voice.js');
const { clips } = require('../js/voice-clips.js');
const { voiceLines } = require('../scripts/voice-lines.js');

const s = V.sentences('Brilliant! Go,&nbsp;Mia! <span class="sub">+2 ★</span> It’s a draw…');
assert.deepStrictEqual(s.map((x) => x.text), ['Brilliant!', 'Go, Mia!', "It's a draw…"]);
assert.strictEqual(s[2].key, "it's a draw…");

const missing = [...voiceLines()].filter(([key]) => !clips[key]).map(([, text]) => text);
assert.deepStrictEqual(missing, [], `Sentences without a voice clip (run npm run voice):\n  ${missing.join('\n  ')}`);
for (const id of Object.values(clips)) assert.ok(fs.existsSync(path.join(__dirname, '..', 'audio/voice', `${id}.m4a`)), `missing audio/voice/${id}.m4a`);
console.log(`voice: ${Object.keys(clips).length} clips cover every spoken sentence`);
