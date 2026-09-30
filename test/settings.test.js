const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const database = require("../src/database");
const settings = require("../src/settings");
const mailer = require("../src/mailer");

test("personal provider keys encrypt, decrypt, and stay bound to one user", () => {
  const env = { BYOK_ENCRYPTION_KEY: randomBytes(32).toString("hex") };
  const key = "provider-example-secret";
  const ciphertext = settings.encryptKey("user-one", key, env);
  assert.ok(!ciphertext.includes(key));
  assert.equal(settings.decryptKey("user-one", ciphertext, env), key);
  assert.throws(() => settings.decryptKey("user-two", ciphertext, env));
});

test("personal provider settings require a supported provider and model", () => {
  assert.deepEqual(
    settings.validateSetting({
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: "example-key",
    }),
    { provider: "groq", model: "openai/gpt-oss-120b", apiKey: "example-key" },
  );
  assert.deepEqual(
    settings.validateSetting({
      provider: "apmix",
      model: "provider/model",
      apiKey: "example-key",
    }),
    { provider: "apmix", model: "provider/model", apiKey: "example-key" },
  );
  assert.throws(() =>
    settings.validateSetting({
      provider: "custom",
      model: "model",
      apiKey: "example-key",
    }),
  );
  assert.throws(() =>
    settings.validateSetting({
      provider: "gemini",
      model: "https://example.com/?x=1",
      apiKey: "example-key",
    }),
  );
});

test("email links use the configured public origin", () => {
  const env = { APP_URL: "https://promptdock.example" };
  const link = new URL(mailer.authLink("verify", "a".repeat(64), env));
  assert.equal(link.origin, "https://promptdock.example");
  assert.equal(link.searchParams.get("verify"), "a".repeat(64));
  assert.equal(
    mailer.appUrl({ VERCEL_PROJECT_PRODUCTION_URL: "promptdock.example" }),
    "https://promptdock.example",
  );
  assert.equal(
    mailer.configured({
      GMAIL_USER: "owner@example.com",
      GMAIL_APP_PASSWORD: "example",
    }),
    true,
  );
});

