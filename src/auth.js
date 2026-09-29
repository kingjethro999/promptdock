const { createHash, randomBytes, randomUUID, scrypt: callbackScrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const database = require('./database');

const scrypt = promisify(callbackScrypt);
const COOKIE = 'promptdock_session';
const SESSION_SECONDS = 60 * 60 * 24 * 30;

class AuthError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function emailFrom(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('Enter a valid email address.');
  return email;
}

function passwordFrom(value, registering = false) {
  if (typeof value !== 'string' || value.length > 200 || (registering && value.length < 12))
    throw new AuthError(registering ? 'Use a password of at least 12 characters.' : 'Invalid email or password.', registering ? 400 : 401);
  return value;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, Buffer.from(salt, 'hex'), 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, salt, expected] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
  const actual = await scrypt(password, Buffer.from(salt, 'hex'), 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function tokenFrom(request) {
  const cookie = request.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)promptdock_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || null;
}

function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }

function cookieHeader(token, request) {
  const secure = request.headers['x-forwarded-proto'] === 'https' || request.socket?.encrypted;
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

function clearCookie(request) { return cookieHeader('', request).replace(`Max-Age=${SESSION_SECONDS}`, 'Max-Age=0'); }

async function issueSession(user, request) {
  const token = randomBytes(32).toString('hex');
  await database.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval \'30 days\')', [tokenHash(token), user.id]);
  return { user: { id: user.id, email: user.email }, cookie: cookieHeader(token, request) };
}

async function register(body, request) {
  const email = emailFrom(body?.email);
  const password = passwordFrom(body?.password, true);
  await database.ensureSchema();
  try {
    const result = await database.pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email', [randomUUID(), email, await hashPassword(password)]);
    return issueSession(result.rows[0], request);
  } catch (error) {
    if (error.code === '23505') throw new AuthError('An account with this email already exists.', 409);
    throw error;
  }
}

async function login(body, request) {
  const email = emailFrom(body?.email);
  const password = passwordFrom(body?.password);
  await database.ensureSchema();
  const result = await database.pool.query('SELECT id, email, password_hash, failed_logins, locked_until FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (user?.locked_until && new Date(user.locked_until) > new Date()) throw new AuthError('Too many attempts. Try again in 15 minutes.', 429);
  const valid = user ? await verifyPassword(password, user.password_hash) : await verifyPassword(password, 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128));
  if (!user || !valid) {
    if (user) await database.pool.query(`UPDATE users SET failed_logins = failed_logins + 1,
      locked_until = CASE WHEN failed_logins + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
      WHERE id = $1`, [user.id]);
    throw new AuthError('Invalid email or password.', 401);
  }
  await database.pool.query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);
  return issueSession(user, request);
}

async function currentUser(request) {
  const token = tokenFrom(request);
  if (!token || !database.pool) return null;
  await database.ensureSchema();
  const result = await database.pool.query(`SELECT users.id, users.email FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`, [tokenHash(token)]);
  return result.rows[0] || null;
}

async function logout(request) {
  const token = tokenFrom(request);
  if (token && database.pool) {
    await database.ensureSchema();
    await database.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
  }
}

module.exports = { AuthError, emailFrom, hashPassword, verifyPassword, tokenFrom, cookieHeader, clearCookie, register, login, currentUser, logout };
