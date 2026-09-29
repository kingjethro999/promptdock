const { createHash } = require('node:crypto');
const { Pool } = require('pg');

const configured = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
const pool = configured ? new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : process.env.PGHOST,
  port: process.env.DATABASE_URL ? undefined : Number(process.env.PGPORT) || 5432,
  user: process.env.DATABASE_URL ? undefined : process.env.PGUSER,
  password: process.env.DATABASE_URL ? undefined : process.env.PGPASSWORD,
  database: process.env.DATABASE_URL ? undefined : process.env.PGDATABASE,
  max: 5,
  connectionTimeoutMillis: 5000
}) : null;

function ownerKey(request) {
  const token = request.headers['x-workspace-token'];
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new Error('A valid workspace token is required.');
  return createHash('sha256').update(token).digest('hex');
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
  return { id: item.id, name, data: item.data, idea, analysis };
}

async function listPrompts(key) {
  const result = await pool.query('SELECT id, name, data, idea, analysis, updated_at AS "updatedAt" FROM prompts WHERE owner_key = $1 ORDER BY updated_at DESC LIMIT 500', [key]);
  return result.rows;
}

async function putPrompt(key, input) {
  const item = validatePrompt(input);
  const result = await pool.query(`INSERT INTO prompts (owner_key, id, name, data, idea, analysis)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (owner_key, id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data,
      idea = EXCLUDED.idea, analysis = EXCLUDED.analysis, updated_at = now()
    RETURNING id, name, data, idea, analysis, updated_at AS "updatedAt"`,
  [key, item.id, item.name, item.data, item.idea, item.analysis]);
  return result.rows[0];
}

async function deletePrompt(key, id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid prompt ID.');
  await pool.query('DELETE FROM prompts WHERE owner_key = $1 AND id = $2', [key, id]);
}

module.exports = { configured, pool, ownerKey, validatePrompt, listPrompts, putPrompt, deletePrompt };
