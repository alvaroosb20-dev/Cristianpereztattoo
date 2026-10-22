// Servidor local para probar la web sin Vercel: `npm run dev` → http://localhost:3000
// Sirve los archivos estáticos (con URLs limpias, como Vercel) y ejecuta las funciones de /api.
// Lee variables de un archivo .env si existe.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };

function serveFile(req, res, file) {
  const stat = fs.statSync(file);
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range && type === 'video/mp4') {
    const [s, e] = range.replace('bytes=', '').split('-');
    const start = Number(s), end = e ? Number(e) : stat.size - 1;
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': type });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (p.startsWith('/api/')) {
    const fn = path.join(ROOT, p.replace(/\/$/, '') + '.js');
    if (!fn.startsWith(path.join(ROOT, 'api')) || path.basename(fn).startsWith('_') || !fs.existsSync(fn)) { res.writeHead(404); return res.end('{"error":"not found"}'); }
    try { delete require.cache[require.resolve(fn)]; await require(fn)(req, res); }
    catch (e) { console.error(e); res.writeHead(500); res.end('{"error":"crash"}'); }
    return;
  }
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.statusCode = 404; return serveFile(req, res, path.join(ROOT, '404.html')); }
  serveFile(req, res, file);
}).listen(process.env.PORT || 3000, () => console.log(`Cristhian Pérez Tattoo → http://localhost:${process.env.PORT || 3000}`));
