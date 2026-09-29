const test = require('node:test');
const assert = require('node:assert/strict');
const { clientIp, consume } = require('../src/rate-limit');

test('client IP uses Vercel forwarding only on Vercel', () => {
  const request = { headers: { 'x-vercel-forwarded-for': '198.51.100.9', 'x-forwarded-for': '203.0.113.7' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(clientIp(request, { VERCEL: '1' }), '198.51.100.9');
  assert.equal(clientIp(request, {}), '127.0.0.1');
});

test('token bucket allows its capacity then rejects until refilled', async () => {
  const request = { headers: {}, socket: { remoteAddress: '192.0.2.42' } };
  const policy = { capacity: 2, periodSeconds: 100000 };
  assert.equal((await consume(request, '/api/idea-to-prompt', { policy, env: {} })).allowed, true);
  assert.equal((await consume(request, '/api/idea-to-prompt', { policy, env: {} })).allowed, true);
  const rejected = await consume(request, '/api/idea-to-prompt', { policy, env: {} });
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.retryAfter, 50000);
});

test('shared bucket query stores only a hashed address', async () => {
  let argumentsSeen;
  const request = { headers: { 'x-forwarded-for': '198.51.100.9' }, socket: {} };
  const pool = { query: async (_sql, args) => { argumentsSeen = args; return { rowCount: 0 }; } };
  const result = await consume(request, '/api/transcribe', { pool, env: { VERCEL: '1' } });
  assert.equal(result.allowed, false);
  assert.match(argumentsSeen[0], /^[a-f0-9]{64}$/);
  assert.ok(!argumentsSeen[0].includes('198.51.100.9'));
});
