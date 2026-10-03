/* Hand-drawn SVG chess pieces (45x45 viewBox), exposed as data URIs. */
(function (root) {
  'use strict';

  const PAL = {
    w: { fill: '#FFFDF7', line: '#2B2A33', detail: '#2B2A33', shade: '#E9E2D2' },
    b: { fill: '#34323F', line: '#16151C', detail: '#F1EEE6', shade: '#4A4757' },
  };

  function shapes(type, c) {
    const s = `fill="${c.fill}" stroke="${c.line}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
    const d = `fill="none" stroke="${c.detail}" stroke-width="1.4" stroke-linecap="round"`;
    const base = `<rect x="10" y="35" width="25" height="4.5" rx="2" ${s}/>`;
    switch (type) {
      case 'P':
        return `<path ${s} d="M22.5 8.5a5 5 0 0 0-3.2 8.8c-2 1.2-3.3 3.3-3.3 5.7 0 2 .9 3.8 2.4 5C15.2 29.6 12.6 32.6 12 35h21c-.6-2.4-3.2-5.4-6.4-7 1.5-1.2 2.4-3 2.4-5 0-2.4-1.3-4.5-3.3-5.7a5 5 0 0 0-3.2-8.8z"/>${base}`;
      case 'R':
        return `<path ${s} d="M12 8.5h4.2v3.3h4.2V8.5h4.2v3.3h4.2V8.5H33V15l-2.6 3H14.6L12 15z"/>` +
          `<path ${s} d="M14.6 18h15.8l1.1 13.5H13.5z"/>` +
          `<path ${s} d="M13.5 31.5h18l1.5 3.5H12z"/>${base}` +
          `<path ${d} d="M14.6 18h15.8M13.6 31.5h17.8" opacity=".7"/>`;
      case 'B':
        return `<circle cx="22.5" cy="7.6" r="2.6" ${s}/>` +
          `<path ${s} d="M22.5 10.2c-5.3 4-8.8 9-8.8 13.8 0 3.9 3 6.6 8.8 7.2 5.8-.6 8.8-3.3 8.8-7.2 0-4.8-3.5-9.8-8.8-13.8z"/>` +
          `<rect x="14.5" y="30.6" width="16" height="4.4" rx="2" ${s}/>${base}` +
          `<path ${d} d="M26.3 14.6l-5.3 6.2M19.6 25.8h5.8"/>`;
      case 'N':
        return `<path ${s} d="M14 35c-.2-4.6 1.2-8.6 4.8-12.4-1.8.9-3.8 2.6-6.2 3.7-1.7.7-3.4-.8-2.8-2.6 1.1-4.4 3.4-8.9 6.5-11.6 1.8-1.5 3.8-2.4 5.7-2.7l2-3.9 2.3 3.9c5.2 2.1 8.8 9 8 25.6z"/>` +
          `${base}<circle cx="17.6" cy="14.6" r="1.3" fill="${c.detail}"/>` +
          `<circle cx="12.4" cy="23.4" r=".9" fill="${c.detail}"/>` +
          `<path ${d} d="M26.6 11.6c3.2 3.6 4.6 10 4.1 19.4" opacity=".75"/>`;
      case 'Q':
        return `<path ${s} d="M12.5 31L9.3 14.6l5.4 9.8.8-12.2 4.6 11.4 2.4-12.8 2.4 12.8 4.6-11.4.8 12.2 5.4-9.8L32.5 31z"/>` +
          [[9.3, 12.8], [15.5, 10.6], [22.5, 9.4], [29.5, 10.6], [35.7, 12.8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.3" ${s}/>`).join('') +
          `<rect x="11.5" y="30.6" width="22" height="4.4" rx="2" ${s}/>${base}` +
          `<path ${d} d="M14 33h17" opacity=".6"/>`;
      case 'K':
        return `<path fill="none" stroke="${c.line}" stroke-width="2.4" stroke-linecap="round" d="M22.5 4.8v7.4M19 8.2h7"/>` +
          `<path ${s} d="M12.3 31c-2.6-4.8-3.6-9.4-.6-12.4 3.2-3.2 7.6-1.6 10.8 3.6 3.2-5.2 7.6-6.8 10.8-3.6 3 3 2 7.6-.6 12.4z"/>` +
          `<path ${s} d="M22.5 23.6c-2.2-2.8-3.6-5-3.6-7.2 0-2.1 1.6-3.7 3.6-3.7s3.6 1.6 3.6 3.7c0 2.2-1.4 4.4-3.6 7.2z"/>` +
          `<rect x="11.5" y="30.6" width="22" height="4.4" rx="2" ${s}/>${base}` +
          `<path ${d} d="M14 33h17" opacity=".6"/>`;
    }
    return '';
  }

  function svg(code) {
    const c = PAL[code[0]];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${shapes(code[1], c)}</svg>`;
  }

  const URIS = {};
  for (const color of ['w', 'b']) for (const t of 'PNBRQK') {
    URIS[color + t] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(color + t));
  }

  const api = { svg, uri: (code) => URIS[code] };
  root.Pieces = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
