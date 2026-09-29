const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDatabaseUrl } = require('../src/database');

test('Render external database URLs require TLS without changing local URLs', () => {
  const external = normalizeDatabaseUrl('postgresql://user:example@dpg-demo.oregon-postgres.render.com/promptdock');
  assert.equal(new URL(external).searchParams.get('sslmode'), 'require');
  const explicit = 'postgresql://user:example@dpg-demo.oregon-postgres.render.com/promptdock?sslmode=verify-full';
  assert.equal(normalizeDatabaseUrl(explicit), explicit);
  const local = 'postgresql://user:example@localhost:5434/promptdock';
  assert.equal(normalizeDatabaseUrl(local), local);
});
