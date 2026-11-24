// Dev server lokal HADIRIN: file statis + handler /api/* (tanpa Vercel). Jalankan: npm run dev
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
if (fs.existsSync(path.join(root, '.env'))) for (const l of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.HADIRIN_DEV = 'true';
const PORT = process.env.PORT || 3000;
const MIME = { '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); let p = decodeURIComponent(url.pathname);
  if (p === '/config.js') p = '/api/config';
  if (p.startsWith('/api/')) {
    const file = path.join(root, p + '.js');
    if (!file.startsWith(path.join(root, 'api')) || !fs.existsSync(file) || path.basename(file).startsWith('_')) { res.statusCode = 404; return res.end('{}'); }
    let raw = ''; for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    try { await (await import(pathToFileURL(file).href)).default(req, res); }
    catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: e.message }); }
    return;
  }
  if (p === '/') p = '/dashboard';
  let f = path.join(root, p); if (!path.extname(f)) f += '.html';
  if (!f.startsWith(root) || /[\\/](\.env|server\.js|scripts|supabase)/.test(f.slice(root.length)) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`HADIRIN dev: http://localhost:${PORT}  (login: ${process.env.DEFAULT_ADMIN_EMAIL || '-'})`));
