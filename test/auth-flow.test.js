const test = require("node:test");
const assert = require("node:assert/strict");
const database = require("../src/database");
const mailer = require("../src/mailer");
const auth = require("../src/auth");
const firebaseAdmin = require("../src/firebase-admin");

function fakeAuthDatabase() {
  const users = new Map();
  const tokens = new Map();
  const sessions = new Map();
  const identities = [];
  async function query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };
    if (
      sql.startsWith(
        "SELECT id, username, email FROM users WHERE referral_code",
      )
    ) {
      const user = [...users.values()].find(
        (entry) => entry.referral_code === params[0] && entry.email_verified_at,
      );
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }
    if (sql.startsWith("INSERT INTO users") && !sql.includes("NULL, now()")) {
      const user = {
        id: params[0],
        email: params[1],
        username: params[2],
        password_hash: params[3],
        referred_by: params[4] || null,
        failed_logins: 0,
        locked_until: null,
        email_verified_at: null,
      };
      users.set(user.email, user);
      return {
        rows: [{ id: user.id, email: user.email, username: user.username }],
        rowCount: 1,
      };
    }
    if (sql.startsWith("SELECT 1 FROM users WHERE lower(username)")) {
      const wanted = String(params[0]).toLowerCase();
      for (const user of users.values())
        if (
          String(user.username || "").toLowerCase() === wanted &&
          (!params[1] || user.id !== params[1])
        )
          return { rows: [{ taken: true }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("UPDATE users SET username = $1")) {
      for (const user of users.values())
        if (user.id === params[1]) user.username = params[0];
      return { rows: [], rowCount: 1 };
    }
    if (
      sql.startsWith(
        "SELECT users.id, users.email, users.username FROM sessions",
      )
    ) {
      const userId = sessions.get(params[0]);
      const user = [...users.values()].find(
        (entry) => entry.id === userId && entry.email_verified_at,
      );
      return {
        rows: user
          ? [{ id: user.id, email: user.email, username: user.username }]
          : [],
        rowCount: user ? 1 : 0,
      };
    }
    if (sql.startsWith("SELECT created_at FROM auth_tokens"))
      return { rows: [], rowCount: 0 };
    if (sql.startsWith("DELETE FROM auth_tokens WHERE user_id")) {
      for (const [hash, token] of tokens)
        if (
          token.user_id === params[0] &&
          (params.length === 1 || token.purpose === params[1])
        )
          tokens.delete(hash);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO auth_tokens")) {
      tokens.set(params[0], {
        user_id: params[1],
        purpose: params[2],
        expiresAt: Date.now() + params[3] * 3600000,
        used: false,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT tokens.user_id, tokens.expires_at > now()")) {
      const token = tokens.get(params[0]);
      const user =
        token?.purpose === "verify" &&
        [...users.values()].find((entry) => entry.id === token.user_id);
      return {
        rows: user
          ? [
              {
                user_id: user.id,
                live: !token.used && token.expiresAt > Date.now(),
                used: token.used,
                email: user.email,
                username: user.username,
              },
            ]
          : [],
        rowCount: user ? 1 : 0,
      };
    }
    if (sql.startsWith("UPDATE auth_tokens SET expires_at = created_at")) {
      tokens.get(params[0]).used = true;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT users.id, users.email FROM auth_tokens")) {
      const token = tokens.get(params[0]);
      const user =
        token?.purpose === "verify" &&
        [...users.values()].find(
          (entry) => entry.id === token.user_id && !entry.email_verified_at,
        );
      return {
        rows: user ? [{ id: user.id, email: user.email }] : [],
        rowCount: user ? 1 : 0,
      };
    }
    if (sql.includes("FROM auth_identities identities JOIN users")) {
      const identity = identities.find(
        (entry) =>
          entry.provider === params[0] &&
          (entry.provider_uid === params[1] ||
            entry.provider_uid === params[2]),
      );
      const user =
        identity &&
        [...users.values()].find((entry) => entry.id === identity.user_id);
      return {
        rows: user
          ? [{ id: user.id, email: user.email, username: user.username }]
          : [],
        rowCount: user ? 1 : 0,
      };
    }
    if (sql.startsWith("SELECT provider FROM auth_identities")) {
      const rows = identities
        .filter((entry) => entry.user_id === params[0])
        .map((entry) => ({ provider: entry.provider }));
      return { rows, rowCount: rows.length };
    }
    if (sql.startsWith("INSERT INTO auth_identities")) {
      if (
        identities.some(
          (entry) =>
            entry.user_id === params[0] && entry.provider === params[1],
        )
      )
        throw Object.assign(new Error("duplicate"), { code: "23505" });
      identities.push({
        user_id: params[0],
        provider: params[1],
        provider_uid: params[2],
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT id, email, username, email_verified_at FROM")) {
      const user = users.get(params[0]);
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }
    if (
      sql.startsWith("UPDATE users SET email_verified_at = now(), password")
    ) {
      for (const user of users.values())
        if (user.id === params[0]) {
          user.email_verified_at = new Date();
          user.password_hash = null;
        }
      return { rows: [], rowCount: 1 };
    }
    if (
      sql.startsWith(
        "INSERT INTO users (id, email, username, password_hash, email_verified_at",
      )
    ) {
      const user = {
        id: params[0],
        email: params[1],
        username: params[2],
        password_hash: null,
        referred_by: params[3] || null,
        failed_logins: 0,
        locked_until: null,
        email_verified_at: new Date(),
      };
      users.set(user.email, user);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT user_id FROM auth_tokens")) {
      const token = tokens.get(params[0]);
      return {
        rows: token?.purpose === params[1] ? [{ user_id: token.user_id }] : [],
        rowCount: token?.purpose === params[1] ? 1 : 0,
      };
    }
    if (sql.startsWith("UPDATE users SET email_verified_at")) {
      for (const user of users.values())
        if (user.id === params[0]) user.email_verified_at = new Date();
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT id, email, username, password_hash")) {
      const user = users.get(params[0]);
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }
    if (sql.startsWith("UPDATE users SET failed_logins = 0"))
      return { rows: [], rowCount: 1 };
    if (sql.startsWith("UPDATE users SET failed_logins = failed_logins + 1")) {
      for (const user of users.values())
        if (user.id === params[0]) user.failed_logins++;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO sessions")) {
      sessions.set(params[0], params[1]);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT id, email FROM users WHERE email")) {
      const found = users.get(params[0]);
      const user =
        found && sql.includes("email_verified_at IS NULL")
          ? found.email_verified_at
            ? undefined
            : found
          : found;
      return {
        rows: user ? [{ id: user.id, email: user.email }] : [],
        rowCount: user ? 1 : 0,
      };
    }
    if (sql.startsWith("UPDATE users SET password_hash")) {
      for (const user of users.values())
        if (user.id === params[1]) {
          user.password_hash = params[0];
          user.email_verified_at ||= new Date();
        }
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("DELETE FROM sessions WHERE user_id")) {
      for (const [hash, userId] of sessions)
        if (userId === params[0]) sessions.delete(hash);
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected auth query: ${sql.slice(0, 80)}`);
  }
  const client = { query, release() {} };
  return {
    pool: { query, connect: async () => client },
    users,
    tokens,
    sessions,
    identities,
  };
}

test("registration, verification, login, password reset, and session invalidation", async () => {
  const fake = fakeAuthDatabase();
  const original = {
    pool: database.pool,
    ensureSchema: database.ensureSchema,
    configured: mailer.configured,
    sendAuthLink: mailer.sendAuthLink,
  };
  const links = [];
  database.pool = fake.pool;
  database.ensureSchema = async () => {};
  mailer.configured = () => true;
  mailer.sendAuthLink = async (email, purpose, token) => {
    links.push({ email, purpose, token });
  };
  const request = { headers: { "x-forwarded-proto": "https" } };
  try {
    const pending = await auth.register({
      email: "  TEST@example.com ",
      password: "original-long-password",
      username: "KingJethro",
    });
    assert.deepEqual(pending, { pending: true, email: "test@example.com" });
    assert.equal(links[0].purpose, "verify");
    await assert.rejects(
      auth.login(
        { email: "test@example.com", password: "original-long-password" },
        request,
      ),
      (error) => error.code === "verification_required",
    );
    const verified = await auth.verifyEmail(links[0].token, request);
    assert.match(verified.cookie, /HttpOnly.*Secure/);
    fake.sessions.clear();
    await assert.rejects(
      auth.verifyEmail(links[0].token, request),
      (error) => error.code === "token_used",
    );
    const firstSession = await auth.login(
      { email: "test@example.com", password: "original-long-password" },
      request,
    );
    assert.match(firstSession.cookie, /HttpOnly.*Secure/);
    assert.equal(firstSession.user.username, "KingJethro");
    assert.equal(fake.sessions.size, 1);
    await auth.forgotPassword({ email: "test@example.com" });
    assert.equal(links[1].purpose, "reset");
    await auth.consumeToken(
      links[1].token,
      "reset",
      "replacement-long-password",
    );
    assert.equal(fake.sessions.size, 0);
    await assert.rejects(
      auth.login(
        { email: "test@example.com", password: "original-long-password" },
        request,
      ),
      /Invalid email or password/,
    );
    const secondSession = await auth.login(
      { email: "test@example.com", password: "replacement-long-password" },
      request,
    );
    assert.equal(secondSession.user.email, "test@example.com");
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
    mailer.configured = original.configured;
    mailer.sendAuthLink = original.sendAuthLink;
  }
});

test("usernames are unique, validated, and changeable", async () => {
  const fake = fakeAuthDatabase();
  const original = {
    pool: database.pool,
    ensureSchema: database.ensureSchema,
    configured: mailer.configured,
    sendAuthLink: mailer.sendAuthLink,
    setOwnerUsername: database.setOwnerUsername,
  };
  const renames = [];
  database.pool = fake.pool;
  database.ensureSchema = async () => {};
  database.setOwnerUsername = async (userId, username) => {
    renames.push({ userId, username });
    return 1;
  };
  mailer.configured = () => true;
  mailer.sendAuthLink = async () => {};
  try {
    await assert.rejects(
      auth.register({
        email: "first@example.com",
        password: "original-long-password",
        username: "No spaces here",
      }),
      /3-24 letters, numbers, or underscores/,
    );
    await auth.register({
      email: "first@example.com",
      password: "original-long-password",
      username: "KingJethro",
    });
    await assert.rejects(
      auth.register({
        email: "second@example.com",
        password: "original-long-password",
        username: "kingjethro",
      }),
      (error) => error.status === 409 && /taken/.test(error.message),
    );
    const user = {
      id: [...fake.users.values()][0].id,
      email: "first@example.com",
    };
    const renamed = await auth.updateUsername(user, { username: "Jethro_K" });
    assert.equal(renamed.username, "Jethro_K");
    assert.deepEqual(await auth.checkUsername("jethro_k", user.id), {
      username: "jethro_k",
      available: true,
    });
    assert.deepEqual(await auth.checkUsername("Jethro_K"), {
      username: "Jethro_K",
      available: false,
    });
    assert.deepEqual(renames, [{ userId: user.id, username: "Jethro_K" }]);
    await auth.register({
      email: "second@example.com",
      password: "original-long-password",
      username: "kingjethro",
    });
    await assert.rejects(
      auth.updateUsername(user, { username: "KingJethro" }),
      (error) => error.status === 409 && /taken/.test(error.message),
    );
    await assert.rejects(
      auth.updateUsername(user, { username: "no" }),
      /3-24 letters, numbers, or underscores/,
    );
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
    database.setOwnerUsername = original.setOwnerUsername;
    mailer.configured = original.configured;
    mailer.sendAuthLink = original.sendAuthLink;
  }
});

test("database username collisions return a clear conflict", async () => {
  const original = {
    pool: database.pool,
    ensureSchema: database.ensureSchema,
  };
  database.ensureSchema = async () => {};
  database.pool = {
    async query(sql) {
      if (sql.startsWith("SELECT 1 FROM users WHERE lower(username)"))
        return { rows: [] };
      if (
        sql.startsWith("INSERT INTO users") ||
        sql.startsWith("UPDATE users SET username")
      ) {
        const error = new Error("duplicate key");
        error.code = "23505";
        error.constraint = "users_username_key";
        throw error;
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  try {
    await assert.rejects(
      auth.register({
        email: "new@example.com",
        username: "FreshName",
        password: "original-long-password",
      }),
      (error) =>
        error.status === 409 && /username is taken/.test(error.message),
    );
    await assert.rejects(
      auth.updateUsername({ id: "user-1" }, { username: "FreshName" }),
      (error) =>
        error.status === 409 && /username is taken/.test(error.message),
    );
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
  }
});

test("sign-up records a valid inviter while the reward waits for verification", async () => {
  const fake = fakeAuthDatabase();
  const original = {
    pool: database.pool,
    ensureSchema: database.ensureSchema,
    configured: mailer.configured,
    sendAuthLink: mailer.sendAuthLink,
  };
  fake.users.set("owner@example.com", {
    id: "owner-id",
    email: "owner@example.com",
    username: "Owner",
    referral_code: "verified1234",
    email_verified_at: new Date(),
  });
  database.pool = fake.pool;
  database.ensureSchema = async () => {};
  mailer.configured = () => true;
  mailer.sendAuthLink = async () => {};
  try {
    await auth.register({
      email: "friend@example.com",
      username: "Friend",
      password: "long-enough-password",
      referralCode: "verified1234",
    });
    assert.equal(fake.users.get("friend@example.com").referred_by, "owner-id");
    assert.equal(fake.users.get("friend@example.com").email_verified_at, null);
    await auth.register({
      email: "other@example.com",
      username: "Other",
      password: "long-enough-password",
      referralCode: "bad-code",
    });
    assert.equal(fake.users.get("other@example.com").referred_by, null);
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
    mailer.configured = original.configured;
    mailer.sendAuthLink = original.sendAuthLink;
  }
});

/** Runs a test against the in-memory auth store with mail and Firebase faked. */
async function withFakeAuth(run) {
  const fake = fakeAuthDatabase();
  const original = {
    pool: database.pool,
    ensureSchema: database.ensureSchema,
    configured: mailer.configured,
    sendAuthLink: mailer.sendAuthLink,
    getAuth: firebaseAdmin.getAuth,
    firebaseConfigured: firebaseAdmin.configured,
  };
  const links = [];
  const claims = { current: null };
  database.pool = fake.pool;
  database.ensureSchema = async () => {};
  mailer.configured = () => true;
  mailer.sendAuthLink = async (email, purpose, token) => {
    links.push({ email, purpose, token });
  };
  firebaseAdmin.getAuth = () => ({ verifyIdToken: async () => claims.current });
  firebaseAdmin.configured = () => false;
  try {
    await run({ fake, links, claims });
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
    mailer.configured = original.configured;
    mailer.sendAuthLink = original.sendAuthLink;
    firebaseAdmin.getAuth = original.getAuth;
    firebaseAdmin.configured = original.firebaseConfigured;
  }
}

const https = { headers: { "x-forwarded-proto": "https" } };
const googleClaims = (email, uid = "google-uid-1", verified = true) => ({
  uid: `firebase-${uid}`,
  email,
  email_verified: verified,
  firebase: {
    sign_in_provider: "google.com",
    identities: { "google.com": [uid] },
  },
});
const githubClaims = (email, uid = "github-uid-1") => ({
  uid: `firebase-${uid}`,
  email,
  email_verified: false,
  firebase: {
    sign_in_provider: "github.com",
    identities: { "github.com": [uid] },
  },
});
const newAccount = {
  email: "new@example.com",
  password: "original-long-password",
  username: "newperson",
};

test("a valid verification link verifies the account once and signs the user in", () =>
  withFakeAuth(async ({ fake, links }) => {
    await auth.register(newAccount);
    const result = await auth.verifyEmail(links[0].token, https);
    assert.equal(result.user.email, "new@example.com");
    assert.match(result.cookie, /promptdock_session=[a-f0-9]{64}/);
    assert.ok(fake.users.get("new@example.com").email_verified_at);
    assert.equal(fake.sessions.size, 1);
    const session = await auth.login(newAccount, https);
    assert.equal(session.user.username, "newperson");
  }));

test("verification tokens are stored hashed, never as sent", () =>
  withFakeAuth(async ({ fake, links }) => {
    await auth.register(newAccount);
    assert.equal(fake.tokens.has(links[0].token), false);
    assert.equal(fake.tokens.size, 1);
  }));

test("an expired verification link is refused and can request a fresh one", () =>
  withFakeAuth(async ({ fake, links }) => {
    await auth.register(newAccount);
    for (const token of fake.tokens.values()) token.expiresAt = Date.now() - 1;
    await assert.rejects(
      auth.verifyEmail(links[0].token, https),
      (error) => error.code === "token_expired" && error.status === 410,
    );
    assert.equal(fake.users.get("new@example.com").email_verified_at, null);
    assert.equal(fake.sessions.size, 0);
    assert.deepEqual(await auth.resendVerification({ token: links[0].token }), {
      ok: true,
    });
    assert.equal(links.length, 2);
    assert.notEqual(links[1].token, links[0].token);
    await auth.verifyEmail(links[1].token, https);
    assert.ok(fake.users.get("new@example.com").email_verified_at);
  }));

test("a reused verification link is refused without opening a second session", () =>
  withFakeAuth(async ({ fake, links }) => {
    await auth.register(newAccount);
    await auth.verifyEmail(links[0].token, https);
    await assert.rejects(
      auth.verifyEmail(links[0].token, https),
      (error) => error.code === "token_used" && error.status === 409,
    );
    assert.equal(fake.sessions.size, 1);
  }));

test("unknown and malformed verification links are refused", () =>
  withFakeAuth(async ({ links }) => {
    await assert.rejects(
      auth.verifyEmail("f".repeat(64), https),
      (error) => error.code === "token_invalid",
    );
    await assert.rejects(
      auth.verifyEmail("not-a-token", https),
      (error) => error.code === "token_invalid",
    );
    assert.deepEqual(await auth.resendVerification({ token: "f".repeat(64) }), {
      ok: true,
    });
    assert.deepEqual(
      await auth.resendVerification({ email: "nobody@example.com" }),
      { ok: true },
    );
    assert.equal(links.length, 0);
  }));

test("a first-time Google sign-in creates a verified account with no email step", () =>
  withFakeAuth(async ({ fake, links, claims }) => {
    claims.current = googleClaims("Fresh@Gmail.com");
    const result = await auth.firebaseLogin({ idToken: "token" }, https);
    assert.equal(result.user.email, "fresh@gmail.com");
    assert.match(result.cookie, /promptdock_session=/);
    const user = fake.users.get("fresh@gmail.com");
    assert.ok(user.email_verified_at);
    assert.equal(user.password_hash, null);
    assert.equal(links.length, 0);
    assert.equal(fake.identities.length, 1);
    assert.ok(await auth.currentUser({ headers: { cookie: result.cookie } }));
    const again = await auth.firebaseLogin({ idToken: "token" }, https);
    assert.equal(again.user.id, result.user.id);
    assert.equal(fake.users.size, 1);
  }));

test("Google sign-in joins a verified password account instead of duplicating it", () =>
  withFakeAuth(async ({ fake, links, claims }) => {
    await auth.register(newAccount);
    await auth.verifyEmail(links[0].token, https);
    const hash = fake.users.get("new@example.com").password_hash;
    claims.current = googleClaims("NEW@example.com");
    const result = await auth.firebaseLogin({ idToken: "token" }, https);
    assert.equal(result.user.username, "newperson");
    assert.equal(fake.users.size, 1);
    assert.equal(fake.identities[0].user_id, result.user.id);
    assert.equal(fake.users.get("new@example.com").password_hash, hash);
    await auth.login(newAccount, https);
  }));

test("Google sign-in rescues an unverified password account and retires its unproven password", () =>
  withFakeAuth(async ({ fake, claims }) => {
    await auth.register(newAccount);
    claims.current = googleClaims("new@example.com");
    const result = await auth.firebaseLogin({ idToken: "token" }, https);
    const user = fake.users.get("new@example.com");
    assert.equal(result.user.id, user.id);
    assert.ok(user.email_verified_at);
    assert.equal(user.password_hash, null);
    assert.equal(fake.tokens.size, 0);
    await assert.rejects(
      auth.login(newAccount, https),
      (error) =>
        error.code === "oauth_only" &&
        /uses Google sign-in/.test(error.message),
    );
  }));

test("a provider without a verified email claim cannot join an existing account", () =>
  withFakeAuth(async ({ fake, links, claims }) => {
    await auth.register(newAccount);
    await auth.verifyEmail(links[0].token, https);
    claims.current = githubClaims("new@example.com");
    await assert.rejects(
      auth.firebaseLogin({ idToken: "token" }, https),
      (error) => error.code === "provider_not_linked" && error.status === 409,
    );
    assert.equal(fake.identities.length, 0);
    claims.current = googleClaims("new@example.com", "google-uid-9", false);
    await assert.rejects(
      auth.firebaseLogin({ idToken: "token" }, https),
      /did not provide a verified email/,
    );
  }));

test("the verify-your-email notice is only for unverified password accounts", () =>
  withFakeAuth(async () => {
    await auth.register(newAccount);
    await assert.rejects(
      auth.login(newAccount, https),
      (error) => error.code === "verification_required",
    );
    await assert.rejects(
      auth.login({ ...newAccount, password: "wrong-password-entirely" }, https),
      (error) =>
        error.code === null && /Invalid email or password/.test(error.message),
    );
  }));
