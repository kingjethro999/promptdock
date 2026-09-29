const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('../src/database');
const mailer = require('../src/mailer');
const auth = require('../src/auth');

function fakeAuthDatabase() {
  const users = new Map();
  const tokens = new Map();
  const sessions = new Map();
  async function query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };
    if (sql.startsWith('INSERT INTO users')) {
      const user = { id: params[0], email: params[1], password_hash: params[2], failed_logins: 0, locked_until: null, email_verified_at: null };
      users.set(user.email, user); return { rows: [{ id: user.id, email: user.email }], rowCount: 1 };
    }
    if (sql.startsWith('SELECT created_at FROM auth_tokens')) return { rows: [], rowCount: 0 };
    if (sql.startsWith('DELETE FROM auth_tokens WHERE user_id')) {
      for (const [hash, token] of tokens) if (token.user_id === params[0] && token.purpose === params[1]) tokens.delete(hash);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('INSERT INTO auth_tokens')) {
      tokens.set(params[0], { user_id: params[1], purpose: params[2] }); return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('SELECT user_id FROM auth_tokens')) {
      const token = tokens.get(params[0]);
      return { rows: token?.purpose === params[1] ? [{ user_id: token.user_id }] : [], rowCount: token?.purpose === params[1] ? 1 : 0 };
    }
    if (sql.startsWith('UPDATE users SET email_verified_at')) {
      for (const user of users.values()) if (user.id === params[0]) user.email_verified_at = new Date();
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('SELECT id, email, password_hash')) {
      const user = users.get(params[0]); return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }
    if (sql.startsWith('UPDATE users SET failed_logins = 0')) return { rows: [], rowCount: 1 };
    if (sql.startsWith('UPDATE users SET failed_logins = failed_logins + 1')) {
      for (const user of users.values()) if (user.id === params[0]) user.failed_logins++;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('INSERT INTO sessions')) {
      sessions.set(params[0], params[1]); return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('SELECT id, email FROM users WHERE email')) {
      const user = users.get(params[0]); return { rows: user ? [{ id: user.id, email: user.email }] : [], rowCount: user ? 1 : 0 };
    }
    if (sql.startsWith('UPDATE users SET password_hash')) {
      for (const user of users.values()) if (user.id === params[1]) { user.password_hash = params[0]; user.email_verified_at ||= new Date(); }
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('DELETE FROM sessions WHERE user_id')) {
      for (const [hash, userId] of sessions) if (userId === params[0]) sessions.delete(hash);
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected auth query: ${sql.slice(0, 80)}`);
  }
  const client = { query, release() {} };
  return { pool: { query, connect: async () => client }, users, tokens, sessions };
}

test('registration, verification, login, password reset, and session invalidation', async () => {
  const fake = fakeAuthDatabase();
  const original = { pool: database.pool, ensureSchema: database.ensureSchema, configured: mailer.configured, sendAuthLink: mailer.sendAuthLink };
  const links = [];
  database.pool = fake.pool;
  database.ensureSchema = async () => {};
  mailer.configured = () => true;
  mailer.sendAuthLink = async (email, purpose, token) => { links.push({ email, purpose, token }); };
  const request = { headers: { 'x-forwarded-proto': 'https' } };
  try {
    const pending = await auth.register({ email: '  TEST@example.com ', password: 'original-long-password' }, request);
    assert.deepEqual(pending, { pending: true, email: 'test@example.com' });
    assert.equal(links[0].purpose, 'verify');
    await assert.rejects(auth.login({ email: 'test@example.com', password: 'original-long-password' }, request), error => error.code === 'verification_required');
    await auth.consumeToken(links[0].token, 'verify');
    await assert.rejects(auth.consumeToken(links[0].token, 'verify'), /invalid or expired/);
    const firstSession = await auth.login({ email: 'test@example.com', password: 'original-long-password' }, request);
    assert.match(firstSession.cookie, /HttpOnly.*Secure/);
    assert.equal(fake.sessions.size, 1);
    await auth.forgotPassword({ email: 'test@example.com' });
    assert.equal(links[1].purpose, 'reset');
    await auth.consumeToken(links[1].token, 'reset', 'replacement-long-password');
    assert.equal(fake.sessions.size, 0);
    await assert.rejects(auth.login({ email: 'test@example.com', password: 'original-long-password' }, request), /Invalid email or password/);
    const secondSession = await auth.login({ email: 'test@example.com', password: 'replacement-long-password' }, request);
    assert.equal(secondSession.user.email, 'test@example.com');
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
    mailer.configured = original.configured;
    mailer.sendAuthLink = original.sendAuthLink;
  }
});
