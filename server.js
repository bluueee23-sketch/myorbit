// 내 컴퓨터에서 실행하기: node server.js  →  http://localhost:3000
// 추가 설치 없이 Node 18 이상이면 돌아간다. .env 파일이 있으면 읽는다.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

if (existsSync(path.join(ROOT, '.env'))) {
  for (const line of readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const API = {
  '/api/reading': () => import('./api/reading.js'),
  '/api/subscribe': () => import('./api/subscribe.js')
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return; }
    if (API[url.pathname]) {
      const mod = await API[url.pathname]();
      const handler = mod[req.method];
      if (!handler) { res.writeHead(405).end(); return; }
      const chunks = [];
      for await (const ch of req) chunks.push(ch);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const data = await readFile(file).catch(() => null);
    if (!data) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('없는 페이지예요'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`나의 궤도 → http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY ? 'AI 해석: 켜짐' : 'AI 해석: 꺼짐 (.env 에 ANTHROPIC_API_KEY 를 넣으면 켜져요)');
});