test("custom endpoints need a name, a model, and an HTTPS base URL", () => {
  assert.deepEqual(
    settings.validateProvider({
      name: "  Work   Groq  ",
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: "personal-key",
    }),
    {
      name: "Work Groq",
      provider: "groq",
      baseUrl: "",
      model: "openai/gpt-oss-120b",
      apiKey: "personal-key",
    },
  );
  assert.equal(
    settings.validateProvider({
      name: "OpenRouter",
      provider: "openai",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      model: "llama-3.3-70b-instruct",
      apiKey: "personal-key",
    }).baseUrl,
    "https://openrouter.ai/api/v1",
  );
  assert.equal(
    settings.validateProvider({
      name: "Anthropic",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com/v1/messages",
      model: "claude-sonnet-4-5",
      apiKey: "personal-key",
    }).baseUrl,
    "https://api.anthropic.com",
  );
  assert.equal(
    settings.validateProvider({
      name: "Local model",
      provider: "openai",
      baseUrl: "http://localhost:11434/v1",
      model: "llama3",
      apiKey: "personal-key",
    }).baseUrl,
    "http://localhost:11434/v1",
  );
  assert.throws(
    () =>
      settings.validateProvider({
        name: "OpenRouter",
        provider: "openai",
        model: "llama-3.3-70b",
        apiKey: "personal-key",
      }),
    /base URL/,
  );
  assert.throws(
    () =>
      settings.validateProvider({
        name: "OpenRouter",
        provider: "openai",
        baseUrl: "http://api.example.com/v1",
        model: "llama-3.3-70b",
        apiKey: "personal-key",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      settings.validateProvider({
        name: "OpenRouter",
        provider: "openai",
        baseUrl: "https://user:pass@api.example.com/v1",
        model: "llama-3.3-70b",
        apiKey: "personal-key",
      }),
    /username or password/,
  );
  assert.throws(
    () =>
      settings.validateProvider({
        name: "",
        provider: "groq",
        model: "model",
        apiKey: "personal-key",
      }),
    /name/,
  );
  assert.throws(
    () =>
      settings.validateProvider({
        name: "Work",
        provider: "groq",
        model: "",
        apiKey: "personal-key",
      }),
    /model ID/,
  );
  assert.throws(
    () =>
      settings.validateProvider({
        name: "Work",
        provider: "ollama",
        model: "llama3",
        apiKey: "personal-key",
      }),
    /supported provider/,
  );
});

function queuePool(responses, calls) {
  return {
    async query(sql, params) {
      const flat = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: flat, params });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected query: ${flat}`);
      return next;
    },
  };
}

async function withPool(pool, run) {
  const original = database.pool;
  database.pool = pool;
  try {
    return await run();
  } finally {
    database.pool = original;
  }
}

async function withEncryptionKey(run) {
  const previous = process.env.BYOK_ENCRYPTION_KEY;
  process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.BYOK_ENCRYPTION_KEY;
    else process.env.BYOK_ENCRYPTION_KEY = previous;
  }
}

test("saving a provider encrypts the key and marks only it active", async () => {
  await withEncryptionKey(async () => {
    const calls = [];
    const pool = queuePool(
      [
        {
          rows: [
            {
              provider_id: "row-1",
              name: "Groq",
              provider: "groq",
              encrypted_key: "existing-key",
            },
          ],
        },
        {
          rows: [
            {
              provider_id: "row-2",
              name: "OpenRouter",
              provider: "openai",
              base_url: "https://openrouter.ai/api/v1",
              model: "llama-3.3-70b-instruct",
              active: true,
              updated_at: "2026-09-30T00:00:00Z",
            },
          ],
        },
        {
          rows: [
            {
              provider_id: "row-2",
              name: "OpenRouter",
              provider: "openai",
              base_url: "https://openrouter.ai/api/v1",
              model: "llama-3.3-70b-instruct",
              active: true,
              updated_at: "2026-09-30T00:00:00Z",
            },
          ],
        },
      ],
      calls,
    );
    await withPool(pool, async () => {
      const result = await settings.saveProvider("user-1", {
        name: "  OpenRouter ",
        provider: "openai",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        model: "llama-3.3-70b-instruct",
        apiKey: "personal-key",
      });
      assert.equal(calls.length, 3);
      assert.match(calls[0].sql, /FROM user_ai_providers WHERE user_id = \$1/);
      assert.match(calls[1].sql, /INSERT INTO user_ai_providers/);
      assert.match(calls[1].sql, /UPDATE user_ai_providers SET active = false/);
      assert.deepEqual(calls[1].params, [
        "user-1",
        "OpenRouter",
        "openai",
        "https://openrouter.ai/api/v1",
        "llama-3.3-70b-instruct",
        calls[1].params[5],
      ]);
      assert.ok(calls[1].params[5].includes("."));
      assert.ok(!calls[1].params[5].includes("personal-key"));
      assert.equal(result.activeProviderId, "row-2");
      assert.equal(result.available, true);
      assert.equal(result.hasKey, true);
    });
  });
});

test("provider saves reject missing keys, duplicate names, and full lists", async () => {
  await withEncryptionKey(async () => {
    const row = (provider_id, name) => ({
      provider_id,
      name,
      provider: "groq",
      encrypted_key: "existing-key",
    });
    await withPool(queuePool([{ rows: [] }], []), async () => {
      await assert.rejects(
        settings.saveProvider("user-1", {
          name: "New",
          provider: "groq",
          model: "model-id",
        }),
        /Enter an API key/,
      );
    });
    await withPool(
      queuePool([{ rows: [row("row-1", "Groq")] }], []),
      async () => {
        await assert.rejects(
          settings.saveProvider("user-1", {
            name: "groq",
            provider: "groq",
            model: "model-id",
            apiKey: "personal-key",
          }),
          /already have a provider/,
        );
      },
    );
    await withPool(
      queuePool(
        [
          {
            rows: Array.from({ length: settings.maxProviders }, (_, index) =>
              row(`row-${index}`, `Provider ${index}`),
            ),
          },
        ],
        [],
      ),
      async () => {
        await assert.rejects(
          settings.saveProvider("user-1", {
            name: "One too many",
            provider: "groq",
            model: "model-id",
            apiKey: "personal-key",
          }),
          new RegExp(`up to ${settings.maxProviders} providers`),
        );
      },
    );
    await assert.rejects(
      settings.saveProvider("user-1", {
        name: "Missing row",
        provider: "groq",
        model: "model-id",
        apiKey: "personal-key",
        providerId: "not-a-uuid",
      }),
      /Provider not found/,
    );
  });
});

test("switching and deleting saved providers keeps one active entry", async () => {
  const calls = [];
  const providerId = "d2f4a6c8-1b3d-4f5a-9c7e-0a1b2c3d4e5f";
  await withPool(
    queuePool(
      [{ rows: [{ provider_id: providerId }] }, { rows: [] }, { rows: [] }],
      calls,
    ),
    async () => {
      const result = await settings.setActiveProvider("user-1", {
        providerId,
      });
      assert.match(calls[1].sql, /SET active = \(provider_id = \$2::uuid\)/);
      assert.deepEqual(calls[1].params, ["user-1", providerId]);
      assert.equal(result.activeProviderId, null);
    },
  );
  const defaultCalls = [];
  await withPool(
    queuePool([{ rows: [] }, { rows: [] }], defaultCalls),
    async () => {
      const result = await settings.setActiveProvider("user-1", {
        providerId: null,
      });
      assert.match(defaultCalls[0].sql, /SET active = false WHERE user_id/);
      assert.equal(result.activeProviderId, null);
    },
  );
  await assert.rejects(
    settings.setActiveProvider("user-1", { providerId: "nope" }),
    /Provider not found/,
  );
  const deleteCalls = [];
  await withPool(queuePool([{ rows: [] }], deleteCalls), async () => {
    await assert.rejects(
      settings.removeProvider("user-1", "d2f4a6c8-1b3d-4f5a-9c7e-0a1b2c3d4e5f"),
      /Provider not found/,
    );
    assert.match(deleteCalls[0].sql, /DELETE FROM user_ai_providers/);
  });
});

test("the active provider decides the environment sent to the AI layer", async () => {
  const envKey = randomBytes(32).toString("hex");
  const secret = (value) =>
    settings.encryptKey("user-1", value, { BYOK_ENCRYPTION_KEY: envKey });

  const anthropicPool = queuePool(
    [
      {
        rows: [
          {
            provider: "anthropic",
            model: "claude-sonnet-4-5",
            base_url: "https://api.anthropic.com",
            encrypted_key: secret("anthropic-secret"),
          },
        ],
      },
    ],
    [],
  );
  await withPool(anthropicPool, async () => {
    const env = await settings.effectiveEnv("user-1", {
      BYOK_ENCRYPTION_KEY: envKey,
      GROQ_API_KEY: "system-key",
      GROQ_MODEL: "system-model",
    });
    assert.equal(env.ANTHROPIC_API_KEY, "anthropic-secret");
    assert.equal(env.ANTHROPIC_MODEL, "claude-sonnet-4-5");
    assert.equal(env.ANTHROPIC_BASE_URL, "https://api.anthropic.com");
    assert.equal(env.AI_PROVIDER_ORDER, "anthropic");
    assert.equal(env.AI_MAX_FALLBACKS, "0");
    assert.equal(env.GROQ_API_KEY, "system-key");
  });

  const openaiPool = queuePool(
    [
      {
        rows: [
          {
            provider: "openai",
            model: "llama-3.3-70b-instruct",
            base_url: "http://localhost:11434/v1",
            encrypted_key: secret("local-secret"),
          },
        ],
      },
    ],
    [],
  );
  await withPool(openaiPool, async () => {
    const env = await settings.effectiveEnv("user-1", {
      BYOK_ENCRYPTION_KEY: envKey,
    });
    assert.equal(env.OPENAI_API_KEY, "local-secret");
    assert.equal(env.OPENAI_MODEL, "llama-3.3-70b-instruct");
    assert.equal(env.OPENAI_BASE_URL, "http://localhost:11434/v1");
    assert.equal(env.AI_PROVIDER_ORDER, "openai");
  });

  await withPool(queuePool([{ rows: [] }], []), async () => {
    const env = { SYSTEM_ONLY: "1" };
    assert.deepEqual(await settings.effectiveEnv("user-1", env), env);
  });
  const env = { SYSTEM_ONLY: "1" };
  assert.equal(await settings.effectiveEnv(null, env), env);
});
