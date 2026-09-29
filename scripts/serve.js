// Tiny static server with no dependencies: `npm start` → http://localhost:5173
// (localhost counts as a secure context, so location + offline mode work.)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.woff2': 'font/woff2',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end('Bad request'); return; }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.resolve(ROOT, '.' + urlPath);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': /font|image/.test(type) ? 'public, max-age=86400' : 'no-cache' };
    // gzip text like GitHub Pages does, so local performance numbers are realistic
    if (/text|javascript|json|svg|manifest/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      res.end(require('zlib').gzipSync(data));
      return;
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}).listen(PORT, () => console.log(`SecondLook running at http://localhost:${PORT}`));
