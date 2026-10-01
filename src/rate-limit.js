const { createHash } = require("node:crypto");
const { isIP } = require("node:net");
const database = require("./database");

const policies = Object.freeze({
  "/api/idea-to-prompt": { capacity: 20, periodSeconds: 3600 },
  "/api/enhance": { capacity: 30, periodSeconds: 3600 },
  "/api/transcribe": { capacity: 10, periodSeconds: 3600 },
  "/api/run": { capacity: 20, periodSeconds: 3600 },
  "/api/auth/login": { capacity: 20, periodSeconds: 900 },
  "/api/auth/register": { capacity: 10, periodSeconds: 3600 },
  "/api/auth/forgot": { capacity: 6, periodSeconds: 3600 },
  "/api/auth/resend": { capacity: 6, periodSeconds: 3600 },
  "/api/auth/reset": { capacity: 10, periodSeconds: 900 },
  "/api/auth/delete-account": { capacity: 5, periodSeconds: 900 },
  "/api/usage": { capacity: 120, periodSeconds: 3600 },
  "/api/feedback": { capacity: 5, periodSeconds: 3600 },
});
const localBuckets = new Map();
const bucketTtlSeconds =
  Math.max(...Object.values(policies).map((policy) => policy.periodSeconds)) +
  60;
const pruneIntervalMs = 10 * 60 * 1000;
let lastPruneAt = 0;

function clientIp(request, env = process.env) {
  const forwarded = env.VERCEL
    ? request.headers["x-vercel-forwarded-for"] ||
      request.headers["x-forwarded-for"]
    : null;
  const value =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(",")[0]
      .trim() ||
    request.socket?.remoteAddress ||
    "";
  return isIP(value) ? value : "unknown";
}

async function prune(options = {}, now = Date.now()) {
  for (const [key, bucket] of localBuckets) {
    if ((now - bucket.updatedAt) / 1000 > bucketTtlSeconds)
      localBuckets.delete(key);
  }
  const pool = options.pool || database.pool;
  if (!pool || now - lastPruneAt < pruneIntervalMs) return;
  lastPruneAt = now;
  try {
    await pool.query(
      "DELETE FROM api_rate_limits WHERE updated_at < now() - ($1::integer * interval '1 second')",
      [bucketTtlSeconds],
    );
  } catch {
    /* pruning is best-effort */
  }
}

async function consume(request, route, options = {}) {
  const policy = options.policy || policies[route];
  if (!policy) throw new Error("No rate limit policy for this route.");
  const env = options.env || process.env;
  const pool = options.pool || database.pool;
  const subject = options.subject || `ip:${clientIp(request, env)}`;
  const key = createHash("sha256").update(`${route}:${subject}`).digest("hex");
  const refill = policy.capacity / policy.periodSeconds;
  if (!pool) {
    prune(options);
    if (env.VERCEL) throw new Error("Rate limit storage is unavailable.");
    const now = Date.now();
    const bucket = localBuckets.get(key) || {
      tokens: policy.capacity,
      updatedAt: now,
    };
    const available = Math.min(
      policy.capacity,
      bucket.tokens + Math.max(0, (now - bucket.updatedAt) / 1000) * refill,
    );
    localBuckets.set(key, {
      tokens: available >= 1 ? available - 1 : available,
      updatedAt: now,
    });
    return {
      allowed: available >= 1,
      retryAfter: Math.ceil(policy.periodSeconds / policy.capacity),
    };
  }
  if (!options.pool) await database.ensureSchema();
  await prune({ pool });
  const result = await pool.query(
    `INSERT INTO api_rate_limits (bucket_key, tokens, updated_at)
    VALUES ($1, $2::double precision - 1, now())
    ON CONFLICT (bucket_key) DO UPDATE SET
      tokens = LEAST($2::double precision, api_rate_limits.tokens +
        GREATEST(0, EXTRACT(EPOCH FROM now() - api_rate_limits.updated_at)) * $3::double precision) - 1,
      updated_at = now()
    WHERE LEAST($2::double precision, api_rate_limits.tokens +
      GREATEST(0, EXTRACT(EPOCH FROM now() - api_rate_limits.updated_at)) * $3::double precision) >= 1
    RETURNING tokens`,
    [key, policy.capacity, refill],
  );
  return {
    allowed: result.rowCount === 1,
    retryAfter: Math.ceil(policy.periodSeconds / policy.capacity),
  };
}

function usageOf(policy, available) {
  const held = Math.min(policy.capacity, Math.max(0, available));
  const remaining = Math.floor(held);
  const refill = policy.capacity / policy.periodSeconds;
  return {
    capacity: policy.capacity,
    used: policy.capacity - remaining,
    remaining,
    resetsIn: Math.ceil((policy.capacity - held) / refill),
  };
}

async function peek(request, route, options = {}) {
  const policy = options.policy || policies[route];
  if (!policy) throw new Error("No rate limit policy for this route.");
  const env = options.env || process.env;
  const pool = options.pool || database.pool;
  const subject = options.subject || `ip:${clientIp(request, env)}`;
  const key = createHash("sha256").update(`${route}:${subject}`).digest("hex");
  const refill = policy.capacity / policy.periodSeconds;
  if (!pool) {
    const now = Date.now();
    const bucket = localBuckets.get(key);
    const available = bucket
      ? Math.min(
          policy.capacity,
          bucket.tokens + Math.max(0, (now - bucket.updatedAt) / 1000) * refill,
        )
      : policy.capacity;
    return usageOf(policy, available);
  }
  if (!options.pool) await database.ensureSchema();
  const result = await pool.query(
    `SELECT LEAST($2::double precision, tokens +
      GREATEST(0, EXTRACT(EPOCH FROM now() - updated_at)) * $3::double precision) AS available
    FROM api_rate_limits WHERE bucket_key = $1`,
    [key, policy.capacity, refill],
  );
  return usageOf(
    policy,
    result.rows[0] ? Number(result.rows[0].available) : policy.capacity,
  );
}

function localBucketCount() {
  return localBuckets.size;
}

module.exports = {
  policies,
  clientIp,
  consume,
  peek,
  prune,
  localBucketCount,
  bucketTtlSeconds,
};
