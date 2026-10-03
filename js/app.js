/* Chess Quest app: screens, progress, rewards, sound and read-aloud. */
(function () {
  'use strict';
  const C = window.Chess, A = window.ChessAI, P = window.Puzzles, St = window.Stage;
  const LESSONS = window.Lessons.LESSONS;
  const app = document.getElementById('app');
  const $ = (sel, el) => (el || document).querySelector(sel);
  const img = (code, cls) => `<img class="${cls || ''}" src="${window.Pieces.uri(code)}" alt="">`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------------------------------------------------------------- progress
  const KEY = 'chess-quest-v1';
  const DEFAULTS = () => ({
    name: '', stars: 0, welcomed: false, puzzlesSolved: 0,
    lessons: {}, themes: {}, games: {},
    daily: { date: '', list: [], done: 0 },
    streak: { count: 0, last: '' },
    play: { bot: 'chick', variant: 'chess', side: 'r' },
    history: [],
    settings: { sound: true, voice: true, overSilent: true, dots: true, unlockAll: false, hintWait: 20 },
  });
  function hydrate(d) {
    const s = Object.assign(DEFAULTS(), d);
    for (const k of ['daily', 'streak', 'play', 'settings']) s[k] = Object.assign(DEFAULTS()[k], d[k] || {});
    // 'color' was the old fixed White/Black pick; 'side' replaced it so everyone starts on Random.
    delete s.play.color;
    return s;
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return hydrate(JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
    return DEFAULTS();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }

  const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => dayStr(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); };
  const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ---------------------------------------------------------------- stickers
  const STICKERS = ['🐶', '🐱', '🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🦄', '🐙', '🦋', '🐢', '🦉', '🐧', '🐬', '🦖', '🐝', '🐞', '🦒',
    '🐘', '🦓', '🐰', '🐹', '🦔', '🐳', '🦜', '🦩', '🦦', '🐲', '🌈', '🚀', '🍦', '🎈', '🧁', '🌻', '🍉', '🏰', '👑', '🏆'];
  const stickerCost = (i) => 5 + i * 10;
  const stickerCount = () => STICKERS.filter((_, i) => S.stars >= stickerCost(i)).length;

  function addStars(n) {
    if (n <= 0) return;
    const before = stickerCount();
    S.stars += n;
    save();
    document.querySelectorAll('.star-count').forEach((el) => { el.textContent = S.stars; });
    const after = stickerCount();
    if (after > before) setTimeout(() => { toast(`<span class="emo">${STICKERS[after - 1]}</span> You got a new sticker!`); say('You got a new sticker!'); }, 1400);
  }

  // ---------------------------------------------------------------- sound
  const Sound = {
    ctx: null,
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) try { this.ctx = new AC(); } catch (e) { /* no audio */ }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    note(freq, start, dur, type, vol) {
      const c = this.ctx;
      if (!c || !S.settings.sound) return;
      const t = c.currentTime + start;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    move() { this.note(520, 0, 0.07, 'triangle', 0.3); this.note(260, 0.01, 0.06, 'sine', 0.2); },
    capture() { this.note(330, 0, 0.08, 'square', 0.1); this.note(165, 0.03, 0.16, 'triangle', 0.35); },
    star() { this.note(1046, 0, 0.12, 'sine', 0.2); this.note(1568, 0.07, 0.2, 'sine', 0.16); },
    check() { this.note(880, 0, 0.09, 'square', 0.07); this.note(880, 0.13, 0.09, 'square', 0.07); },
    good() { [523, 659, 784, 1046].forEach((f, i) => this.note(f, i * 0.085, 0.28, 'triangle', 0.22)); },
    bad() { this.note(262, 0, 0.15, 'sawtooth', 0.06); this.note(196, 0.13, 0.22, 'sawtooth', 0.06); },
    win() { [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.note(f, i * 0.12, 0.32, 'triangle', 0.24)); },
    forMove(m, next) {
      if (C.inCheck(next)) this.check();
      else if (m.captured) this.capture();
      else this.move();
    },
  };
  // iPadOS only lets sound start on a finger lift (touchend, click), not on the press, so listen for all of them.
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => Sound.unlock(), { capture: true });
  // 'playback' plays like a media app, so the read-aloud voice is heard even with the iPad on silent;
  // 'auto' lets the silent switch mute the app. Grown-ups chooses.
  const setAudioSession = () => { try { if (navigator.audioSession) navigator.audioSession.type = S.settings.overSilent ? 'playback' : 'auto'; } catch (e) { /* not supported */ } };
  setAudioSession();

  // ---------------------------------------------------------------- voice
  // Sentences are pre-recorded with a natural voice (scripts/make-voice.js) and played through Web Audio.
  // A sentence without a clip, such as one with a name not in scripts/voice-names.json, falls back to the device's own voice.
  const V = window.Voice, CLIPS = (window.VoiceClips || {}).clips || {};
  const buffers = new Map();
  function clip(id) {
    if (!buffers.has(id)) {
      const url = id.startsWith('data:') ? id : `audio/voice/${id}.m4a`;
      buffers.set(id, fetch(url).then((r) => r.arrayBuffer())
        .then((b) => new Promise((ok, fail) => Sound.ctx.decodeAudioData(b, ok, fail)))
        .catch(() => { buffers.delete(id); return null; }));
    }
    return buffers.get(id);
  }
  let talking = 0, source = null;
  function playClip(buf, turn) {
    return new Promise((done) => {
      if (turn !== talking) return done();
      source = Sound.ctx.createBufferSource();
      source.buffer = buf;
      source.connect(Sound.ctx.destination);
      source.onended = () => { source = null; done(); };
      source.start();
    });
  }

  // Device voice: prefer a downloaded Premium or Enhanced voice, never a novelty one.
  const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley/i;
  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const lang = (navigator.language || 'en-US').toLowerCase();
    const score = (v) => (/premium/i.test(v.voiceURI + v.name) ? 8 : /enhanced|neural|natural/i.test(v.voiceURI + v.name) ? 4 : 0) +
      (v.lang.toLowerCase().replace('_', '-') === lang ? 2 : 0) + (/samantha|ava|zoe|google us/i.test(v.name) ? 1 : 0);
    const all = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('en') && !NOVELTY.test(v.name));
    return all.sort((a, b) => score(b) - score(a))[0] || null;
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
  // iPadOS only lets speech start from a tap; one silent utterance on the first tap unlocks it for later.
  const primeSpeech = () => {
    document.removeEventListener('click', primeSpeech, true);
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* no speech */ }
  };
  if ('speechSynthesis' in window) document.addEventListener('click', primeSpeech, true);
  function speakDevice(text, turn) {
    return new Promise((done) => {
      if (turn !== talking || !('speechSynthesis' in window)) return done();
      try {
        const u = new SpeechSynthesisUtterance(text);
        voice = voice || pickVoice();
        if (voice) { u.voice = voice; u.lang = voice.lang; }
        u.rate = 0.95;
        u.onend = u.onerror = () => done();
        speechSynthesis.speak(u);
      } catch (e) { done(); }
    });
  }

  // Until a tap has unlocked Web Audio, clips would play silently, so the device voice reads instead.
  async function audioRunning() {
    const c = Sound.ctx;
    if (!c) return false;
    if (c.state !== 'running') await Promise.race([c.resume().catch(() => {}), new Promise((ok) => setTimeout(ok, 300))]);
    return c.state === 'running';
  }

  function say(text) {
    hush();
    if (!S.settings.voice || !text) return;
    const parts = V.sentences(text);
    const turn = talking;
    Sound.unlock();
    (async () => {
      const ready = await audioRunning();
      if (turn !== talking) return;
      const bufs = parts.map((p) => (ready && CLIPS[p.key] ? clip(CLIPS[p.key]) : Promise.resolve(null)));
      for (let i = 0; i < parts.length; i++) {
        const buf = await bufs[i];
        if (turn !== talking) return;
        if (buf) await playClip(buf, turn);
        else {
          if (ready && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) console.warn('No voice clip (run npm run voice):', parts[i].text);
          await speakDevice(parts[i].text, turn);
        }
      }
    })();
  }
  function hush() {
    talking++;
    if (source) { try { source.stop(); } catch (e) { /* already stopped */ } source = null; }
    try { speechSynthesis.cancel(); } catch (e) { /* none */ }
  }

  // ---------------------------------------------------------------- shared UI
  // Pip the pawn (img/pip*.webp): head and collar for the speech bubble, the whole pawn for big moments.
  const PIP = '<img class="pip" src="img/pip-head.webp" alt="" draggable="false">';
  const PIP_FULL = '<img class="pip full" src="img/pip.webp" alt="" draggable="false">';
  // Her own princess portrait (img/me-*.webp): face for small spots, smile for home, happy for wins.
  const ME_SRC = { face: 'img/me-face.webp', smile: 'img/me-smile.webp', happy: 'img/me-happy.webp' };
  const ME = (kind) => `<img class="me" src="${ME_SRC[kind]}" alt="" draggable="false">`;
  const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8" fill="none" stroke="#22314A" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STAR = '★';
  const HOW = {
    P: 'Pawns move straight forward, and capture diagonally.',
    N: 'Knights jump in an L shape.',
    B: 'Bishops move diagonally.',
    R: 'Rooks move in straight lines.',
    Q: 'The queen moves in straight lines and diagonals.',
    K: 'The king moves one square at a time.',
  };
  const PRAISE = ['Brilliant!', 'Amazing!', 'Super move!', 'You got it!', 'Fantastic!', 'Well done!', 'Great job!', 'Wow, clever!'];
  const praise = () => { const p = rand(PRAISE); return S.name && Math.random() < 0.4 ? `${p} Go, ${esc(S.name)}!` : p; };

  let cleanup = null;
  function show(html, back) {
    if (cleanup) { cleanup(); cleanup = null; }
    hush();
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    app.innerHTML = `<div class="screen">${html}</div>`;
    window.scrollTo(0, 0);
    const el = app.firstElementChild;
    const b = $('[data-act="back"]', el);
    if (b && back) b.addEventListener('click', back);
    return el;
  }

  function topbar(title, right) {
    return `<header class="topbar"><button class="round" type="button" data-act="back" aria-label="Back">${BACK}</button>` +
      `<h2>${title}</h2>${right || ''}<span class="pill" aria-label="Stars"><span class="s">${STAR}</span><span class="star-count">${S.stars}</span></span></header>`;
  }

  function talkHTML() {
    return `<div class="bubble-wrap"><button class="pip" type="button" data-act="hear" aria-label="Say it again">${PIP}</button><div class="bubble"><p class="msg"></p></div></div>`;
  }
  function makeTalk(el) {
    const bubble = $('.bubble', el), msg = $('.msg', el);
    let last = '';
    $('[data-act="hear"]', el).addEventListener('click', () => say(last));
    return (text, mood, speak) => {
      last = text;
      msg.innerHTML = text;
      bubble.className = 'bubble ' + (mood || '');
      if (speak !== false) say(text);
    };
  }

  function stageHTML(title, right) {
    return `${topbar(title, right)}<main class="stage">` +
      `<section class="talk">${talkHTML()}<div class="counter" id="counter"></div><div class="lvl" id="lvl"></div><p class="pid" id="pid"></p></section>` +
      `<section class="board-wrap"><div class="board-frame"><div id="board"></div></div></section>` +
      `<section class="actions" id="actions"></section></main>`;
  }

  // Small reference shown under each exercise so a grown-up can report a problem puzzle.
  function setPid(el, text) { $('#pid', el).textContent = text; }

  function overlay(html, onAct) {
    const el = document.createElement('div');
    el.className = 'overlay';
    el.innerHTML = `<div class="panel">${html}</div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) onAct(b.dataset.act, el);
    });
    return el;
  }

  function toast(html, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
  }

  function confetti(amount) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cv = document.getElementById('confetti');
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'confetti'; document.body.appendChild(cv); }
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#FFC93C', '#F2605C', '#44A865', '#2F8FCE', '#8E6BBF'];
    const parts = Array.from({ length: amount || 120 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.4, y: H * 0.4,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5,
      s: 7 + Math.random() * 8, c: rand(colors), r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    }));
    const t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.42; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      if (now - t0 < 2400) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }

  const starsRow = (n, max) => Array.from({ length: max || 3 }, (_, i) => (i < n ? STAR : `<span class="off">${STAR}</span>`)).join('');
  const checkSq = (pos) => (C.inCheck(pos) ? C.findKing(pos.board, pos.turn) : -1);

  // ---------------------------------------------------------------- progress helpers
  const lessonRec = (id) => S.lessons[id] || {};
  const lessonDone = (l) => l.stages.every((_, i) => (lessonRec(l.id)[i] || 0) > 0);
  const lessonStars = (l) => l.stages.reduce((a, _, i) => a + (lessonRec(l.id)[i] || 0), 0);
  const themeRec = (id) => (S.themes[id] = S.themes[id] || { solved: 0, next: 0 });
  const UNLOCK_AFTER = 3;
  const themeUnlocked = (i) => S.settings.unlockAll || i === 0 || themeRec(P.THEMES[i - 1].id).solved >= UNLOCK_AFTER;
  // Solved puzzles needed to reach each level of a puzzle type (level 1 is free).
  const LEVEL_AT = [0, 5, 15, 30];
  const TOP_LEVEL = LEVEL_AT.length;
  const themeLevel = (id) => { const n = themeRec(id).solved; let l = 1; while (l < TOP_LEVEL && n >= LEVEL_AT[l]) l++; return l; };
  function levelProgress(id) {
    const n = themeRec(id).solved, level = themeLevel(id);
    if (level === TOP_LEVEL) return { level, top: true, done: n };
    const from = LEVEL_AT[level - 1], to = LEVEL_AT[level];
    return { level, top: false, done: n - from, need: to - from };
  }
  function levelBar(id) {
    const p = levelProgress(id);
    const pct = p.top ? 100 : Math.round((p.done / p.need) * 100);
    const text = p.top ? `Top level! ${p.done} solved` : `${p.done} of ${p.need} to level ${p.level + 1}`;
    return `<span class="lvl-row"><span class="lvl-tag">Level ${p.level}</span><span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></span></span><small class="lvl-text">${text}</small>`;
  }
  const themeSeed = (id, n) => (P.THEMES.findIndex((t) => t.id === id) + 1) * 100000 + n;

  function ensureDaily() {
    const d = today();
    if (S.daily.date === d && S.daily.list.length) return;
    const open = P.THEMES.filter((_, i) => themeUnlocked(i));
    const rnd = P.mulberry32(hash(d));
    const newest = open.slice(-2);
    const list = [];
    for (let i = 0; i < 5; i++) {
      const t = i < 2 ? newest[Math.floor(rnd() * newest.length)] : open[Math.floor(rnd() * open.length)];
      list.push({ theme: t.id, level: themeLevel(t.id), seed: (hash(d) % 90000) * 10 + i });
    }
    S.daily = { date: d, list, done: 0 };
    save();
  }

  // ================================================================ HOME
  function screenHome() {
    ensureDaily();
    const dailyDone = S.daily.done >= 5;
    const streak = S.streak.last === today() || S.streak.last === yesterday() ? S.streak.count : 0;
    const name = S.name ? `Hi ${esc(S.name)}!` : 'Hi there!';
    const lessonsDone = LESSONS.filter(lessonDone).length;
    const openThemes = P.THEMES.filter((_, i) => themeUnlocked(i)).length;
    const el = show(`
      <header class="home-top">
        <div class="hello">${ME('smile')}<div><h1>${name}</h1><p>Let’s play chess!</p></div></div>
        <div class="pills">
          <span class="pill" title="Stars"><span class="s">${STAR}</span><span class="star-count">${S.stars}</span></span>
          <span class="pill" title="Days in a row">🔥 ${streak}</span>
        </div>
      </header>
      <button class="daily ${dailyDone ? 'done' : ''}" type="button" data-act="daily">
        <span class="big">${dailyDone ? '🏅' : '🎯'}</span>
        <span><h3>${dailyDone ? 'Challenge complete!' : 'Today’s Challenge'}</h3><p>${dailyDone ? 'Come back tomorrow for a new one.' : '5 puzzles. Finish them all for a bonus!'}</p></span>
        <span class="dots">${S.daily.list.map((_, i) => `<i class="${i < S.daily.done ? 'on' : ''}"></i>`).join('')}</span>
      </button>
      <div class="tiles">
        <button class="tile learn" type="button" data-act="learn"><span class="art">${img('wR')}${img('wN')}</span><b>Learn</b><small>${lessonsDone} of ${LESSONS.length} lessons done</small></button>
        <button class="tile puzzles" type="button" data-act="puzzles"><span class="art">${img('wQ')}${img('bK')}</span><b>Puzzles</b><small>${openThemes} of ${P.THEMES.length} puzzle types open</small></button>
        <button class="tile play" type="button" data-act="play"><span class="art"><span class="emo">${A.BOTS.find((b) => b.id === S.play.bot).emoji}</span>${img('bP')}</span><b>Play</b><small>Play a game against a robot</small></button>
        <button class="tile stickers" type="button" data-act="stickers"><span class="art"><span class="emo">${stickerCount() ? STICKERS[stickerCount() - 1] : '📒'}</span></span><b>Stickers</b><small>${stickerCount()} of ${STICKERS.length} collected</small></button>
      </div>
      <button class="grownups-btn" type="button" data-act="grownups"><span class="fill"></span>Grown-ups: press and hold</button>
    `);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'daily') { if (S.daily.done < 5) screenDaily(); else say('You finished today’s challenge. Come back tomorrow!'); }
      else if (act === 'learn') screenLearn();
      else if (act === 'puzzles') screenPuzzles();
      else if (act === 'play') screenPlaySetup();
      else if (act === 'stickers') screenStickers();
    });
    holdButton($('[data-act="grownups"]', el), () => grownupGate(screenGrownups));
    if (!S.welcomed) welcome();
  }

  // Grown-ups check: a times-table sum a 6-year-old is unlikely to know, typed on a keypad.
  function grownupGate(onPass) {
    let a, b, typed = '';
    const o = overlay(`<h2>Grown-ups only</h2><p id="gq"></p>
      <div class="gate-display" id="ga" aria-live="polite"></div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-act="k${n}">${n}</button>`).join('')}
        <button type="button" data-act="del" aria-label="Delete">⌫</button><button type="button" data-act="k0">0</button><button type="button" data-act="ok" class="ok">OK</button></div>
      <p class="gate-msg" id="gm"></p>
      <div class="row"><button class="btn ghost small" type="button" data-act="cancel">Cancel</button></div>`, (act) => {
      if (act === 'cancel') { o.remove(); return; }
      if (act !== 'ok') $('#gm', o).textContent = '';
      if (act === 'del') typed = typed.slice(0, -1);
      else if (act[0] === 'k' && typed.length < 3) typed += act.slice(1);
      else if (act === 'ok') {
        if (+typed === a * b) { o.remove(); onPass(); return; }
        $('#gm', o).textContent = 'Not quite. Here is another one.';
        ask();
        return;
      }
      $('#ga', o).textContent = typed;
    });
    function ask() {
      a = 6 + Math.floor(Math.random() * 4);
      b = 7 + Math.floor(Math.random() * 3);
      typed = '';
      $('#gq', o).textContent = `What is ${a} × ${b}?`;
      $('#ga', o).textContent = '';
    }
    ask();
  }

  function holdButton(btn, fn) {
    let t = null;
    const stop = () => { clearTimeout(t); btn.classList.remove('holding'); };
    btn.addEventListener('pointerdown', () => { btn.classList.add('holding'); t = setTimeout(() => { stop(); fn(); }, 1400); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
  }

  function welcome() {
    const o = overlay(`${PIP_FULL}<h2>Hi! I’m Pip.</h2><p>I’ll help you learn chess. What’s your name?</p>
      <input class="name-input" id="name" type="text" maxlength="20" autocomplete="off" placeholder="Your name">
      <div class="row"><button class="btn green" type="button" data-act="go">Let’s go!</button></div>`, (act) => {
      if (act !== 'go') return;
      S.name = $('#name', o).value.trim();
      S.welcomed = true;
      save();
      o.remove();
      Sound.good();
      screenHome();
      say(S.name ? `Hi ${S.name}! Let’s play chess!` : 'Let’s play chess!');
    });
  }

  // ================================================================ LEARN
  function screenLearn() {
    const next = LESSONS.findIndex((l) => !lessonDone(l));
    const el = show(`${topbar('Learn')}
      <p class="lead">Learn how every piece moves, then how to win!</p>
      <div class="grid">${LESSONS.map((l, i) => `
        <button class="card ${lessonDone(l) ? 'done' : ''} ${i === next ? 'next' : ''}" type="button" data-id="${l.id}">
          <span class="num">${i + 1}</span>${img(l.piece, 'pc')}<h3>${l.title}</h3>
          <div class="meta"><span class="stars-row">${STAR}</span>${lessonStars(l)} / ${l.stages.length * 3}</div>
        </button>`).join('')}</div>`, screenHome);
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) screenLesson(b.dataset.id, 0); });
  }

  function screenLesson(id, idx) {
    const lesson = LESSONS.find((l) => l.id === id);
    const stage = St.buildStage(lesson.stages[idx]);
    const rec = lessonRec(id);
    const dots = `<span class="stage-dots">${lesson.stages.map((_, i) => `<i class="${i === idx ? 'cur' : rec[i] ? 'on' : ''}"></i>`).join('')}</span>`;
    const el = show(stageHTML(lesson.title, dots), screenLearn);
    const talk = makeTalk(el);
    const counter = $('#counter', el), actions = $('#actions', el);
    const intro = idx === 0 ? lesson.intro + ' ' : '';
    setPid(el, stage.puzzle ? `Puzzle ID: ${stage.puzzle.id} (lesson ${id} ${idx + 1})` : `Lesson ID: ${id}-${idx + 1}`);
    talk(intro + (stage.say || ''));

    const finish = (stars) => {
      board.locked = true;
      const r = S.lessons[id] = S.lessons[id] || {};
      const prev = r[idx] || 0;
      if (stars > prev) { addStars(stars - prev); r[idx] = stars; save(); }
      const last = idx === lesson.stages.length - 1;
      if (last) {
        Sound.win();
        confetti(180);
        const o = overlay(`${ME('happy')}<h2>Lesson complete!</h2><div class="big-stars">${starsRow(stars)}</div><p>You finished “${lesson.title}”.</p>
          <div class="row"><button class="btn ghost" type="button" data-act="again">Play again</button><button class="btn green" type="button" data-act="more">More lessons</button></div>`, (act) => {
          o.remove();
          if (act === 'again') screenLesson(id, 0); else screenLearn();
        });
        say(`Lesson complete! ${praise()}`);
        return;
      }
      Sound.good();
      confetti(70);
      talk(`${praise()} <span class="sub stars-row">${starsRow(stars)}</span>`, 'good');
      actions.innerHTML = `<button class="btn green" type="button" data-act="next">Next <span class="ico">▶</span></button><button class="btn ghost small" type="button" data-act="retry">↺ Try again</button>`;
    };

    let board, runner = null;
    actions.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'next') screenLesson(id, idx + 1);
      else if (b.dataset.act === 'retry') screenLesson(id, idx);
    });

    if (stage.kind === 'stars' || stage.kind === 'capture') {
      let pos = stage.pos, moves = 0;
      const remaining = stage.stars.slice();
      const updateCounter = () => { counter.innerHTML = `<span>Moves: ${moves}</span><span>Best: ${stage.par}</span>`; };
      updateCounter();
      actions.innerHTML = `<button class="btn ghost" type="button" data-act="retry">↺ Start again</button>`;
      board = new window.Board($('#board', el), {
        autoQueen: true, showDots: S.settings.dots, movable: () => 'w',
        onMove(m) {
          const next = St.lessonMove(pos, m);
          moves++;
          const hit = remaining.indexOf(m.to);
          if (hit >= 0) { remaining.splice(hit, 1); Sound.star(); } else if (m.captured) Sound.capture(); else Sound.move();
          if (m.promo) talk('Your pawn became a queen!', 'good');
          pos = next;
          board.set(pos, { stars: remaining, last: [m.from, m.to] }, m);
          updateCounter();
          const done = stage.kind === 'stars' ? remaining.length === 0 : !St.blackLeft(pos);
          if (done) setTimeout(() => finish(moves <= stage.par ? 3 : moves <= stage.par + 2 ? 2 : 1), 350);
        },
        onIllegal(from) { board.shake(from); Sound.bad(); talk(HOW[pos.board[from][1]], 'oops'); },
      });
      board.set(pos, { stars: remaining });
    } else if (stage.kind === 'puzzle') {
      // Stars: 3, minus one per mistake and per hint, never below 1.
      let hintsUsed = 0;
      actions.innerHTML = `<button class="btn sun" type="button" data-act="hint"></button>`;
      runner = puzzleRunner($('#board', el), stage.puzzle, {
        talk,
        solved(mistakes) { lessonHints.stop(); finish(Math.max(1, 3 - mistakes - hintsUsed)); },
      });
      const lessonHints = hintButton($('[data-act="hint"]', actions), { onUse(n) { hintsUsed = n; runner.hint(n); } });
      board = runner.board;
      talk(intro + stage.say);
    } else {
      // castling stage
      let mistakes = 0;
      let pos = stage.pos;
      actions.innerHTML = `<button class="btn ghost" type="button" data-act="retry">↺ Start again</button>`;
      board = new window.Board($('#board', el), {
        showDots: S.settings.dots, movable: () => 'w',
        onMove(m) {
          if (m.flag === 'castle') {
            pos = C.makeMove(pos, m);
            Sound.move();
            board.set(pos, { last: [m.from, m.to] }, m);
            setTimeout(() => finish(mistakes ? 2 : 3), 400);
          } else {
            mistakes++;
            board.shake(m.from);
            Sound.bad();
            talk('That is not castling. Move your king two squares toward a rook.', 'oops');
          }
        },
        onIllegal(from, to) {
          board.shake(from);
          Sound.bad();
          const p = pos.board[from];
          if (p && p[1] === 'K' && (Math.abs(to - from) === 2 || pos.board[to] === 'wR')) {
            mistakes++;
            talk('You cannot castle that way. The king may not pass over a square that is attacked!', 'oops');
          } else talk(HOW[p[1]], 'oops');
        },
      });
      board.set(pos, {});
    }
    cleanup = () => { if (runner) runner.destroy(); };
  }

  // ================================================================ PUZZLES
  const PUZZLE_STARS = 2;   // a puzzle solved without hints; each hint takes one away
  const MAX_HINTS = 2;      // 1: highlight the piece, 2: show the move

  // Hint button with a wait before each hint. The wait (Grown-ups setting) stops hint-tapping.
  function hintButton(btn, opts) {
    let used = opts.used || 0, readyAt = 0;
    const max = opts.max == null ? MAX_HINTS : opts.max;
    const cost = opts.cost !== false;
    const tick = () => {
      if (!btn.isConnected) { clearInterval(iv); return; }
      const left = Math.ceil((readyAt - Date.now()) / 1000);
      if (used >= max) { btn.disabled = true; btn.innerHTML = '<span class="ico">💡</span> No hints left'; }
      else if (left > 0) { btn.disabled = true; btn.innerHTML = `<span class="ico">⏳</span> Hint in ${left}s`; }
      else { btn.disabled = false; btn.innerHTML = `<span class="ico">💡</span> Hint${cost ? ' <small class="cost">−1 ★</small>' : ''}`; }
    };
    const wait = () => { readyAt = Date.now() + (S.settings.hintWait || 0) * 1000; tick(); };
    const iv = setInterval(tick, 400);
    btn.addEventListener('click', () => {
      if (btn.disabled || used >= max) return;
      if (opts.onUse(used + 1) === false) return; // not a good moment (e.g. robot's turn): no charge
      used++;
      wait();
    });
    wait();
    return { get used() { return used; }, stop() { clearInterval(iv); } };
  }

  function puzzleRunner(boardEl, puzzle, hooks) {
    const goal = P.GOALS[puzzle.goal];
    const start = C.parseFEN(puzzle.fen);
    let pos = start, step = 0, mistakes = 0, done = false, timer = null;
    const board = new window.Board(boardEl, { showDots: S.settings.dots, movable: () => 'w', onMove, onIllegal });
    board.set(pos, { check: checkSq(pos) });
    hooks.talk(puzzle.prompt);

    const solutions = () => (step === 0 ? puzzle.solutions : C.legalMoves(pos).filter((m) => P.isMate(pos, m)));

    function onMove(m) {
      if (done) return;
      const ok = step === 0 ? goal.test(pos, m) : P.isMate(pos, m);
      if (!ok) {
        mistakes++;
        board.shake(m.from);
        Sound.bad();
        hooks.talk(step === 0 ? goal.wrong(pos, m) : 'That is not checkmate yet. Try again!', 'oops');
        return;
      }
      const next = C.makeMove(pos, m);
      Sound.forMove(m, next);
      board.set(next, { last: [m.from, m.to], check: checkSq(next), good: m.to }, m);
      pos = next;
      if (puzzle.goal === 'mate2' && step === 0 && !P.isMate(start, m)) {
        step = 1;
        board.locked = true;
        hooks.talk('Great first move! Now watch Black…', 'good', false);
        timer = setTimeout(() => {
          const r = P.defenceFor(pos);
          const after = C.makeMove(pos, r);
          Sound.forMove(r, after);
          board.set(after, { last: [r.from, r.to], check: checkSq(after) }, r);
          pos = after;
          board.locked = false;
          hooks.talk('Now finish it. Find checkmate!');
        }, 900);
        return;
      }
      done = true;
      board.locked = true;
      setTimeout(() => hooks.solved(mistakes), 250);
    }

    function onIllegal(from, to, why) {
      if (done) return;
      board.shake(from);
      Sound.bad();
      if (why === 'check') {
        mistakes++;
        hooks.talk(C.inCheck(pos) ? 'Your king is still in check! Try again.' : 'You cannot do that. Your king would be in check!', 'oops');
      } else hooks.talk(HOW[pos.board[from][1]], 'oops');
    }

    // n = 1: highlight the piece to move. n = 2: show the whole move.
    function hint(n) {
      const sols = solutions();
      if (!sols.length || done) return;
      if (n === 1) {
        board.setMarks({ hint: [...new Set(sols.map((m) => m.from))], arrows: [] });
        hooks.talk('Here is a clue: move this piece.');
      } else {
        board.setMarks({ hint: [], arrows: [[sols[0].from, sols[0].to]] });
        hooks.talk('Follow the blue arrow!');
      }
    }

    return { board, hint, destroy() { clearTimeout(timer); } };
  }

  // ---- puzzle history: every puzzle she has seen, so she can replay it
  const historyOf = (id) => (S.history || []).find((h) => h.id === id);
  // played=true when she opens the puzzle: it moves to the top, so the list stays last-played first.
  function logPuzzle(pz, patch, played) {
    S.history = S.history || [];
    let h = historyOf(pz.id);
    if (!h) {
      h = { id: pz.id, theme: pz.themeId, level: pz.level, seed: pz.seed, goal: pz.goal, fen: pz.fen, date: today(), solved: false, stars: 0, hints: 0 };
      S.history.unshift(h);
      if (S.history.length > 300) S.history.length = 300;
    } else if (played && S.history[0] !== h) {
      S.history.splice(S.history.indexOf(h), 1);
      S.history.unshift(h);
    }
    if (played) h.last = Date.now();
    Object.assign(h, patch || {});
    save();
    return h;
  }
  // Rebuild from the saved position, so a replay is exact even after puzzle generators change.
  function puzzleFromHistory(h) {
    const pos = C.parseFEN(h.fen);
    return { id: h.id, themeId: h.theme, level: h.level, seed: h.seed, goal: h.goal, fen: h.fen, prompt: P.GOALS[h.goal].prompt, solutions: P.solutionsFor(pos, h.goal) };
  }

  function screenPuzzles() {
    ensureDaily();
    const seen = (S.history || []).length;
    const el = show(`${topbar('Puzzles', seen ? `<button class="btn ghost small" type="button" data-act="history">📒 My puzzles</button>` : '')}
      <p class="lead">Solve ${UNLOCK_AFTER} puzzles of one kind to open the next kind. Each puzzle is worth ${PUZZLE_STARS} ${STAR}, and each hint costs 1.</p>
      <div class="grid">${mixCard()}${P.THEMES.map((t, i) => {
        const open = themeUnlocked(i);
        if (!open) return `<div class="card locked"><span class="lock">🔒</span><span class="emo">${t.icon}</span><h3>${t.title}</h3><p>Solve ${UNLOCK_AFTER} “${P.THEMES[i - 1].title}” puzzles to open.</p></div>`;
        return `<button class="card" type="button" data-id="${t.id}"><span class="emo">${t.icon}</span><h3>${t.title}</h3><p>${t.about}</p>
          <div class="meta lvl">${levelBar(t.id)}</div></button>`;
      }).join('')}</div>`, screenHome);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id],[data-act="history"],[data-act="mix"]');
      if (!b) return;
      if (b.dataset.act === 'history') screenHistory();
      else if (b.dataset.act === 'mix') screenMix();
      else screenTheme(b.dataset.id);
    });
  }

  const openThemes = () => P.THEMES.filter((_, i) => themeUnlocked(i));
  function mixCard() {
    const open = openThemes();
    if (open.length < 2) {
      return `<div class="card locked mix"><span class="lock">🔒</span><span class="emo">🎲</span><h3>Mix it up</h3><p>Open a second puzzle type to mix them.</p></div>`;
    }
    return `<button class="card mix" type="button" data-act="mix"><span class="emo">🎲</span><h3>Mix it up</h3>
      <p>A different kind of puzzle every time: ${open.map((t) => t.icon).join(' ')}</p></button>`;
  }

  // Mixed practice: a different open puzzle type each time (never the same twice in a row).
  // Each puzzle still counts toward its own type's level.
  function screenMix(lastTheme, streak) {
    const open = openThemes();
    const choices = open.length > 1 ? open.filter((t) => t.id !== lastTheme) : open;
    const t = choices[Math.floor(Math.random() * choices.length)];
    const rec = themeRec(t.id);
    screenPuzzle(P.makePuzzle(t.id, themeLevel(t.id), themeSeed(t.id, rec.next)), { kind: 'mix', streak: streak || 0 });
  }

  function screenTheme(themeId) {
    const rec = themeRec(themeId);
    const level = themeLevel(themeId);
    screenPuzzle(P.makePuzzle(themeId, level, themeSeed(themeId, rec.next)), { kind: 'theme' });
  }

  function screenDaily() {
    ensureDaily();
    const i = S.daily.done;
    if (i >= 5) return screenHome();
    const item = S.daily.list[i];
    screenPuzzle(P.makePuzzle(item.theme, item.level, item.seed), { kind: 'daily', item, index: i });
  }

  // One screen for practice, the daily challenge and replays.
  // carry.hints keeps hints already used when she starts the same puzzle over.
  function screenPuzzle(puzzle, mode, carry) {
    carry = carry || { hints: 0 };
    const theme = P.THEME[puzzle.themeId];
    const hist = logPuzzle(puzzle, null, true);
    const firstSolve = !hist.solved;
    const worth = () => (firstSolve ? Math.max(0, PUZZLE_STARS - carry.hints) : 0);
    const level = `<span class="chip">Level ${puzzle.level}</span>`;
    let title, right, back;
    if (mode.kind === 'daily') {
      title = 'Today’s Challenge';
      right = `<span class="stage-dots">${S.daily.list.map((_, j) => `<i class="${j < mode.index ? 'on' : j === mode.index ? 'cur' : ''}"></i>`).join('')}</span>`;
      back = screenHome;
    } else if (mode.kind === 'replay') {
      title = `${theme.icon} Replay`;
      right = level;
      back = screenHistory;
    } else if (mode.kind === 'mix') {
      title = '🎲 Mix it up';
      right = level;
      back = screenPuzzles;
    } else {
      title = `${theme.icon} ${theme.title}`;
      right = level;
      back = screenPuzzles;
    }
    const el = show(stageHTML(title, right), back);
    const talk = makeTalk(el);
    const counter = $('#counter', el), actions = $('#actions', el);
    const rec = themeRec(puzzle.themeId);
    let earned = null;
    const info = () => {
      const where = mode.kind === 'daily' ? `<span>Puzzle ${mode.index + 1} of 5</span><span>${theme.icon} ${theme.title}</span>`
        : mode.kind === 'mix' ? `<span>${theme.icon} ${theme.title}</span>${mode.streak ? `<span>🎲 ${mode.streak} in this mix</span>` : ''}`
        : mode.kind === 'replay' ? `<span>${hist.solved ? '✅ Solved before' : 'Not solved yet'}</span>` : `<span>✅ Solved: ${rec.solved}</span>`;
      const value = earned != null ? `<span>Earned: ${earned} ${STAR}</span>` : firstSolve ? `<span>Worth: ${worth()} ${STAR}</span>` : '<span>Practice: no stars</span>';
      counter.innerHTML = where + value;
      if (mode.kind !== 'replay') $('#lvl', el).innerHTML = levelBar(puzzle.themeId);
    };
    info();
    setPid(el, `Puzzle ID: ${puzzle.id}`);
    const skipLabel = mode.kind === 'daily' ? 'Different puzzle ➜' : 'New puzzle ➜';
    actions.innerHTML = `<button class="btn sun" type="button" data-act="hint"></button>
      <button class="btn ghost small" type="button" data-act="restart">↺ Start over</button>
      ${mode.kind === 'replay' ? '' : `<button class="btn ghost small" type="button" data-act="skip">${skipLabel}</button>`}`;

    let hints = null;
    const runner = puzzleRunner($('#board', el), puzzle, {
      talk,
      solved() {
        if (hints) hints.stop();
        const stars = worth();
        earned = firstSolve ? stars : null;
        logPuzzle(puzzle, { solved: true, stars: Math.max(hist.stars || 0, stars), hints: carry.hints, solvedOn: today() });
        if (firstSolve) S.puzzlesSolved++;
        let unlocked = null;
        const levelBefore = themeLevel(puzzle.themeId);
        if (mode.kind === 'theme' || mode.kind === 'mix') {
          const idx = P.THEMES.findIndex((t) => t.id === puzzle.themeId);
          const wasOpen = themeUnlocked(idx + 1);
          if (firstSolve) rec.solved++;
          if (themeSeed(puzzle.themeId, rec.next) === puzzle.seed) rec.next++;
          if (P.THEMES[idx + 1] && !wasOpen && themeUnlocked(idx + 1)) unlocked = P.THEMES[idx + 1];
        }
        if (mode.kind === 'daily') {
          S.daily.done++;
          if (firstSolve) rec.solved++;
        }
        if (mode.kind === 'mix') mode.streak++;
        const levelUp = themeLevel(puzzle.themeId) > levelBefore;
        save();
        addStars(stars);
        if (mode.kind === 'daily' && S.daily.done >= 5) return dailyComplete();
        Sound.good();
        confetti(70);
        const note = stars ? `+${stars} ${STAR}` : !firstSolve ? 'That was practice, so no stars.' : 'No stars this time because of the hints. Try the next one on your own!';
        talk(`${praise()} <span class="sub">${note}</span>`, 'good');
        info();
        actions.innerHTML = (mode.kind === 'replay'
          ? `<button class="btn green" type="button" data-act="list">My puzzles <span class="ico">▶</span></button>`
          : `<button class="btn green" type="button" data-act="next">Next puzzle <span class="ico">▶</span></button>`) +
          `<button class="btn ghost small" type="button" data-act="replay">↺ Play it again</button>`;
        if (levelUp) {
          setTimeout(() => { toast(`<span class="emo">${theme.icon}</span> Level up! ${theme.title} is now level ${themeLevel(puzzle.themeId)}`); say(`Level up! ${theme.title.replace(/!$/, '')} is now level ${themeLevel(puzzle.themeId)}!`); }, 900);
        }
        if (unlocked) setTimeout(() => toast(`<span class="emo">${unlocked.icon}</span> New puzzles: ${unlocked.title}!`), levelUp ? 4200 : 900);
      },
    });
    hints = hintButton($('[data-act="hint"]', actions), {
      used: carry.hints,
      cost: firstSolve,
      onUse(n) {
        carry.hints = n;
        logPuzzle(puzzle, { hints: Math.max(hist.hints || 0, n) });
        runner.hint(n);
        info();
      },
    });
    actions.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'restart') screenPuzzle(puzzle, mode, carry);
      else if (act === 'replay') screenPuzzle(puzzle, mode.kind === 'replay' ? mode : { kind: 'replay' }, { hints: 0 });
      else if (act === 'list') screenHistory();
      else if (act === 'next') {
        if (mode.kind === 'daily') screenDaily();
        else if (mode.kind === 'mix') screenMix(puzzle.themeId, mode.streak);
        else screenTheme(puzzle.themeId);
      } else if (act === 'skip') {
        if (mode.kind === 'daily') { mode.item.seed += 1000; save(); screenDaily(); }
        else if (mode.kind === 'mix') { if (themeSeed(puzzle.themeId, rec.next) === puzzle.seed) rec.next++; save(); screenMix(puzzle.themeId, mode.streak); }
        else { if (themeSeed(puzzle.themeId, rec.next) === puzzle.seed) rec.next++; save(); screenTheme(puzzle.themeId); }
      }
    });
    cleanup = () => { runner.destroy(); hints.stop(); };
  }

  function dailyComplete() {
    if (S.streak.last !== today()) {
      S.streak.count = S.streak.last === yesterday() ? S.streak.count + 1 : 1;
      S.streak.last = today();
    }
    save();
    addStars(5);
    Sound.win();
    confetti(200);
    const o = overlay(`${ME('happy')}<h2>Challenge complete!</h2><div class="big-stars">${STAR}${STAR}${STAR}${STAR}${STAR}</div>
      <p>Bonus: +5 stars! 🔥 ${S.streak.count} day${S.streak.count === 1 ? '' : 's'} in a row.</p>
      <div class="row"><button class="btn green" type="button" data-act="home">Yay!</button></div>`, () => { o.remove(); screenHome(); });
    say(`Challenge complete! You get 5 bonus stars! ${praise()}`);
  }

  function miniBoard(fen) {
    const b = C.parseFEN(fen).board;
    let html = '';
    for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) {
      const p = b[r * 8 + f];
      html += `<i class="${(r + f) % 2 ? 'l' : 'd'}"${p ? ` style="background-image:url('${window.Pieces.uri(p)}')"` : ''}></i>`;
    }
    return `<span class="mini">${html}</span>`;
  }

  function screenHistory(filter, shown) {
    filter = filter || 'all';
    shown = shown || 24;
    const all = S.history || [];
    const list = all.filter((h) => (filter === 'all' ? true : filter === 'open' ? !h.solved : h.theme === filter));
    const themes = P.THEMES.filter((t) => all.some((h) => h.theme === t.id));
    // Entries saved before `last` existed only know the day they were first seen.
    const dayOf = (h) => (h.last ? dayStr(new Date(h.last)) : h.date);
    const dayLabel = (d) => {
      if (d === today()) return 'Today';
      if (d === yesterday()) return 'Yesterday';
      const dt = new Date(d + 'T12:00');
      const opts = Date.now() - dt < 6 * 864e5 ? { weekday: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' };
      try { return dt.toLocaleDateString(undefined, opts); } catch (e) { return d; }
    };
    const timeOf = (h) => { try { return h.last ? ' · ' + new Date(h.last).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''; } catch (e) { return ''; } };
    const card = (h) => {
      const t = P.THEME[h.theme];
      return `<button class="hcard" type="button" data-id="${esc(h.id)}">${miniBoard(h.fen)}
          <span class="hinfo"><b>${t ? t.icon + ' ' + t.title : h.theme}</b><small>Level ${h.level}${timeOf(h)}</small>
          <span class="hstat">${h.solved ? `✅ <span class="stars-row">${starsRow(h.stars, PUZZLE_STARS)}</span>` : '🔁 Not solved'}</span>
          <small class="pid">${esc(h.id)}</small></span></button>`;
    };
    const groups = [];
    for (const h of list.slice(0, shown)) {
      const d = dayOf(h);
      if (!groups.length || groups[groups.length - 1].day !== d) groups.push({ day: d, items: [] });
      groups[groups.length - 1].items.push(h);
    }
    const el = show(`${topbar('My puzzles')}
      <p class="lead">Every puzzle you have seen, the one you played last at the top. Tap one to play it again. Replays are for practice and do not earn stars, unless you never solved it.</p>
      <div class="options">
        <div class="toggle" role="group" aria-label="Show">
          <button type="button" data-f="all" class="${filter === 'all' ? 'on' : ''}">All</button>
          <button type="button" data-f="open" class="${filter === 'open' ? 'on' : ''}">Not solved</button>
        </div>
        <div class="toggle" role="group" aria-label="Puzzle type">${themes.map((t) => `<button type="button" data-f="${t.id}" class="${filter === t.id ? 'on' : ''}" title="${t.title}">${t.icon}</button>`).join('')}</div>
      </div>
      ${list.length ? '' : '<p class="lead">No puzzles here yet.</p>'}
      ${groups.map((g) => `<h3 class="hday">${dayLabel(g.day)}</h3><div class="history">${g.items.map(card).join('')}</div>`).join('')}
      ${list.length > shown ? '<div><button class="btn ghost small" type="button" data-act="more">Show more</button></div>' : ''}`, screenPuzzles);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.f) screenHistory(b.dataset.f);
      else if (b.dataset.act === 'more') screenHistory(filter, shown + 24);
      else if (b.dataset.id) {
        const h = historyOf(b.dataset.id);
        if (h) screenPuzzle(puzzleFromHistory(h), { kind: 'replay' });
      }
    });
  }

  // ================================================================ PLAY
  function screenPlaySetup() {
    const p = S.play;
    // Leaving a game saves it in its cleanup; run that first so the game is listed.
    if (cleanup) { cleanup(); cleanup = null; }
    const render = () => {
      const gamesBtn = (S.gameLog || []).length ? '<button class="btn ghost small" type="button" data-act="games">📜 My games</button>' : '';
      const el = show(`${topbar('Play', gamesBtn)}
        <h3 class="section-title">Pick a robot</h3>
        <div class="grid">${A.BOTS.map((b) => {
          const g = S.games[b.id] || { won: 0, played: 0 };
          return `<button class="card robot ${p.bot === b.id ? 'on' : ''}" type="button" data-bot="${b.id}"><span class="emo">${b.emoji}</span><h3>${b.name}</h3><p>${b.blurb}</p>
            <div class="meta">🏆 ${g.won} win${g.won === 1 ? '' : 's'} · ${STAR} ${b.stars} per win</div></button>`;
        }).join('')}</div>
        <h3 class="section-title">Game</h3>
        <div class="options">
          <div class="toggle" role="group" aria-label="Game type">
            <button type="button" data-variant="chess" class="${p.variant === 'chess' ? 'on' : ''}">${img('wK')} Chess</button>
            <button type="button" data-variant="pawns" class="${p.variant === 'pawns' ? 'on' : ''}">${img('wP')} Pawn Battle</button>
          </div>
          <div class="toggle" role="group" aria-label="Your colour">
            <button type="button" data-side="r" class="${p.side === 'r' ? 'on' : ''}">🎲 Random</button>
            <button type="button" data-side="w" class="${p.side === 'w' ? 'on' : ''}">${img('wN')} White</button>
            <button type="button" data-side="b" class="${p.side === 'b' ? 'on' : ''}">${img('bN')} Black</button>
          </div>
        </div>
        <p class="lead" style="margin:0">${p.variant === 'pawns' ? 'Pawn Battle: only pawns! Get one pawn to the other side, or capture all the robot’s pawns, to win. If a player cannot move, it is a draw.' : 'A real game of chess. Checkmate the robot’s king to win!'}</p>
        <div><button class="btn green" type="button" data-act="start">Start game <span class="ico">▶</span></button></div>`, screenHome);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.bot) { p.bot = b.dataset.bot; save(); render(); }
        else if (b.dataset.variant) { p.variant = b.dataset.variant; save(); render(); }
        else if (b.dataset.side) { p.side = b.dataset.side; save(); render(); }
        else if (b.dataset.act === 'start') screenGame();
        else if (b.dataset.act === 'games') screenGames();
      });
    };
    render();
  }

  const DRAW_TEXT = {
    stalemate: 'Stalemate! The king cannot move, but he is not in check. That is a draw.',
    material: 'There are not enough pieces left to checkmate. That is a draw.',
    fifty: '50 moves with no capture and no pawn move. That is a draw.',
    repetition: 'The same position happened three times. That is a draw.',
    blocked: 'No pawn can move, so it is a draw. Just like stalemate in chess!'
  };

  const colourName = (c) => (c === 'w' ? 'White' : 'Black');
  // A king in the player's colour with its name, so it is clear who plays which side.
  const sideChip = (c) => `<span class="side side-${c}">${img(c + 'K')}${colourName(c)}</span>`;

  function startPosition(variant) {
    if (variant !== 'pawns') return C.parseFEN(C.START_FEN);
    return Object.assign(C.parseFEN('8/pppppppp/8/8/8/8/PPPPPPPP/8 w - - 0 1'), { variant: 'pawns', noPromo: true });
  }

  function screenGame() {
    const cfg = S.play;
    const bot = A.BOTS.find((b) => b.id === cfg.bot);
    const you = cfg.side === 'w' || cfg.side === 'b' ? cfg.side : rand(['w', 'b']);
    const variant = cfg.variant;
    const pawns = variant === 'pawns';
    const start = startPosition(variant);
    const hist = [start], played = [];
    const gid = Date.now().toString(36);

    // Keep the game in "My games" (last 50) so she can review it.
    function saveGame(result, reason) {
      if (!played.length) return;
      S.gameLog = S.gameLog || [];
      let g = S.gameLog.find((x) => x.id === gid);
      if (!g) {
        g = { id: gid, date: today(), bot: bot.id, variant, color: you };
        S.gameLog.unshift(g);
        if (S.gameLog.length > 50) S.gameLog.length = 50;
      }
      const moves = played.map(C.toUCI);
      if (!g.moves || g.moves.join() !== moves.join()) g.analysis = null;
      Object.assign(g, { moves, result, reason: reason || '', hints: gameHints ? gameHints.used : 0 });
      save();
    }
    let over = null, timer = null, recorded = false;
    const cur = () => hist[hist.length - 1];
    const youName = S.name ? esc(S.name) : 'You';

    const el = show(`${topbar(`${pawns ? 'Pawn Battle' : 'Chess'} vs ${bot.name}`)}
      <main class="stage">
        <section class="talk">
          <div class="player" id="botcard"><span class="face">${bot.emoji}</span><span class="who"><b>${bot.name}</b><small class="state"></small></span>${sideChip(C.other(you))}</div>
          <div class="caps" id="botcaps"></div>
          ${talkHTML()}
        </section>
        <section class="board-wrap"><div class="board-frame"><div id="board"></div></div></section>
        <section class="actions">
          <div class="player" id="youcard"><span class="face">${ME('face')}</span><span class="who"><b>${youName}</b><small class="state"></small></span>${sideChip(you)}</div>
          <div class="caps" id="youcaps"></div>
          <button class="btn blue" type="button" data-act="undo"><span class="ico">↶</span> Oops! Undo</button>
          <button class="btn sun" type="button" data-act="hint"></button>
          <button class="btn ghost small" type="button" data-act="new">New game</button>
        </section>
      </main>`, screenPlaySetup);
    const talk = makeTalk(el);
    const botState = $('#botcard .state', el), botCard = $('#botcard', el);
    const youState = $('#youcard .state', el), youCard = $('#youcard', el);
    const youColour = colourName(you).toLowerCase();

    // Light up the card of whoever moves next, dim the other one.
    function showTurn(who) {
      botCard.classList.toggle('turn', who === 'bot');
      youCard.classList.toggle('turn', who === 'you');
      botCard.classList.toggle('thinking', who === 'bot');
      botState.textContent = who === 'bot' ? 'Thinking…' : who === 'you' ? 'Waiting for you' : 'Game over';
      youState.textContent = who === 'you' ? 'Your turn!' : who === 'bot' ? `Wait for ${bot.name}…` : 'Game over';
    }

    function capsHTML(pos, byColor) {
      const opp = C.other(byColor);
      const init = pawns ? { P: 8 } : { P: 8, N: 2, B: 2, R: 2, Q: 1 };
      const left = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
      let mat = { w: 0, b: 0 };
      for (const p of pos.board) if (p && p[1] !== 'K') { if (p[0] === opp) left[p[1]]++; mat[p[0]] += C.VALUES[p[1]]; }
      let html = '';
      for (const t of 'QRBNP') for (let i = Math.max(0, (init[t] || 0) - left[t]); i > 0; i--) html += img(opp + t);
      const adv = mat[byColor] - mat[opp];
      if (adv > 0) html += `<span class="adv">+${adv}</span>`;
      return html;
    }

    function refresh(animate) {
      const pos = cur();
      const last = played[played.length - 1];
      board.set(pos, { last: last ? [last.from, last.to] : null, check: pawns ? -1 : checkSq(pos) }, animate);
      $('#botcaps', el).innerHTML = capsHTML(pos, C.other(you));
      $('#youcaps', el).innerHTML = capsHTML(pos, you);
    }

    function apply(m) {
      const next = C.makeMove(cur(), m);
      hist.push(next);
      played.push(m);
      Sound.forMove(m, next);
      refresh(m);
    }

    function result() {
      const pos = cur();
      const r = A.variantResult(pos);
      if (r) return r;
      const key = C.posKey(pos);
      if (hist.filter((h) => C.posKey(h) === key).length >= 3) return { winner: null, reason: 'repetition' };
      return null;
    }

    function yourTurn() {
      board.locked = false;
      showTurn('you');
      if (!pawns && C.inCheck(cur())) talk('Check! Keep your king safe.', 'oops');
      else talk(`Your turn! Move a ${youColour} piece.`, '', false);
    }

    function botTurn() {
      board.locked = true;
      showTurn('bot');
      talk(`${bot.name} is thinking…`, '', false);
      timer = setTimeout(() => {
        timer = null;
        const m = A.botMove(cur(), bot, { history: hist.map(C.posKey) });
        if (!m) return;
        apply(m);
        if (!checkEnd()) yourTurn();
      }, 500 + Math.random() * 500);
    }

    function checkEnd() {
      const r = result();
      if (!r) return false;
      over = r;
      board.locked = true;
      showTurn(null);
      const key = bot.id + (pawns ? '-pawns' : '');
      if (!recorded) {
        recorded = true;
        const g = S.games[key] = S.games[key] || { won: 0, played: 0 };
        g.played++;
        if (r.winner === you) g.won++;
        save();
      }
      saveGame(r.winner === you ? 'win' : r.winner ? 'loss' : 'draw', r.reason);
      setTimeout(() => endOverlay(r), 700);
      return true;
    }

    function endOverlay(r) {
      let html, stars = 0;
      if (r.winner === you) {
        stars = Math.max(1, (pawns ? Math.max(1, bot.stars - 1) : bot.stars) - gameHints.used);
        const why = pawns ? 'Your pawns won the race!' : 'Checkmate! The king cannot escape.';
        const hintNote = gameHints.used ? `<p>${gameHints.used} hint${gameHints.used === 1 ? '' : 's'} used: −${gameHints.used} ${STAR}</p>` : '';
        html = `${ME('happy')}<h2>You won!</h2><p>${why}</p><div class="big-stars">+${stars} ${STAR}</div>${hintNote}`;
        Sound.win();
        confetti(220);
        say(`You won! ${why}`);
      } else if (r.winner) {
        const why = pawns ? 'The robot’s pawns won the race.' : 'Checkmate. The robot trapped your king.';
        html = `<div class="big-emo">${bot.emoji}</div><h2>${bot.name} won this time</h2><p>${why} Every game makes you stronger!</p>`;
        say(`${bot.name} won this time. Every game makes you stronger!`);
      } else {
        stars = 1;
        html = `<div class="big-emo">🤝</div><h2>It’s a draw!</h2><p>${DRAW_TEXT[r.reason] || ''}</p><div class="big-stars">+1 ${STAR}</div>`;
        say(`It's a draw! ${DRAW_TEXT[r.reason] || ''}`);
      }
      talk(r.winner === you ? 'You won!' : r.winner ? `${bot.name} won.` : 'It’s a draw!', r.winner === you ? 'good' : '', false);
      if (stars && !r.paid) { r.paid = true; addStars(stars); }
      const lost = r.winner && r.winner !== you;
      const o = overlay(`${html}<div class="row">${lost ? '<button class="btn blue" type="button" data-act="undo">↶ Take back</button>' : ''}
        <button class="btn green" type="button" data-act="again">Play again</button><button class="btn plum" type="button" data-act="review">🔍 Review game</button><button class="btn ghost" type="button" data-act="setup">Choose robot</button></div>`, (act) => {
        o.remove();
        if (act === 'again') screenGame();
        else if (act === 'review') screenReview(gid);
        else if (act === 'setup') screenPlaySetup();
        else if (act === 'undo') undo();
      });
    }

    function undo() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (hist.length <= 1) return;
      over = null;
      while (hist.length > 1) {
        hist.pop();
        played.pop();
        if (cur().turn === you) break;
      }
      refresh();
      Sound.move();
      if (cur().turn !== you) botTurn(); else { yourTurn(); talk('Okay! Try a different move.'); }
    }

    const board = new window.Board($('#board', el), {
      orientation: you, showDots: S.settings.dots, movable: () => (over ? null : you),
      onMove(m) {
        if (over || cur().turn !== you) return;
        apply(m);
        if (!checkEnd()) botTurn();
      },
      onIllegal(from, to, why) {
        board.shake(from);
        Sound.bad();
        if (why === 'check') talk(C.inCheck(cur()) ? 'Your king is in check! You must protect him.' : 'You cannot do that. Your king would be in check!', 'oops');
        else talk(HOW[cur().board[from][1]], 'oops');
      },
    });

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'undo') undo();
      else if (act === 'new') screenGame();
    });

    // Up to 3 hints a game, each taking one star off a win (a win always earns at least 1).
    const gameHints = hintButton($('[data-act="hint"]', el), {
      max: 3,
      onUse() {
        if (over || cur().turn !== you || board.locked) return false;
        const m = A.hintMove(cur(), hist.map(C.posKey));
        if (!m) return false;
        board.setMarks({ arrows: [[m.from, m.to]] });
        talk('How about this move?');
        return true;
      },
    });

    refresh();
    const sides = you === 'w' ? `You are White, so you go first.` : `You are Black. White goes first, so ${bot.name} starts.`;
    say(`${pawns ? 'Pawn Battle! Get one of your pawns to the other side to win.' : `Let's play! Good luck against ${bot.name}.`} ${sides}`);
    if (cur().turn === you) yourTurn(); else botTurn();
    cleanup = () => {
      if (timer) clearTimeout(timer);
      gameHints.stop();
      if (!over && played.length >= 2) saveGame('unfinished');
    };
  }

  // ================================================================ GAME REVIEW
  const RATING = {
    best: { name: 'Best', sym: '★', say: 'Best move! Just what a master would play.' },
    good: { name: 'Good', sym: '✓', say: 'Good move.' },
    inaccuracy: { name: 'Inaccuracy', sym: '?!', say: 'Inaccuracy: not the best move, but not too bad.' },
    mistake: { name: 'Mistake', sym: '?', say: 'Mistake: this move loses something. There was a better move.' },
    blunder: { name: 'Blunder', sym: '??', say: 'Blunder! A big mistake, like losing a piece for nothing.' },
  };
  const RESULT_TEXT = { win: 'Won', loss: 'Lost', draw: 'Draw', unfinished: 'Not finished' };

  function rebuildGame(g) {
    let pos = startPosition(g.variant);
    const positions = [pos], moves = [], sans = [];
    for (const u of g.moves) {
      const m = C.fromUCI(pos, u);
      if (!m) break;
      sans.push(C.toSAN(pos, m));
      moves.push(m);
      pos = C.makeMove(pos, m);
      positions.push(pos);
    }
    return { positions, moves, sans };
  }

  // Rate her moves a few at a time so the screen stays responsive. Saved, so it only runs once.
  function analyseGame(g, game, onStep, onDone) {
    let i = 0, cancelled = false;
    const out = new Array(game.moves.length).fill(null);
    function step() {
      if (cancelled) return;
      const t0 = Date.now();
      while (i < game.moves.length && Date.now() - t0 < 40) {
        const pos = game.positions[i];
        if (pos.turn === g.color) {
          const r = A.analyseMove(pos, game.moves[i], 2);
          out[i] = { l: r.label, b: r.best ? C.toUCI(r.best) : null, mm: r.missedMate ? 1 : 0 };
        }
        i++;
      }
      onStep(i / Math.max(1, game.moves.length));
      if (i < game.moves.length) setTimeout(step, 0);
      else { g.analysis = out; save(); onDone(); }
    }
    setTimeout(step, 30);
    return () => { cancelled = true; };
  }

  function ratingCounts(g) {
    const n = { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    for (const a of g.analysis || []) if (a) n[a.l]++;
    return n;
  }
  const ratingChips = (g, named) => {
    const n = ratingCounts(g);
    return Object.keys(RATING).map((k) => `<span class="r-chip r-${k}" title="${RATING[k].name}"><b>${RATING[k].sym}</b> ${named ? RATING[k].name + ' ' : ''}${n[k]}</span>`).join('');
  };

  function screenGames() {
    const list = S.gameLog || [];
    const fmt = (d) => { try { return new Date(d + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (e) { return d; } };
    const el = show(`${topbar('My games')}
      <p class="lead">Your last ${list.length} game${list.length === 1 ? '' : 's'}. Tap one to replay it and see which moves were best and which were blunders.</p>
      ${list.length ? '' : '<p class="lead">Play a game and it will appear here.</p>'}
      <div class="history">${list.map((g) => {
        const bot = A.BOTS.find((b) => b.id === g.bot) || A.BOTS[0];
        return `<button class="hcard gcard" type="button" data-id="${g.id}"><span class="g-emo">${bot.emoji}</span>
          <span class="hinfo"><b><span class="res res-${g.result}">${RESULT_TEXT[g.result] || ''}</span> vs ${bot.name}</b>
          <small>${g.variant === 'pawns' ? 'Pawn Battle' : 'Chess'} · ${g.color === 'w' ? 'White' : 'Black'} · ${Math.ceil(g.moves.length / 2)} moves · ${fmt(g.date)}</small>
          <span class="hstat">${g.analysis ? ratingChips(g) : '🔍 Tap to review'}</span></span></button>`;
      }).join('')}</div>`, screenPlaySetup);
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) screenReview(b.dataset.id); });
  }

  function screenReview(gid) {
    const g = (S.gameLog || []).find((x) => x.id === gid);
    if (!g) return screenGames();
    const bot = A.BOTS.find((b) => b.id === g.bot) || A.BOTS[0];
    const game = rebuildGame(g);
    let ply = 0, better = false, stop = null;
    const el = show(`${topbar(`${bot.emoji} Review vs ${bot.name}`, `<span class="chip">${RESULT_TEXT[g.result] || ''}</span>`)}
      <main class="stage">
        <section class="talk">${talkHTML()}<div class="counter" id="counter"></div></section>
        <section class="board-wrap"><div class="board-frame"><div id="board"></div></div></section>
        <section class="actions">
          <div class="nav-row">
            <button class="round" type="button" data-act="first" aria-label="Start">⏮</button>
            <button class="round" type="button" data-act="prev" aria-label="Back one move">◀</button>
            <button class="round" type="button" data-act="next" aria-label="Forward one move">▶</button>
            <button class="round" type="button" data-act="last" aria-label="End">⏭</button>
          </div>
          <button class="btn green small" type="button" data-act="better" hidden>Show better move</button>
          <div class="movelist" id="moves"></div>
        </section>
      </main>`, screenGames);
    const talk = makeTalk(el);
    const counter = $('#counter', el), list = $('#moves', el), betterBtn = $('[data-act="better"]', el);
    const board = new window.Board($('#board', el), { orientation: g.color, showDots: false, movable: () => null });
    board.locked = true;
    const pawns = g.variant === 'pawns';
    const sq = (pos) => (pawns ? -1 : checkSq(pos));
    const yours = (i) => game.positions[i].turn === g.color;

    function drawList() {
      const a = g.analysis || [];
      let html = '';
      for (let i = 0; i < game.moves.length; i += 2) {
        html += `<span class="mn">${i / 2 + 1}.</span>`;
        for (const j of [i, i + 1]) {
          if (j >= game.moves.length) { html += '<span></span>'; continue; }
          const r = a[j];
          html += `<button type="button" class="mv ${r ? 'r-' + r.l : ''} ${j === ply - 1 ? 'cur' : ''} ${yours(j) ? 'mine' : ''}" data-ply="${j + 1}">${game.sans[j]}${r && r.l !== 'good' ? `<b>${RATING[r.l].sym}</b>` : ''}</button>`;
        }
      }
      list.innerHTML = html;
      const curEl = $('.mv.cur', list);
      // Scroll only the move list, never the page.
      if (curEl) list.scrollTop = Math.max(0, curEl.offsetTop - list.clientHeight / 2);
    }

    function render(animate) {
      const i = ply - 1, m = game.moves[i], a = g.analysis || [];
      const r = i >= 0 ? a[i] : null;
      const canBetter = !!(r && r.b && ['inaccuracy', 'mistake', 'blunder'].includes(r.l));
      if (!canBetter) better = false;
      betterBtn.hidden = !canBetter;
      betterBtn.textContent = better ? 'Back to the game' : 'Show better move';
      if (better) {
        const before = game.positions[i];
        const best = C.fromUCI(before, r.b);
        board.set(before, { arrows: [[best.from, best.to, 'green'], [m.from, m.to, 'red']], check: sq(before) });
        talk(`Instead of ${game.sans[i]} (red arrow), ${C.toSAN(before, best)} was better (green arrow).`, 'good', false);
      } else {
        board.set(game.positions[ply], { last: m ? [m.from, m.to] : null, check: sq(game.positions[ply]) }, animate ? m : null);
        let text;
        if (ply === 0) text = 'This is the start of the game. Tap ▶ to go through the moves.';
        else if (yours(i)) {
          const num = `${Math.floor(i / 2) + 1}${game.positions[i].turn === 'w' ? '.' : '…'} ${game.sans[i]}`;
          text = r ? `<b>${num}</b>: ${r.mm ? 'Blunder! You missed a checkmate!' : RATING[r.l].say}` : `<b>${num}</b>: your move.`;
        } else text = `${bot.name} played ${game.sans[i]}.`;
        if (ply === game.moves.length) text += ` <span class="sub">${RESULT_TEXT[g.result]}${g.reason && DRAW_TEXT[g.reason] ? ': ' + DRAW_TEXT[g.reason] : ''}</span>`;
        const mood = r ? (['mistake', 'blunder'].includes(r.l) ? 'oops' : r.l === 'best' ? 'good' : '') : '';
        talk(text, mood, false);
      }
      drawList();
    }

    function summary() {
      counter.innerHTML = g.analysis ? `<span class="r-sum">${ratingChips(g, true)}</span>` : '<span>🔍 Checking your moves…</span>';
    }
    summary();
    if (!g.analysis) {
      stop = analyseGame(g, game, (f) => { counter.innerHTML = `<span>🔍 Checking your moves… ${Math.round(f * 100)}%</span>`; }, () => { summary(); render(); });
    }

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act],[data-ply]');
      if (!b) return;
      const act = b.dataset.act;
      if (b.dataset.ply) { ply = +b.dataset.ply; better = false; render(); return; }
      if (act === 'better') { better = !better; render(); return; }
      const before = ply;
      if (act === 'first') ply = 0;
      else if (act === 'prev') ply = Math.max(0, ply - 1);
      else if (act === 'next') ply = Math.min(game.moves.length, ply + 1);
      else if (act === 'last') ply = game.moves.length;
      else return;
      better = false;
      render(act === 'next' && ply === before + 1);
      if (act === 'next' && ply === before + 1) Sound.move();
    });
    render();
    cleanup = () => { if (stop) stop(); };
  }

  // ================================================================ STICKERS
  function screenStickers() {
    const have = stickerCount();
    show(`${topbar('Sticker Book')}
      <p class="lead">${have < STICKERS.length ? `Next sticker at ${stickerCost(have)} stars. You have ${S.stars}!` : 'You collected every sticker. Superstar!'}</p>
      <div class="sticker-grid">${STICKERS.map((s, i) => (i < have
        ? `<div class="sticker" title="Sticker ${i + 1}">${s}</div>`
        : `<div class="sticker locked"><div><span>?</span>${STAR} ${stickerCost(i)}</div></div>`)).join('')}</div>`, screenHome);
  }

  // ================================================================ GROWN-UPS
  function screenGrownups() {
    const lessonsDone = LESSONS.filter(lessonDone).length;
    const gameRows = A.BOTS.map((b) => {
      const g = S.games[b.id] || { won: 0, played: 0 }, pg = S.games[b.id + '-pawns'] || { won: 0, played: 0 };
      return `<tr><td>${b.emoji} ${b.name}</td><td>${g.won}/${g.played} chess · ${pg.won}/${pg.played} pawn battle</td></tr>`;
    }).join('');
    const el = show(`${topbar('Grown-ups')}
      <div class="settings">
        <section>
          <h3>Player</h3>
          <label for="gname" style="font-weight:800">Child’s name</label>
          <input id="gname" type="text" maxlength="20" value="${esc(S.name)}" autocomplete="off">
          <label class="sw">Sound effects <input type="checkbox" id="s-sound" ${S.settings.sound ? 'checked' : ''}></label>
          <label class="sw">Read instructions aloud <input type="checkbox" id="s-voice" ${S.settings.voice ? 'checked' : ''}></label>
          <label class="sw">Play sound when the iPad is on silent <input type="checkbox" id="s-silent" ${S.settings.overSilent ? 'checked' : ''}></label>
          <label class="sw">Show where pieces can move <input type="checkbox" id="s-dots" ${S.settings.dots ? 'checked' : ''}></label>
          <label class="sw">Open all puzzle types <input type="checkbox" id="s-unlock" ${S.settings.unlockAll ? 'checked' : ''}></label>
          <div class="sw-row"><span>Wait before each hint</span>
            <div class="toggle small" role="group" aria-label="Wait before each hint">${[0, 10, 20, 30, 60].map((n) => `<button type="button" data-wait="${n}" class="${(S.settings.hintWait || 0) === n ? 'on' : ''}">${n ? n + 's' : 'None'}</button>`).join('')}</div>
          </div>
          <p>Puzzles are worth ${PUZZLE_STARS} stars, and each hint (2 at most) costs 1. In games, each hint (3 at most) takes 1 star off a win.</p>
        </section>
        <section>
          <h3>Progress</h3>
          <table>
            <tr><td>Stars</td><td>${S.stars}</td></tr>
            <tr><td>Lessons finished</td><td>${lessonsDone} / ${LESSONS.length}</td></tr>
            <tr><td>Puzzles solved</td><td>${S.puzzlesSolved}</td></tr>
            ${P.THEMES.map((t) => `<tr><td>${t.icon} ${t.title}</td><td>${themeRec(t.id).solved} · level ${themeLevel(t.id)}</td></tr>`).join('')}
            <tr><td>Daily streak</td><td>${S.streak.count} day(s)</td></tr>
          </table>
          <table>${gameRows}</table>
        </section>
        <section>
          <h3>Backup</h3>
          <p>Progress is saved on this device only. Copy this code somewhere safe, or paste a code here to move progress to another device.</p>
          <textarea id="code" spellcheck="false">${esc(btoa(unescape(encodeURIComponent(JSON.stringify(S)))))}</textarea>
          <div class="options">
            <button class="btn blue small" type="button" data-act="copy">Copy code</button>
            <button class="btn ghost small" type="button" data-act="restore">Restore from code</button>
          </div>
          <p id="code-msg"></p>
        </section>
        <section>
          <h3>Start over</h3>
          <p>Erase all stars, stickers and progress on this device.</p>
          <div><button class="btn small" type="button" data-act="reset">Erase progress</button></div>
        </section>
      </div>`, screenHome);
    const bind = (id, key) => $(id, el).addEventListener('change', (e) => { S.settings[key] = e.target.checked; save(); });
    bind('#s-sound', 'sound'); bind('#s-voice', 'voice'); bind('#s-silent', 'overSilent'); bind('#s-dots', 'dots'); bind('#s-unlock', 'unlockAll');
    $('#s-voice', el).addEventListener('change', () => hush());
    $('#s-silent', el).addEventListener('change', setAudioSession);
    $('#gname', el).addEventListener('input', (e) => { S.name = e.target.value.trim(); S.welcomed = true; save(); });
    const msg = $('#code-msg', el);
    let resetArmed = false;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act],[data-wait]');
      if (!b) return;
      const act = b.dataset.act;
      const code = $('#code', el);
      if (b.dataset.wait != null) {
        S.settings.hintWait = +b.dataset.wait;
        save();
        el.querySelectorAll('[data-wait]').forEach((x) => x.classList.toggle('on', x === b));
        return;
      }
      if (act === 'copy') {
        const fallback = () => { code.select(); msg.textContent = 'Code selected. Use Copy from the menu.'; };
        try { navigator.clipboard.writeText(code.value).then(() => { msg.textContent = 'Copied!'; }, fallback); } catch (err) { fallback(); }
      } else if (act === 'restore') {
        try {
          const data = JSON.parse(decodeURIComponent(escape(atob(code.value.trim()))));
          if (typeof data.stars !== 'number') throw new Error('bad');
          S = hydrate(data);
          save();
          msg.textContent = 'Progress restored!';
          setTimeout(screenGrownups, 600);
        } catch (err) { msg.textContent = 'That code did not work. Check it was copied completely.'; }
      } else if (act === 'reset') {
        if (!resetArmed) { resetArmed = true; b.textContent = 'Tap again to erase everything'; return; }
        S = DEFAULTS();
        save();
        screenHome();
      }
    });
  }

  // ---------------------------------------------------------------- boot
  if ('serviceWorker' in navigator && !window.__ARTIFACT__ && location.protocol === 'https:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  screenHome();
})();
