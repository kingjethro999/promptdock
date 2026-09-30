const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clientIp,
  consume,
  peek,
  policies,
  prune,
  localBucketCount,
  bucketTtlSeconds,
} = require("../src/rate-limit");

test("client IP uses Vercel forwarding only on Vercel", () => {
  const request = {
    headers: {
      "x-vercel-forwarded-for": "198.51.100.9",
      "x-forwarded-for": "203.0.113.7",
    },
    socket: { remoteAddress: "127.0.0.1" },
  };
  assert.equal(clientIp(request, { VERCEL: "1" }), "198.51.100.9");
  assert.equal(clientIp(request, {}), "127.0.0.1");
});

test("token bucket allows its capacity then rejects until refilled", async () => {
  const request = { headers: {}, socket: { remoteAddress: "192.0.2.42" } };
  const policy = { capacity: 2, periodSeconds: 100000 };
  assert.equal(
    (await consume(request, "/api/idea-to-prompt", { policy, env: {} }))
      .allowed,
    true,
  );
  assert.equal(
    (await consume(request, "/api/idea-to-prompt", { policy, env: {} }))
      .allowed,
    true,
  );
  const rejected = await consume(request, "/api/idea-to-prompt", {
    policy,
    env: {},
  });
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.retryAfter, 50000);
});

test("a signed-in subject keeps its own bucket apart from other users and IPs", async () => {
  const request = { headers: {}, socket: { remoteAddress: "192.0.2.9" } };
  const policy = { capacity: 1, periodSeconds: 100000 };
  const options = { policy, env: {} };
  assert.equal(
    (
      await consume(request, "/api/enhance", {
        ...options,
        subject: "user:aaa",
      })
    ).allowed,
    true,
  );
  assert.equal(
    (
      await consume(request, "/api/enhance", {
        ...options,
        subject: "user:aaa",
      })
    ).allowed,
    false,
  );
  assert.equal(
    (
      await consume(request, "/api/enhance", {
        ...options,
        subject: "user:bbb",
      })
    ).allowed,
    true,
  );
  assert.equal((await consume(request, "/api/enhance", options)).allowed, true);
});

test("shared bucket query stores only a hashed address", async () => {
  let argumentsSeen;
  const request = {
    headers: { "x-forwarded-for": "198.51.100.9" },
    socket: {},
  };
  const pool = {
    query: async (_sql, args) => {
      argumentsSeen = args;
      return { rowCount: 0 };
    },
  };
  const result = await consume(request, "/api/transcribe", {
    pool,
    env: { VERCEL: "1" },
  });
  assert.equal(result.allowed, false);
  assert.equal(argumentsSeen.length, 3);
  assert.match(argumentsSeen[0], /^[a-f0-9]{64}$/);
  assert.ok(!argumentsSeen[0].includes("198.51.100.9"));
});

test("the shared bucket key never stores the raw account id", async () => {
  let argumentsSeen;
  const request = { headers: {}, socket: {} };
  const pool = {
    query: async (_sql, args) => {
      argumentsSeen = args;
      return { rowCount: 0 };
    },
  };
  await consume(request, "/api/idea-to-prompt", {
    pool,
    env: {},
    subject: "user:12345678-1234-1234-1234-123456789012",
  });
  assert.match(argumentsSeen[0], /^[a-f0-9]{64}$/);
  assert.ok(!argumentsSeen[0].includes("12345678"));
});

test("sign-in, sign-up, and email routes are rate limited", () => {
  for (const route of [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot",
    "/api/auth/resend",
    "/api/auth/reset",
  ]) {
    assert.ok(policies[route], `missing policy for ${route}`);
    assert.ok(policies[route].capacity >= 5);
    assert.ok(policies[route].periodSeconds >= 600);
  }
  assert.equal(bucketTtlSeconds, 3660);
});

test("pruning removes stale local buckets and deletes expired rows", async () => {
  const request = { headers: {}, socket: { remoteAddress: "192.0.2.77" } };
  await consume(request, "/api/auth/login", {
    policy: { capacity: 1, periodSeconds: 1 },
    env: {},
  });
  assert.ok(
    localBucketCount() >= 1,
    "a fresh bucket should exist before its TTL passes",
  );
  const seen = [];
  const pool = {
    query: async (sql, args) => {
      seen.push([sql, args]);
      return { rowCount: 1 };
    },
  };
  await prune({ pool }, Date.now() + (bucketTtlSeconds + 60) * 1000);
  assert.equal(seen.length, 1);
  assert.match(seen[0][0], /^DELETE FROM api_rate_limits/);
  assert.equal(seen[0][1][0], bucketTtlSeconds);
  assert.equal(localBucketCount(), 0);
});

test("test runs share the AI budget", () => {
  assert.deepEqual(policies["/api/run"], {
    capacity: 20,
    periodSeconds: 3600,
  });
});

test("usage peek reports the budget without spending it", async () => {
  const request = { headers: {}, socket: { remoteAddress: "192.0.2.88" } };
  const policy = { capacity: 3, periodSeconds: 100000 };
  const options = { policy, env: {} };
  assert.deepEqual(await peek(request, "/api/run", options), {
    capacity: 3,
    used: 0,
    remaining: 3,
    resetsIn: 0,
  });
  assert.equal((await consume(request, "/api/run", options)).allowed, true);
  const after = await peek(request, "/api/run", options);
  assert.equal(after.used, 1);
  assert.equal(after.remaining, 2);
  assert.ok(after.resetsIn > 0);
  assert.equal((await peek(request, "/api/run", options)).remaining, 2);
  assert.deepEqual(policies["/api/usage"], {
    capacity: 120,
    periodSeconds: 3600,
  });
});
