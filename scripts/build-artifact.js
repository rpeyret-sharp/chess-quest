// Bundle the app into one self-contained HTML page (dist/chess-quest.html) for hosts that take a single file.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// Images referenced from code become data URIs so the page stays a single file.
const inlineImages = (src) => src.replace(/img\/[\w-]+\.webp/g, (p) => `data:image/webp;base64,${fs.readFileSync(path.join(ROOT, p)).toString('base64')}`);

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${inlineImages(read(p))}\n</script>`);
html = html.replace(/<link rel="(manifest|apple-touch-icon|icon)"[^>]*>\n?/g, '');
html = html.replace(/<meta name="(apple-mobile-web-app-[^"]+|mobile-web-app-capable)"[^>]*>\n?/g, '');
// The single-file host supplies its own document skeleton.
html = html.replace(/<!doctype html>\n?|<\/?html[^>]*>\n?|<\/?head>\n?|<\/?body>\n?|<meta charset[^>]*>\n?|<meta name="viewport"[^>]*>\n?/gi, '');
html = html.replace('<div id="app"></div>', '<script>window.__ARTIFACT__ = true;</script>\n<div id="app"></div>');
if (!/^<title>/.test(html.trim())) html = html.replace(/<title>.*?<\/title>\n?/, '').replace(/^/, '<title>Chess Quest</title>\n');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/chess-quest.html'), html);
console.log(`dist/chess-quest.html: ${(html.length / 1024).toFixed(0)} KB`);
