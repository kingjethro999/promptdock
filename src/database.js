const { createHash } = require('node:crypto');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const schema = require('./schema');

function normalizeDatabaseUrl(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.hostname.endsWith('.render.com') && (!url.searchParams.has('sslmode') || url.searchParams.get('sslmode') === 'require')) url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

const configured = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
const pool = configured ? new Pool({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
  host: process.env.DATABASE_URL ? undefined : process.env.PGHOST,
  port: process.env.DATABASE_URL ? undefined : Number(process.env.PGPORT) || 5432,
  user: process.env.DATABASE_URL ? undefined : process.env.PGUSER,
  password: process.env.DATABASE_URL ? undefined : process.env.PGPASSWORD,
  database: process.env.DATABASE_URL ? undefined : process.env.PGDATABASE,
  max: process.env.VERCEL ? 1 : 5,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000
}) : null;
let schemaReady;

async function ensureSchema() {
  if (!pool) return;
  if (!schemaReady) schemaReady = (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(4736291)');
      for (const statement of schema) await client.query(statement);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  })().catch(error => { schemaReady = null; throw error; });
  await schemaReady;
}

function accountKey(userId) { return createHash('sha256').update(`account:${userId}`).digest('hex'); }
function legacyKey(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new Error('A valid legacy workspace token is required.');
  return createHash('sha256').update(token).digest('hex');
}

async function importLegacy(userId, token) {
  const source = legacyKey(token);
  const target = accountKey(userId);
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO prompts (owner_key, id, name, data, idea, analysis, updated_at)
      SELECT $1, id, name, data, idea, analysis, updated_at FROM prompts WHERE owner_key = $2
      ON CONFLICT (owner_key, id) DO NOTHING`, [target, source]);
    await client.query('DELETE FROM prompts WHERE owner_key = $1', [source]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

function validatePrompt(item) {
  if (!item || typeof item !== 'object' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id || '')) throw new Error('Invalid prompt ID.');
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name || name.length > 120) throw new Error('Prompt name must be 1–120 characters.');
  if (!item.data || typeof item.data !== 'object' || Array.isArray(item.data) || typeof item.data.task !== 'string' || !item.data.task.trim()) throw new Error('A prompt task is required.');
  if (JSON.stringify(item.data).length > 20000) throw new Error('Prompt is too long.');
  const idea = typeof item.idea === 'string' ? item.idea.slice(0, 6000) : '';
  const analysis = item.analysis && typeof item.analysis === 'object' && !Array.isArray(item.analysis) ? item.analysis : null;
  if (analysis && JSON.stringify(analysis).length > 12000) throw new Error('Analysis is too long.');
  if (item.tags != null && !Array.isArray(item.tags)) throw new Error('Tags must be a list.');
  const tags = [...new Set((item.tags || []).map(tag => typeof tag === 'string' ? tag.trim().toLowerCase() : ''))];
  if (tags.length > 8 || tags.some(tag => !tag || tag.length > 24 || !/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(tag))) throw new Error('Use up to 8 tags, each 1–24 letters or numbers.');
  return { id: item.id, name, data: item.data, idea, analysis, tags };
}

async function listPrompts(key, options = {}) {
  const q = String(options.q || '').trim();
  if (q.length > 100) throw new Error('Search is too long.');
  const offset = Number(options.offset || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new Error('Invalid offset.');
  await ensureSchema();
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const where = `owner_key = $1 AND ($2 = '' OR name ILIKE $3 ESCAPE '\\' OR idea ILIKE $3 ESCAPE '\\' OR data->>'task' ILIKE $3 ESCAPE '\\' OR EXISTS (SELECT 1 FROM unnest(tags) tag WHERE tag ILIKE $3 ESCAPE '\\'))`;
  const params = [key, q, pattern];
  const [result, count] = await Promise.all([
    pool.query(`SELECT id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt" FROM prompts WHERE ${where} ORDER BY updated_at DESC LIMIT 100 OFFSET $4`, [...params, offset]),
    pool.query(`SELECT count(*)::int AS total FROM prompts WHERE ${where}`, params)
  ]);
  return { prompts: result.rows, total: count.rows[0].total };
}

async function putPrompt(key, input) {
  const item = validatePrompt(input);
  await ensureSchema();
  const result = await pool.query(`INSERT INTO prompts (owner_key, id, name, data, idea, analysis, tags)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (owner_key, id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data,
      idea = EXCLUDED.idea, analysis = EXCLUDED.analysis, tags = EXCLUDED.tags, updated_at = now()
    RETURNING id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt"`,
  [key, item.id, item.name, item.data, item.idea, item.analysis, item.tags]);
  return result.rows[0];
}

async function deletePrompt(key, id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid prompt ID.');
  await ensureSchema();
  await pool.query('DELETE FROM prompts WHERE owner_key = $1 AND id = $2', [key, id]);
}

function validUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

async function setPromptPublic(key, id, published) {
  if (!validUuid(id) || typeof published !== 'boolean') throw new Error('Invalid sharing request.');
  await ensureSchema();
  const result = await pool.query(`UPDATE prompts SET public_id = CASE WHEN $3 THEN COALESCE(public_id, $4::uuid) ELSE NULL END,
    published_at = CASE WHEN $3 THEN COALESCE(published_at, now()) ELSE NULL END
    WHERE owner_key = $1 AND id = $2
    RETURNING id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt"`,
  [key, id, published, randomUUID()]);
  return result.rows[0] || null;
}

async function getPublicPrompt(publicId) {
  if (!validUuid(publicId)) return null;
  await ensureSchema();
  const result = await pool.query(`SELECT public_id AS "publicId", name, data, updated_at AS "updatedAt"
    FROM prompts WHERE public_id = $1`, [publicId]);
  return result.rows[0] || null;
}

async function forkPublicPrompt(key, publicId) {
  if (!validUuid(publicId)) return null;
  await ensureSchema();
  const result = await pool.query(`INSERT INTO prompts (owner_key, id, name, data, tags, forked_from)
    SELECT $1, $2, name, data, tags, public_id FROM prompts WHERE public_id = $3
    ON CONFLICT (owner_key, forked_from) WHERE forked_from IS NOT NULL DO UPDATE SET name = prompts.name
    RETURNING id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt"`,
  [key, randomUUID(), publicId]);
  return result.rows[0] || null;
}

module.exports = { configured, pool, normalizeDatabaseUrl, ensureSchema, accountKey, legacyKey, importLegacy, validatePrompt, listPrompts, putPrompt, deletePrompt, setPromptPublic, getPublicPrompt, forkPublicPrompt };
