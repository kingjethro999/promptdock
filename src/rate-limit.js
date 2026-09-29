const { createHash } = require('node:crypto');
const { isIP } = require('node:net');
const database = require('./database');

const policies = Object.freeze({
  '/api/idea-to-prompt': { capacity: 20, periodSeconds: 3600 },
  '/api/enhance': { capacity: 30, periodSeconds: 3600 },
  '/api/transcribe': { capacity: 10, periodSeconds: 3600 }
});
const localBuckets = new Map();

function clientIp(request, env = process.env) {
  const forwarded = env.VERCEL ? request.headers['x-vercel-forwarded-for'] || request.headers['x-forwarded-for'] : null;
  const value = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || request.socket?.remoteAddress || '';
  return isIP(value) ? value : 'unknown';
}

async function consume(request, route, options = {}) {
  const policy = options.policy || policies[route];
  if (!policy) throw new Error('No rate limit policy for this route.');
  const env = options.env || process.env;
  const pool = options.pool || database.pool;
  const key = createHash('sha256').update(`${route}:${clientIp(request, env)}`).digest('hex');
  const refill = policy.capacity / policy.periodSeconds;
  if (!pool) {
    if (env.VERCEL) throw new Error('Rate limit storage is unavailable.');
    const now = Date.now();
    const bucket = localBuckets.get(key) || { tokens: policy.capacity, updatedAt: now };
    const available = Math.min(policy.capacity, bucket.tokens + Math.max(0, (now - bucket.updatedAt) / 1000) * refill);
    localBuckets.set(key, { tokens: available >= 1 ? available - 1 : available, updatedAt: now });
    return { allowed: available >= 1, retryAfter: Math.ceil(policy.periodSeconds / policy.capacity) };
  }
  if (!options.pool) await database.ensureSchema();
  const result = await pool.query(`INSERT INTO api_rate_limits (bucket_key, tokens, updated_at)
    VALUES ($1, $2::double precision - 1, now())
    ON CONFLICT (bucket_key) DO UPDATE SET
      tokens = LEAST($2::double precision, api_rate_limits.tokens +
        GREATEST(0, EXTRACT(EPOCH FROM now() - api_rate_limits.updated_at)) * $3::double precision) - 1,
      updated_at = now()
    WHERE LEAST($2::double precision, api_rate_limits.tokens +
      GREATEST(0, EXTRACT(EPOCH FROM now() - api_rate_limits.updated_at)) * $3::double precision) >= 1
    RETURNING tokens`, [key, policy.capacity, refill]);
  return { allowed: result.rowCount === 1, retryAfter: Math.ceil(policy.periodSeconds / policy.capacity) };
}

module.exports = { policies, clientIp, consume };
