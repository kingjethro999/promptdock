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
      "listTags",
      async (key) => {
        calls.push(["tags", key]);
        return [{ tag: "test", count: 1 }];
      },
    ],
    [
      database,
      "exportPrompts",
      async (key) => {
        calls.push(["export", key]);
        return [prompt];
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
    response = await send(
      base,
      "/api/prompts?tag=work&sort=name&q=game&offset=0",
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).total, 1);
    response = await send(base, "/api/prompts/tags");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      tags: [{ tag: "test", count: 1 }],
    });
    response = await send(base, "/api/prompts/export");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { prompts: [prompt] });
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
    [
      "list",
      "owner-key",
      { q: "game", offset: "100", tag: null, sort: undefined },
    ],
    [
      "list",
      "owner-key",
      { q: "game", offset: "0", tag: "work", sort: "name" },
    ],
    ["tags", "owner-key"],
    ["export", "owner-key"],
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

test("session and account-deletion routes need a signed-in account", async () => {
  const sessionId = "333e4567-e89b-42d3-a456-426614174000";
  let signedIn = true;
  const calls = [];
  const stubs = [
    [database, "configured", true],
    [
      auth,
      "currentUser",
      async () => (signedIn ? { id: "u1", email: "hello@example.com" } : null),
    ],
    [
      auth,
      "listSessions",
      async (userId) => {
        calls.push(["list", userId]);
        return [{ sessionId, userAgent: "Chrome", current: true }];
      },
    ],
    [
      auth,
      "revokeSession",
      async (userId, id) => {
        calls.push(["revoke", userId, id]);
        return { revoked: id === sessionId, current: false };
      },
    ],
    [
      auth,
      "deleteAccount",
      async (user, body) => {
        calls.push(["delete", user.id, body.password]);
      },
    ],
    [rateLimit, "consume", async () => ({ allowed: true, retryAfter: 60 })],
  ];
  await withServer(stubs, async (base) => {
    let response = await send(base, "/api/auth/sessions");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      sessions: [{ sessionId, userAgent: "Chrome", current: true }],
    });
    response = await send(base, `/api/auth/sessions/${sessionId}`, "DELETE");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, current: false });
    response = await send(base, "/api/auth/sessions/not-a-uuid", "DELETE");
    assert.equal(response.status, 404);
    response = await send(base, "/api/auth/delete-account", "POST", {
      password: "long-password",
    });
    assert.equal(response.status, 200);
    signedIn = false;
    assert.equal((await send(base, "/api/auth/sessions")).status, 401);
    assert.equal(
      (
        await send(base, "/api/auth/delete-account", "POST", {
          password: "long-password",
        })
      ).status,
      401,
    );
  });
  assert.deepEqual(calls, [
    ["list", "u1"],
    ["revoke", "u1", sessionId],
    ["revoke", "u1", "not-a-uuid"],
    ["delete", "u1", "long-password"],
  ]);
});

test("usage endpoint reports the current AI budgets", async () => {
  const stubs = [
    [rateLimit, "consume", async () => ({ allowed: true, retryAfter: 60 })],
    [
      rateLimit,
      "peek",
      async (request, route) => ({
        capacity: 20,
        used: 5,
        remaining: 15,
        resetsIn: 120,
        route,
      }),
    ],
    [auth, "currentUser", async () => null],
  ];
  await withServer(stubs, async (base) => {
    const response = await send(base, "/api/usage");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.usage.length, 4);
    assert.deepEqual(body.usage[0], {
      route: "/api/run",
      capacity: 20,
      used: 5,
      remaining: 15,
      resetsIn: 120,
    });
    assert.deepEqual(
      body.usage.map((item) => item.route),
      ["/api/run", "/api/enhance", "/api/idea-to-prompt", "/api/transcribe"],
    );
  });
});

