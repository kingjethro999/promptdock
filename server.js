const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { configuredProviders, enhanceWithAI } = require('./ai');
const { version } = require('./package.json');

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};
const publicFiles = new Set(['/index.html', '/styles.css', '/app.js', '/favicon.svg']);

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString();
    if (body.length > 24000) throw new Error('Draft is too long.');
  }
  try { return JSON.parse(body); }
  catch { throw new Error('Invalid JSON.'); }
}

http.createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (pathname === '/api/status' && request.method === 'GET') {
    json(response, 200, { aiAvailable: configuredProviders().length > 0, version: `v${version}` });
    return;
  }
  if (pathname === '/api/enhance' && request.method === 'POST') {
    const origin = request.headers.origin;
    if (origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin)) { json(response, 403, { error: 'Invalid origin.' }); return; }
    if (!request.headers['content-type']?.startsWith('application/json')) { json(response, 415, { error: 'Use JSON.' }); return; }
    try { json(response, 200, await enhanceWithAI(await readBody(request))); }
    catch (error) { json(response, error.message === 'Draft is too long.' ? 413 : error.message === 'Invalid JSON.' || error.message === 'Add a task before enhancing.' ? 400 : 503, { error: error.message }); }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  if (!publicFiles.has(pathname)) {
    response.writeHead(404).end('Not found');
    return;
  }
  const file = path.join(root, pathname);
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)],
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`PromptDock is running at http://localhost:${port}`));
