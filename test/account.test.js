const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const database = require("../src/database");
const auth = require("../src/auth");

function newToken() {
  return randomBytes(32).toString("hex");
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function fakeAccountDatabase() {
  const users = new Map();
  const sessions = new Map();
  const prompts = new Map();
  const rateRows = new Set();
  async function query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };
    if (sql.startsWith("SELECT password_hash FROM users")) {
      const user = users.get(params[0]);
      return {
        rows: user ? [{ password_hash: user.password_hash }] : [],
        rowCount: user ? 1 : 0,
      };
    }
    if (sql.startsWith("SELECT session_id AS")) {
      const [currentTokenHash, userId] = params;
      const rows = [...sessions.values()]
        .filter(
          (session) =>
            session.user_id === userId && session.expires_at > Date.now(),
        )
        .sort((a, b) => b.created_at - a.created_at)
        .map((session) => ({
          sessionId: session.session_id,
          createdAt: new Date(session.created_at),
          userAgent: session.user_agent,
          current: session.token_hash === currentTokenHash,
        }));
      return { rows, rowCount: rows.length };
    }
    if (
      sql.startsWith(
        "DELETE FROM sessions WHERE user_id = $1 AND session_id = $2 RETURNING",
      )
    ) {
      const [userId, sessionId, currentTokenHash] = params;
      for (const [hash, session] of sessions) {
        if (session.user_id === userId && session.session_id === sessionId) {
          sessions.delete(hash);
          return {
            rows: [{ current: session.token_hash === currentTokenHash }],
            rowCount: 1,
          };
        }
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("DELETE FROM prompts WHERE owner_key")) {
      const removed = prompts.get(params[0]) || 0;
      prompts.delete(params[0]);
      return { rows: [], rowCount: removed };
    }
    if (sql.startsWith("DELETE FROM api_rate_limits")) {
      let removed = 0;
      for (const key of params[0] || []) if (rateRows.delete(key)) removed++;
      return { rows: [], rowCount: removed };
    }
    if (sql.startsWith("DELETE FROM sessions WHERE user_id")) {
      let removed = 0;
      for (const [hash, session] of sessions) {
        if (session.user_id === params[0]) {
          sessions.delete(hash);
          removed++;
        }
      }
      return { rows: [], rowCount: removed };
    }
    if (sql.startsWith("DELETE FROM users WHERE id")) {
      const existed = users.delete(params[0]);
      return { rows: [], rowCount: existed ? 1 : 0 };
    }
    throw new Error(`Unexpected account query: ${sql.slice(0, 70)}`);
  }
  const client = { query, release() {} };
  return {
    pool: { query, connect: async () => client },
    users,
    sessions,
    prompts,
    rateRows,
  };
}

test("sessions list with their device, revoke individually, and an account can be deleted", async () => {
  const fake = fakeAccountDatabase();
  const original = {
    pool: database.pool,
    ensureSchema: database.ensureSchema,
  };
  database.pool = fake.pool;
  database.ensureSchema = async () => {};
  const userId = "111e4567-e89b-42d3-a456-426614174000";
  const ownerKey = database.accountKey(userId);
  const currentToken = newToken();
  const otherToken = newToken();
  const request = {
    headers: { cookie: `promptdock_session=${currentToken}` },
  };
  try {
    fake.users.set(userId, {
      password_hash: await auth.hashPassword("long-password"),
    });
    fake.sessions.set(tokenHash(currentToken), {
      user_id: userId,
      token_hash: tokenHash(currentToken),
      session_id: randomUUID(),
      created_at: Date.now() - 60000,
      expires_at: Date.now() + 60000000,
      user_agent:
        "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    });
    const otherSessionId = randomUUID();
    fake.sessions.set(tokenHash(otherToken), {
      user_id: userId,
      token_hash: tokenHash(otherToken),
      session_id: otherSessionId,
      created_at: Date.now() - 120000,
      expires_at: Date.now() + 60000000,
      user_agent: "curl/8.4.0",
    });

    const sessions = await auth.listSessions(userId, request);
    assert.equal(sessions.length, 2);
    assert.equal(sessions[0].current, true);
    assert.equal(sessions[0].userAgent.includes("Chrome"), true);
    assert.ok(sessions[0].createdAt instanceof Date);
    assert.equal(sessions[1].current, false);

    assert.deepEqual(
      await auth.revokeSession(userId, otherSessionId, request),
      {
        revoked: true,
        current: false,
      },
    );
    assert.equal((await auth.listSessions(userId, request)).length, 1);
    assert.deepEqual(
      await auth.revokeSession(userId, otherSessionId, request),
      { revoked: false, current: false },
    );
    await assert.rejects(auth.revokeSession(userId, "not-a-uuid", request), {
      message: "Invalid session.",
    });

    const otherUserId = "222e4567-e89b-42d3-a456-426614174000";
    const currentSessionId = [...fake.sessions.values()].find(
      (session) => session.token_hash === tokenHash(currentToken),
    ).session_id;
    assert.deepEqual(
      await auth.revokeSession(otherUserId, currentSessionId, request),
      { revoked: false, current: false },
    );

    await assert.rejects(
      auth.deleteAccount({ id: userId }, {}),
      /Enter your password/,
    );
    await assert.rejects(
      auth.deleteAccount({ id: userId }, { password: "wrong-password" }),
      (error) => error.status === 401,
    );

    fake.prompts.set(ownerKey, 4);
    fake.rateRows.add(
      createHash("sha256").update(`/api/run:user:${userId}`).digest("hex"),
    );
    await auth.deleteAccount({ id: userId }, { password: "long-password" });
    assert.equal(fake.users.size, 0);
    assert.equal(fake.sessions.size, 0);
    assert.equal(fake.prompts.size, 0);
    assert.equal(fake.rateRows.size, 0);
  } finally {
    database.pool = original.pool;
    database.ensureSchema = original.ensureSchema;
  }
});