test("settings routes manage saved providers and the active choice", async () => {
  const calls = [];
  let signedIn = true;
  const shape = {
    available: true,
    providers: [
      {
        providerId: "e61f5f0a-2c3d-4a5b-8c7d-9e0f1a2b3c4d",
        name: "Work Groq",
        provider: "groq",
        model: "openai/gpt-oss-120b",
        baseUrl: "",
        active: true,
        updatedAt: "2026-09-30T00:00:00Z",
      },
    ],
    activeProviderId: "e61f5f0a-2c3d-4a5b-8c7d-9e0f1a2b3c4d",
    provider: "groq",
    model: "openai/gpt-oss-120b",
    hasKey: true,
    updatedAt: "2026-09-30T00:00:00Z",
  };
  const stubs = [
    [database, "configured", true],
    [
      auth,
      "currentUser",
      async () => (signedIn ? { id: "u1", email: "hello@example.com" } : null),
    ],
    [
      settings,
      "getSettings",
      async (id) => {
        calls.push(["get", id]);
        return shape;
      },
    ],
    [
      settings,
      "saveProvider",
      async (id, body) => {
        calls.push(["save", id, body]);
        return shape;
      },
    ],
    [
      settings,
      "setActiveProvider",
      async (id, body) => {
        calls.push(["active", id, body]);
        return shape;
      },
    ],
    [
      settings,
      "removeProvider",
      async (id, providerId) => {
        calls.push(["remove", id, providerId]);
        return shape;
      },
    ],
    [
      settings,
      "saveSettings",
      async (id, body) => {
        calls.push(["legacySave", id, body]);
        return shape;
      },
    ],
    [
      settings,
      "deleteSettings",
      async (id) => {
        calls.push(["legacyDelete", id]);
        return shape;
      },
    ],
  ];
  await withServer(stubs, async (base) => {
    const listed = await send(base, "/api/settings");
    assert.equal(listed.status, 200);
    assert.deepEqual(await listed.json(), shape);

    const created = await send(base, "/api/settings/providers", "POST", {
      name: "Work Groq",
      provider: "openai",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "llama-3.3-70b",
      apiKey: "personal-key",
    });
    assert.equal(created.status, 200);

    const updated = await send(
      base,
      "/api/settings/providers/e61f5f0a-2c3d-4a5b-8c7d-9e0f1a2b3c4d",
      "PUT",
      { name: "Work Groq", provider: "groq", model: "openai/gpt-oss-120b" },
    );
    assert.equal(updated.status, 200);

    const removed = await send(
      base,
      "/api/settings/providers/e61f5f0a-2c3d-4a5b-8c7d-9e0f1a2b3c4d",
      "DELETE",
    );
    assert.equal(removed.status, 200);

    const activated = await send(base, "/api/settings/active", "POST", {
      providerId: null,
    });
    assert.equal(activated.status, 200);

    const legacySave = await send(base, "/api/settings", "PUT", {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: "personal-key",
    });
    assert.equal(legacySave.status, 200);

    const legacyDelete = await send(base, "/api/settings", "DELETE");
    assert.equal(legacyDelete.status, 200);

    const unknown = await send(base, "/api/settings/nope");
    assert.equal(unknown.status, 404);

    signedIn = false;
    const denied = await send(base, "/api/settings");
    assert.equal(denied.status, 401);
    signedIn = true;

    assert.deepEqual(
      calls.map((call) => call[0]),
      ["get", "save", "save", "remove", "active", "legacySave", "legacyDelete"],
    );
    assert.equal(calls[1][1], "u1");
    assert.deepEqual(calls[1][2], {
      name: "Work Groq",
      provider: "openai",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "llama-3.3-70b",
      apiKey: "personal-key",
    });
    assert.equal(
      calls[2][2].providerId,
      "e61f5f0a-2c3d-4a5b-8c7d-9e0f1a2b3c4d",
    );
    assert.deepEqual(calls[3][2], "e61f5f0a-2c3d-4a5b-8c7d-9e0f1a2b3c4d");
    assert.deepEqual(calls[4][2], { providerId: null });
    assert.equal(calls[5][2].provider, "groq");
  });
});

test("settings validation errors return their own status and message", async () => {
  const stubs = [
    [database, "configured", true],
    [
      auth,
      "currentUser",
      async () => ({ id: "u1", email: "hello@example.com" }),
    ],
    [
      settings,
      "saveProvider",
      async () => {
        const error = new Error("Enter an API key for this provider.");
        error.status = 400;
        throw error;
      },
    ],
  ];
  await withServer(stubs, async (base) => {
    const invalid = await send(base, "/api/settings/providers", "POST", {
      name: "Work",
      provider: "groq",
      model: "openai/gpt-oss-120b",
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), {
      error: "Enter an API key for this provider.",
    });

    const notJson = await fetch(`${base}/api/settings/providers`, {
      method: "POST",
      body: "{}",
    });
    assert.equal(notJson.status, 415);

    const missingOrigin = await fetch(`${base}/api/settings/active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ providerId: null }),
    });
    assert.equal(missingOrigin.status, 403);
  });
});
