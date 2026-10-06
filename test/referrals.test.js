const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const database = require("../src/database");
const referrals = require("../src/referrals");
const { renderInviteHtml } = require("../oldui/server");

test("invite links reveal a username but never an email, with crawlable previews", () => {
  const template = fs.readFileSync(
    path.join(__dirname, "../oldui/index.html"),
    "utf8",
  );
  const html = renderInviteHtml(
    template,
    { username: "Jethro<dev>", email: "private@example.com" },
    "AbCdEf123_-x",
    "https://thepromptdock.vercel.app/invite/AbCdEf123_-x",
    "https://thepromptdock.vercel.app/social-card.png",
  );
  assert.match(html, /Jethro&lt;dev&gt; invited you to PromptDock/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:url"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /data-invite-code="AbCdEf123_-x"/);
  assert.doesNotMatch(html, /private@example.com/);
});

test("only verified referrals increase AI and voice hourly budgets, capped at five", async () => {
  const original = { pool: database.pool, ensureSchema: database.ensureSchema };
  let verified = 0;
  database.ensureSchema = async () => {};
  database.pool = {
    async query(sql) {
      assert.match(sql, /email_verified_at IS NOT NULL/);
      return { rows: [{ verified }] };
    },
  };
  try {
    const user = { id: "owner" };
    assert.equal(await referrals.rewardLevel(user), 0);
    assert.deepEqual(referrals.rateOptions("/api/run", user, 0), {
      subject: "user:owner",
    });
    verified = 3;
    const level = await referrals.rewardLevel(user);
    assert.equal(level, 3);
    assert.equal(
      referrals.rateOptions("/api/idea-to-prompt", user, level).policy.capacity,
      26,
    );
    assert.equal(
      referrals.rateOptions("/api/run", user, level).policy.capacity,
      26,
    );
    assert.equal(
      referrals.rateOptions("/api/enhance", user, level).policy.capacity,
      36,
    );
    assert.equal(
      referrals.rateOptions("/api/transcribe", user, level).policy.capacity,
      13,
    );
    assert.equal(
      referrals.rateOptions("/api/run", user, level).subject,
      "user:owner",
    );
    verified = 100;
    assert.equal(await referrals.rewardLevel(user), 5);
    assert.equal(
      referrals.rateOptions("/api/run", user, 100).policy.capacity,
      30,
    );
    assert.equal(
      referrals.rateOptions("/api/auth/login", user, 5).policy,
      undefined,
    );
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
  }
});

test("invalid, unverified, and self-invitations get no attribution", async () => {
  const original = { pool: database.pool, ensureSchema: database.ensureSchema };
  database.ensureSchema = async () => {};
  database.pool = {
    async query(_sql, params) {
      return {
        rows:
          params[0] === "verified1234"
            ? [{ id: "u1", username: null, email: "owner@example.com" }]
            : [],
      };
    },
  };
  try {
    assert.equal(await referrals.inviterFor("invalid"), null);
    assert.equal(await referrals.inviterFor("pending12345"), null);
    assert.equal(
      await referrals.inviterFor("verified1234", "owner@example.com"),
      null,
    );
    assert.equal(
      (await referrals.inviterFor("verified1234", "friend@example.com")).id,
      "u1",
    );
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
  }
});

test("the invite code remains stable and the dialog counts pending versus verified friends", async () => {
  const original = { pool: database.pool, ensureSchema: database.ensureSchema };
  let savedCode = null;
  database.ensureSchema = async () => {};
  database.pool = {
    async query(sql, params) {
      if (sql.startsWith("SELECT referral_code FROM users"))
        return { rows: [{ referral_code: savedCode }] };
      if (sql.startsWith("UPDATE users SET referral_code")) {
        savedCode ||= params[1];
        return { rows: [{ referral_code: savedCode }] };
      }
      if (sql.includes("count(*) FILTER"))
        return { rows: [{ total: 3, verified: 2 }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  try {
    const first = await referrals.summary({ id: "owner" });
    const second = await referrals.summary({ id: "owner" });
    assert.match(first.code, /^[A-Za-z0-9_-]{12}$/);
    assert.equal(second.code, first.code);
    assert.deepEqual(
      {
        total: first.total,
        verified: first.verified,
        rewardLevel: first.rewardLevel,
      },
      { total: 3, verified: 2, rewardLevel: 2 },
    );
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
  }
});
