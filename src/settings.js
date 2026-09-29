const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const database = require('./database');

function encryptionKey(env = process.env) {
  const value = env.BYOK_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  return Buffer.from(value, 'hex');
}

function encryptKey(userId, value, env = process.env) {
  const key = encryptionKey(env);
  if (!key) throw new Error('BYOK encryption is not configured.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}

function decryptKey(userId, encoded, env = process.env) {
  const key = encryptionKey(env);
  if (!key) throw new Error('BYOK encryption is not configured.');
  const parts = String(encoded).split('.').map(part => Buffer.from(part, 'base64url'));
  if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16) throw new Error('Saved provider key is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', key, parts[0]);
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(parts[1]);
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString('utf8');
}

function validateSetting(input) {
  const provider = input?.provider;
  const model = typeof input?.model === 'string' ? input.model.trim() : '';
  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
  if (!['groq', 'gemini', 'apmix'].includes(provider)) throw new Error('Choose Groq, Gemini, or APMIX.');
  if (!/^[A-Za-z0-9._:/-]{2,120}$/.test(model)) throw new Error('Enter a valid model ID.');
  if (apiKey && (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey))) throw new Error('Enter a valid API key.');
  return { provider, model, apiKey };
}

async function getSettings(userId) {
  await database.ensureSchema();
  const result = await database.pool.query('SELECT provider, model, updated_at FROM user_ai_settings WHERE user_id = $1', [userId]);
  return { available: Boolean(encryptionKey()), provider: result.rows[0]?.provider || null, model: result.rows[0]?.model || '', hasKey: Boolean(result.rows[0]), updatedAt: result.rows[0]?.updated_at || null };
}

async function saveSettings(userId, input) {
  const { provider, model, apiKey } = validateSetting(input);
  if (!encryptionKey()) throw new Error('BYOK encryption is not configured.');
  await database.ensureSchema();
  const existing = await database.pool.query('SELECT provider, encrypted_key FROM user_ai_settings WHERE user_id = $1', [userId]);
  if (!apiKey && (!existing.rows[0] || existing.rows[0].provider !== provider)) throw new Error('Enter an API key for this provider.');
  const encrypted = apiKey ? encryptKey(userId, apiKey) : existing.rows[0].encrypted_key;
  await database.pool.query(`INSERT INTO user_ai_settings (user_id, provider, model, encrypted_key)
    VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE
    SET provider = EXCLUDED.provider, model = EXCLUDED.model, encrypted_key = EXCLUDED.encrypted_key, updated_at = now()`,
  [userId, provider, model, encrypted]);
  return getSettings(userId);
}

async function deleteSettings(userId) {
  await database.ensureSchema();
  await database.pool.query('DELETE FROM user_ai_settings WHERE user_id = $1', [userId]);
  return getSettings(userId);
}

async function effectiveEnv(userId, env = process.env) {
  if (!userId) return env;
  await database.ensureSchema();
  const result = await database.pool.query('SELECT provider, model, encrypted_key FROM user_ai_settings WHERE user_id = $1', [userId]);
  const setting = result.rows[0];
  if (!setting) return env;
  const apiKey = decryptKey(userId, setting.encrypted_key, env);
  const next = { ...env, AI_PROVIDER_ORDER: setting.provider, AI_MAX_FALLBACKS: '0' };
  if (setting.provider === 'groq') { next.GROQ_API_KEY = apiKey; next.GROQ_MODEL = setting.model; }
  if (setting.provider === 'gemini') { next.GEMINI_API_KEY = apiKey; next.GEMINI_MODEL = setting.model; }
  if (setting.provider === 'apmix') { next.APMIX_API_KEY = apiKey; next.APMIX_MODEL = setting.model; next.APMIX_BASE_URL = env.APMIX_BASE_URL || 'https://api.apmix.ai/v1'; }
  return next;
}

module.exports = { encryptionKey, encryptKey, decryptKey, validateSetting, getSettings, saveSettings, deleteSettings, effectiveEnv };
