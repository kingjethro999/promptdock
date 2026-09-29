const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { configuredProviders, enhanceWithAI, ideaToPrompt } = require('./ai');
const { MAX_AUDIO_BYTES, transcribeAudio } = require('./speech');
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
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 72000) throw new Error('Draft is too long.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Invalid JSON.'); }
}

async function readAudio(request) {
  if (Number(request.headers['content-length']) > MAX_AUDIO_BYTES) throw new Error('Recording is too large. Keep it under 10 MB.');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_AUDIO_BYTES) throw new Error('Recording is too large. Keep it under 10 MB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function validOrigin(request) {
  const origin = request.headers.origin;
  return !origin || [`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin);
}

http.createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (pathname === '/api/status' && request.method === 'GET') {
    json(response, 200, { aiAvailable: configuredProviders().length > 0, voiceAvailable: Boolean(process.env.GROQ_API_KEY), version: `v${version}` });
    return;
  }
  if (pathname === '/api/transcribe' && request.method === 'POST') {
    if (!validOrigin(request)) { json(response, 403, { error: 'Invalid origin.' }); return; }
    try { json(response, 200, { text: await transcribeAudio(await readAudio(request), request.headers['content-type']) }); }
    catch (error) {
      const message = error.message;
      const status = message.startsWith('Recording is too large') ? 413
        : ['This audio format is not supported.', 'Recording is too short. Try speaking again.'].includes(message) ? 400 : 503;
      json(response, status, { error: message });
    }
    return;
  }
  if (['/api/enhance', '/api/idea-to-prompt'].includes(pathname) && request.method === 'POST') {
    if (!validOrigin(request)) { json(response, 403, { error: 'Invalid origin.' }); return; }
    if (!request.headers['content-type']?.startsWith('application/json')) { json(response, 415, { error: 'Use JSON.' }); return; }
    try {
      const body = await readBody(request);
      json(response, 200, await (pathname === '/api/idea-to-prompt' ? ideaToPrompt(body) : enhanceWithAI(body)));
    } catch (error) {
      const message = error.message;
      const status = ['Draft is too long.', 'Idea is too long.'].includes(message) ? 413
        : ['Invalid JSON.', 'Add a task before enhancing.', 'Describe your idea in a few words.'].includes(message) ? 400 : 503;
      json(response, status, { error: message });
    }
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
