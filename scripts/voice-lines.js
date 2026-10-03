// Every sentence the app can read aloud, found by scanning the string literals in the source.
// Template literals are filled in from FILL; a sentence with any other ${…} in it is left out
// (it has no clip, so the app reads it with the device voice).
const fs = require('fs');
const path = require('path');
const V = require('../js/voice.js');
const A = require('../js/ai.js');
const P = require('../js/puzzles.js');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = ['js/app.js', 'js/lessons.js', 'js/puzzles.js', 'js/ai.js'];
const NAMES_FILE = path.join(ROOT, 'scripts/voice-names.json');
const UNKNOWN = 'QQUNKNOWNQQ';

function fills(names) {
  return {
    'bot.name': A.BOTS.map((b) => b.name),
    "theme.title.replace(/!$/, '')": P.THEMES.map((t) => t.title.replace(/!$/, '')),
    'themeLevel(puzzle.themeId)': ['2', '3', '4'],
    'S.name': names,
    'esc(S.name)': names,
    // Whole sentences that are recorded from their own literals.
    'p': [''], 'praise()': [''], 'why': [''], 'sides': [''], "DRAW_TEXT[r.reason] || ''": [''],
  };
}

const ESCAPES = { n: ' ', t: ' ', r: '' };

// String and template literals in a JS source: each is a list of text parts and {expr} parts.
function literals(src) {
  const out = [];
  let i = 0;
  const str = (q) => {
    let s = '';
    for (i++; i < src.length && src[i] !== q; i++) {
      if (src[i] === '\\') { i++; s += ESCAPES[src[i]] ?? src[i]; } else s += src[i];
    }
    i++;
    return s;
  };
  const template = () => {
    const parts = [];
    let s = '';
    for (i++; i < src.length && src[i] !== '`';) {
      if (src[i] === '\\') { s += ESCAPES[src[i + 1]] ?? src[i + 1]; i += 2; } else if (src[i] === '$' && src[i + 1] === '{') {
        parts.push(s); s = '';
        i += 2;
        const start = i;
        code('}');
        parts.push({ expr: src.slice(start, i).trim() });
        i++;
      } else s += src[i++];
    }
    i++;
    parts.push(s);
    return parts;
  };
  const regex = () => {
    let inClass = false;
    for (i++; i < src.length; i++) {
      const c = src[i];
      if (c === '\\') i++;
      else if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
    }
    i++;
    while (/[a-z]/i.test(src[i] || '')) i++;
  };
  function code(end) {
    let depth = 0, prev = '';
    while (i < src.length) {
      const c = src[i];
      if (c === end && depth === 0) return;
      if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) i = src.length; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
      if (c === "'" || c === '"') { out.push([str(c)]); prev = 'a'; continue; }
      if (c === '`') { out.push(template()); prev = 'a'; continue; }
      if (c === '/' && /^$|[(,=:[!&|?{};]/.test(prev)) { regex(); prev = 'a'; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  code(null);
  return out;
}

// All the strings a literal can become.
function expand(parts, fill) {
  let all = [''];
  for (const p of parts) {
    const options = typeof p === 'string' ? [p] : fill[p.expr] || [UNKNOWN];
    all = all.flatMap((a) => options.map((o) => a + o));
  }
  return all;
}

const readNames = () => { try { return JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8')); } catch (e) { return []; } };

// Map of key -> sentence text.
function voiceLines(names = readNames()) {
  const fill = fills(names);
  const lines = new Map();
  for (const file of SOURCES) {
    for (const parts of literals(fs.readFileSync(path.join(ROOT, file), 'utf8'))) {
      for (const text of expand(parts, fill)) {
        for (const s of V.sentences(text)) {
          if (s.text.includes(UNKNOWN) || !/^["'\p{Lu}\p{N}]/u.test(s.text) || !/[.!?…]$/.test(s.text)) continue;
          if (!lines.has(s.key)) lines.set(s.key, s.text);
        }
      }
    }
  }
  return lines;
}

module.exports = { voiceLines, literals, readNames };

if (require.main === module) for (const text of voiceLines().values()) console.log(text);
