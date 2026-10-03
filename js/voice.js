/* Read-aloud text handling shared by the app and scripts/make-voice.js.
 * Spoken text is cut into sentences; each sentence is looked up by its key in the
 * pre-recorded clips (js/voice-clips.js), so the app and the generator must split alike. */
(function (root) {
  'use strict';

  // Plain words only: no tags, entities, star counts (+2 ★) or emoji.
  function clean(text) {
    // NFC first, so an accented name typed on the iPad (É as E + accent) still finds its clip.
    return String(text).normalize('NFC')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, ' ')
      .replace(/[+−]\d+/g, ' ')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/[^\p{L}\p{N}\s.,!?…'":;&-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const key = (sentence) => sentence.toLowerCase();

  // [{text, key}] for every sentence that has a word in it.
  function sentences(text) {
    return (clean(text).match(/[^.!?…]+(?:[.!?…]+|$)/g) || [])
      .map((s) => s.trim())
      .filter((s) => /\p{L}/u.test(s))
      .map((s) => ({ text: s, key: key(s) }));
  }

  const api = { clean, sentences, key };
  root.Voice = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
