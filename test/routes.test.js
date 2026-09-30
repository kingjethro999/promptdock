const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const handleRequest = require("../src/server");
const database = require("../src/database");
const auth = require("../src/auth");
const rateLimit = require("../src/rate-limit");
const settings = require("../src/settings");
const ai = require("../src/ai");

async function withServer(stubs, run) {
  const originals = [];
  for (const [target, name, replacement] of stubs) {
    originals.push([target, name, target[name]]);
    target[name] = replacement;
  }
  const server = http.createServer(handleRequest);
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [target, name, original] of originals) target[name] = original;
  }
}

function send(base, path, method = "GET", body, origin) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("account routes dispatch registration, login, verification, and reset with safe cookies", async () => {
  const calls = [];
  const stubs = [
    [database, "configured", true],
    [
      auth,
      "register",
      async (body) => {
        calls.push(["register", body.email]);
        return { pending: true, email: body.email };
      },
    ],
    [
      auth,
      "login",
      async (body) => {
        calls.push(["login", body.email]);
        return {
          user: { id: "u1", email: body.email },
          cookie: "promptdock_session=abc; HttpOnly; Path=/; SameSite=Lax",
        };
      },
    ],
    [
      auth,
      "forgotPassword",
      async (body) => {
        calls.push(["forgot", body.email]);
        return { ok: true };
      },
    ],
    [
      auth,
      "consumeToken",
      async (token, purpose, password) => {
        calls.push([purpose, token, password]);
        return { ok: true };
      },
    ],
    [auth, "currentUser", async () => null],
    [rateLimit, "consume", async () => ({ allowed: true, retryAfter: 60 })],
  ];
  await withServer(stubs, async (base) => {
    const register = await send(base, "/api/auth/register", "POST", {
      email: "hello@example.com",
      password: "long-password",
    });
    assert.equal(register.status, 200);
    assert.deepEqual(await register.json(), {
      pending: true,
      email: "hello@example.com",
    });
    const login = await send(base, "/api/auth/login", "POST", {
      email: "hello@example.com",
      password: "long-password",
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.deepEqual(await login.json(), {
      user: { id: "u1", email: "hello@example.com" },
    });
    assert.equal(
      (
        await send(base, "/api/auth/forgot", "POST", {
          email: "hello@example.com",
        })
      ).status,
      200,
    );
    assert.equal(
      (await send(base, "/api/auth/verify", "POST", { token: "verify-token" }))
        .status,
      200,
    );
    assert.equal(
      (
        await send(base, "/api/auth/reset", "POST", {
          token: "reset-token",
          password: "new-long-password",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send(base, "/api/auth/change-password", "POST", {
          currentPassword: "old",
          newPassword: "new",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await send(
          base,
          "/api/auth/register",
          "POST",
          { email: "hello@example.com" },
          "https://attacker.example",
        )
      ).status,
      403,
    );
  });
  assert.deepEqual(calls, [
    ["register", "hello@example.com"],
    ["login", "hello@example.com"],
    ["forgot", "hello@example.com"],
    ["verify", "verify-token", undefined],
    ["reset", "reset-token", "new-long-password"],
  ]);
});

test("auth routes answer 429 with Retry-After once their limit is reached", async () => {
  let allowed = false;
  const stubs = [
    [database, "configured", true],
    [
      auth,
      "login",
      async () => {
        throw new Error("login should not run while limited");
      },
    ],
    [auth, "forgotPassword", async (body) => ({ ok: true, email: body.email })],
    [rateLimit, "consume", async () => ({ allowed, retryAfter: 60 })],
  ];
  await withServer(stubs, async (base) => {
    const blocked = await send(base, "/api/auth/login", "POST", {
      email: "hello@example.com",
      password: "long-password",
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after"), "60");
    assert.match((await blocked.json()).error, /Too many attempts/);
    allowed = true;
    assert.equal(
      (
        await send(base, "/api/auth/forgot", "POST", {
          email: "hello@example.com",
        })
      ).status,
      200,
    );
  });
});

test("library routes enforce account ownership and dispatch CRUD, sharing, and revisions", async () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  const publicId = "223e4567-e89b-42d3-a456-426614174000";
  const calls = [];
  const prompt = {
    id,
    name: "Example",
    data: { task: "Build something" },
    tags: ["test"],
  };
  let signedIn = true;
  const stubs = [
    [database, "configured", true],
    [database, "accountKey", () => "owner-key"],
    [
      auth,
      "currentUser",
      async () => (signedIn ? { id: "u1", email: "hello@example.com" } : null),
    ],
    [
      database,
      "listPrompts",
      async (key, options) => {
        calls.push(["list", key, options]);
        return { prompts: [prompt], total: 1 };
      },
    ],
    [
      database,
      "putPrompt",
      async (key, body) => {
        calls.push(["put", key, body.id]);
        return prompt;
      },
    ],
    [
      database,
      "deletePrompt",
      async (key, promptId) => {
        calls.push(["delete", key, promptId]);
      },
    ],
    [
      database,
      "setPromptPublic",
      async (key, promptId, published) => {
        calls.push(["publish", key, promptId, published]);
        return { ...prompt, publicId };
      },
    ],
    [
      database,
      "getPublicPrompt",
      async (value) => {
        calls.push(["public", value]);
        return { ...prompt, publicId };
      },
    ],
    [
      database,
      "forkPublicPrompt",
      async (key, value) => {
        calls.push(["fork", key, value]);
        return prompt;
      },
    ],
    [
      database,
      "listRevisions",
      async (key, promptId) => {
        calls.push(["history", key, promptId]);
        return [{ revisionId: "1", name: "Old" }];
      },
    ],
    [
      database,
      "restoreRevision",
      async (key, promptId, revisionId) => {
        calls.push(["restore", key, promptId, revisionId]);
        return prompt;
      },
    ],
    [
      database,
      "duplicatePrompt",
      async (key, promptId) => {
        calls.push(["duplicate", key, promptId]);
        return prompt;
      },
    ],
  ];
  await withServer(stubs, async (base) => {
    let response = await send(base, "/api/prompts?q=game&offset=100");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).total, 1);
    assert.equal((await send(base, "/api/prompts", "PUT", prompt)).status, 200);
    assert.equal(
      (
        await send(base, `/api/prompts/${id}/public`, "PATCH", {
          published: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await send(base, `/api/prompts/${id}/revisions`)).status,
      200,
    );
    assert.equal(
      (await send(base, `/api/prompts/${id}/revisions/1/restore`, "POST"))
        .status,
      200,
    );
    assert.equal(
      (await send(base, `/api/prompts/${id}/duplicate`, "POST")).status,
      201,
    );
    assert.equal(
      (await send(base, `/api/public/prompts/${publicId}`)).status,
      200,
    );
    assert.equal(
      (await send(base, `/api/public/prompts/${publicId}/fork`, "POST")).status,
      200,
    );
    assert.equal(
      (await send(base, `/api/prompts/${id}`, "DELETE")).status,
      200,
    );
    signedIn = false;
    assert.equal((await send(base, "/api/prompts")).status, 401);
    assert.equal(
      (await send(base, `/api/public/prompts/${publicId}/fork`, "POST")).status,
      401,
    );
  });
  assert.deepEqual(calls, [
    ["list", "owner-key", { q: "game", offset: "100" }],
    ["put", "owner-key", id],
    ["publish", "owner-key", id, true],
    ["history", "owner-key", id],
    ["restore", "owner-key", id, "1"],
    ["duplicate", "owner-key", id],
    ["public", publicId],
    ["fork", "owner-key", publicId],
    ["delete", "owner-key", id],
  ]);
});

test("the run endpoint executes a prompt for the signed-in account", async () => {
  let signedIn = true;
  const stubs = [
    [database, "configured", true],
    [
      auth,
      "currentUser",
      async () => (signedIn ? { id: "u1", email: "hello@example.com" } : null),
    ],
    [
      settings,
      "effectiveEnv",
      async () => ({
        AI_PROVIDER_ORDER: "groq",
        GROQ_API_KEY: "test",
        GROQ_MODEL: "test",
      }),
    ],
    [rateLimit, "consume", async () => ({ allowed: true, retryAfter: 60 })],
    [
      ai,
      "runPrompt",
      async (body) => ({
        text: `ran:${body.prompt}`,
        provider: "groq",
      }),
    ],
  ];
  await withServer(stubs, async (base) => {
    const ok = await send(base, "/api/run", "POST", {
      prompt: "Task: say hello",
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), {
      text: "ran:Task: say hello",
      provider: "groq",
    });
    const missingTask = await send(base, "/api/run", "POST", { prompt: "" });
    assert.equal(missingTask.status, 400);
    signedIn = false;
    const signedOut = await send(base, "/api/run", "POST", {
      prompt: "Task: say hello",
    });
    assert.equal(signedOut.status, 401);
  });
});
