const { randomBytes } = require("node:crypto");
const database = require("./database");
const { policies } = require("./rate-limit");

const MAX_REWARDS = 5;
const BONUS_PER_REFERRAL = Object.freeze({
  "/api/idea-to-prompt": 2,
  "/api/enhance": 2,
  "/api/run": 2,
  "/api/transcribe": 1,
});

function validCode(code) {
  return typeof code === "string" && /^[A-Za-z0-9_-]{12}$/.test(code);
}

async function inviterFor(code, email = null) {
  if (!validCode(code)) return null;
  await database.ensureSchema();
  const result = await database.pool.query(
    "SELECT id, username, email FROM users WHERE referral_code = $1 AND email_verified_at IS NOT NULL",
    [code],
  );
  const inviter = result.rows[0] || null;
  return inviter && inviter.email !== email ? inviter : null;
}

async function summary(user) {
  await database.ensureSchema();
  let result = await database.pool.query(
    "SELECT referral_code FROM users WHERE id = $1",
    [user.id],
  );
  if (!result.rows[0]) throw new Error("Account unavailable.");
  let code = result.rows[0].referral_code;
  if (!code) {
    const candidate = randomBytes(9).toString("base64url");
    result = await database.pool.query(
      "UPDATE users SET referral_code = $2 WHERE id = $1 AND referral_code IS NULL RETURNING referral_code",
      [user.id, candidate],
    );
    code = result.rows[0]?.referral_code;
    if (!code) {
      result = await database.pool.query(
        "SELECT referral_code FROM users WHERE id = $1",
        [user.id],
      );
      code = result.rows[0]?.referral_code;
    }
  }
  const counts = await database.pool.query(
    `SELECT count(*)::integer AS total,
      count(*) FILTER (WHERE email_verified_at IS NOT NULL)::integer AS verified
    FROM users WHERE referred_by = $1`,
    [user.id],
  );
  return {
    code,
    total: Number(counts.rows[0]?.total || 0),
    verified: Number(counts.rows[0]?.verified || 0),
    rewardLevel: Math.min(MAX_REWARDS, Number(counts.rows[0]?.verified || 0)),
    maxRewards: MAX_REWARDS,
  };
}

async function rewardLevel(user) {
  if (!user || !database.pool) return 0;
  await database.ensureSchema();
  const result = await database.pool.query(
    "SELECT count(*)::integer AS verified FROM users WHERE referred_by = $1 AND email_verified_at IS NOT NULL",
    [user.id],
  );
  return Math.min(MAX_REWARDS, Number(result.rows[0]?.verified || 0));
}

function rateOptions(route, user, level = 0) {
  if (!user) return {};
  const earned = Math.min(MAX_REWARDS, Math.max(0, Number(level) || 0));
  const options = { subject: `user:${user.id}` };
  if (earned && BONUS_PER_REFERRAL[route]) {
    options.policy = {
      ...policies[route],
      capacity: policies[route].capacity + BONUS_PER_REFERRAL[route] * earned,
    };
  }
  return options;
}

module.exports = {
  MAX_REWARDS,
  BONUS_PER_REFERRAL,
  validCode,
  inviterFor,
  summary,
  rewardLevel,
  rateOptions,
};
