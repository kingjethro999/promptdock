const test = require("node:test");
const assert = require("node:assert/strict");
const database = require("../src/database");
const mailer = require("../src/mailer");
const auth = require("../src/auth");

function fakeAuthDatabase() {
  const users = new Map();
  const tokens = new Map();
  const sessions = new Map();
  async function query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };
    if (sql.startsWith("INSERT INTO users")) {
      const user = {
        id: params[0],
        email: params[1],
        username: params[2],
        password_hash: params[3],
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
        if (token.user_id === params[0] && token.purpose === params[1])
          tokens.delete(hash);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO auth_tokens")) {
      tokens.set(params[0], { user_id: params[1], purpose: params[2] });
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
      const user = users.get(params[0]);
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
    await auth.consumeToken(links[0].token, "verify");
    await assert.rejects(
      auth.consumeToken(links[0].token, "verify"),
      /invalid or expired/,
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
