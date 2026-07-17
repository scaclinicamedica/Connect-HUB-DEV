import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const supportDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(supportDirectory, '..', '..');
const port = Number(process.argv[2] || process.env.PW_TEST_PORT || 4173);
const host = '127.0.0.1';

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg']
]);

function resolveRequestPath(requestUrl = '/') {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
  const relative = pathname === '/' ? 'passagem.html' : pathname.replace(/^\/+/, '');
  const candidate = resolve(repositoryRoot, relative);
  const rootPrefix = repositoryRoot.endsWith(sep) ? repositoryRoot : repositoryRoot + sep;
  return candidate === repositoryRoot || candidate.startsWith(rootPrefix) ? candidate : null;
}

const server = createServer((request, response) => {
  if(request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  const path = resolveRequestPath(request.url);
  if(!path || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes.get(extname(path).toLowerCase()) || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  if(request.method === 'HEAD') response.end();
  else createReadStream(path).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Connect HUB test server: http://${host}:${port}\n`);
});

for(const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

