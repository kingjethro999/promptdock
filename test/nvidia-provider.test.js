const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const database = require("../src/database");
const settings = require("../src/settings");
const { configuredProviders, ideaToPrompt, runPrompt } = require("../src/ai");

const nvidiaEnv = {
  AI_PROVIDER_ORDER: "nvidia",
  NVIDIA_API_KEY: "nvidia-secret",
  NVIDIA_MODEL: "nvidia/nemotron-3.5-super-vl-120b-a12b",
};

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Xi2wAAAAASUVORK5CYII=";

function completion(content, finishReason = "stop") {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content }, finish_reason: finishReason }],
    }),
  };
}

test("NVIDIA is the first configured default provider", () => {
  assert.deepEqual(
    configuredProviders({
      NVIDIA_API_KEY: "nvidia-secret",
      GROQ_API_KEY: "groq-secret",
      GROQ_MODEL: "openai/gpt-oss-120b",
    }),
    ["nvidia", "groq"],
  );
});

test("NVIDIA uses its independent endpoint, model, and authorization", async () => {
  let request;
  await runPrompt(
    { prompt: "Write a useful product summary" },
    nvidiaEnv,
    async (url, options) => {
      request = {
        url,
        headers: options.headers,
        body: JSON.parse(options.body),
      };
      return completion("Summary");
    },
  );

  assert.equal(
    request.url,
    "https://integrate.api.nvidia.com/v1/chat/completions",
  );
  assert.equal(request.headers.Authorization, "Bearer nvidia-secret");
  assert.equal(request.body.model, "nvidia/nemotron-3.5-super-vl-120b-a12b");
});

test("NVIDIA receives OpenAI-compatible image parts", async () => {
  let body;
  await ideaToPrompt(
    { idea: "Describe this interface", images: [tinyPng] },
    nvidiaEnv,
    async (_url, options) => {
      body = JSON.parse(options.body);
      return completion(JSON.stringify({ questions: ["What is the goal?"] }));
    },
  );

  assert.equal(body.messages[1].content[0].type, "text");
  assert.equal(body.messages[1].content[1].type, "image_url");
  assert.equal(body.messages[1].content[1].image_url.url, tinyPng);
  assert.equal(body.model, "nvidia/nemotron-3.5-super-vl-120b-a12b");
});

test("NVIDIA requests structured JSON for prompt generation", async () => {
  let body;
  await ideaToPrompt(
    { idea: "Write a short note" },
    nvidiaEnv,
    async (_url, options) => {
      body = JSON.parse(options.body);
      return completion(JSON.stringify({ questions: ["Who is it for?"] }));
    },
  );

  assert.deepEqual(body.response_format, { type: "json_object" });
});

test("NVIDIA reasoning can be enabled or disabled per request", async () => {
  const values = [];
  for (const reasoning of [true, false]) {
    await ideaToPrompt(
      { idea: "Write a short note", reasoning },
      nvidiaEnv,
      async (_url, options) => {
        values.push(
          JSON.parse(options.body).chat_template_kwargs?.enable_thinking,
        );
        return completion(JSON.stringify({ questions: ["Who is it for?"] }));
      },
    );
  }

  assert.deepEqual(values, [true, false]);
});

test("NVIDIA and Groq use independent default output budgets", async () => {
  let nvidiaTokens;
  let groqTokens;
  await ideaToPrompt(
    { idea: "Write a short note" },
    nvidiaEnv,
    async (_url, options) => {
      nvidiaTokens = JSON.parse(options.body).max_tokens;
      return completion(JSON.stringify({ questions: ["Who is it for?"] }));
    },
  );
  await ideaToPrompt(
    { idea: "Write a short note" },
    {
      AI_PROVIDER_ORDER: "groq",
      GROQ_API_KEY: "groq-secret",
      GROQ_MODEL: "openai/gpt-oss-120b",
    },
    async (_url, options) => {
      groqTokens = JSON.parse(options.body).max_tokens;
      return completion(JSON.stringify({ questions: ["Who is it for?"] }));
    },
  );

  assert.equal(nvidiaTokens, 16384);
  assert.equal(groqTokens, 2600);
});

test("a token-limited NVIDIA completion is never accepted as complete", async () => {
  let calls = 0;
  await assert.rejects(
    runPrompt(
      { prompt: "Write a complete technical specification" },
      nvidiaEnv,
      async () => {
        calls++;
        return completion("Partial specification", "length");
      },
    ),
    /could not be run/i,
  );
  assert.equal(calls, 1);
});

test("NVIDIA failure falls back to an independent Groq provider", async () => {
  const targets = [];
  const result = await runPrompt(
    { prompt: "Write a useful product summary" },
    {
      ...nvidiaEnv,
      AI_PROVIDER_ORDER: "nvidia,groq",
      GROQ_API_KEY: "groq-secret",
      GROQ_MODEL: "openai/gpt-oss-120b",
    },
    async (url) => {
      targets.push(url);
      return url.includes("nvidia.com")
        ? { ok: false, status: 503 }
        : completion("Groq fallback result");
    },
  );

  assert.match(targets[0], /nvidia\.com/);
  assert.match(targets[1], /groq\.com/);
  assert.equal(result.provider, "groq");
});

test("NVIDIA BYOK stays isolated from system fallback providers", async () => {
  const encryptionEnv = {
    BYOK_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    GROQ_API_KEY: "system-groq-secret",
    GROQ_MODEL: "openai/gpt-oss-120b",
  };
  const encryptedKey = settings.encryptKey(
    "user-1",
    "personal-nvidia-secret",
    encryptionEnv,
  );
  const originalPool = database.pool;
  database.pool = {
    query: async () => ({
      rows: [
        {
          provider: "nvidia",
          model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
          base_url: "",
          encrypted_key: encryptedKey,
        },
      ],
    }),
  };
  try {
    const env = await settings.effectiveEnv("user-1", encryptionEnv);
    assert.equal(env.AI_PROVIDER_ORDER, "nvidia");
    assert.equal(env.AI_MAX_FALLBACKS, "0");
    assert.equal(env.NVIDIA_API_KEY, "personal-nvidia-secret");
    assert.equal(env.NVIDIA_MODEL, "nvidia/nemotron-3.5-super-vl-120b-a12b");
    assert.equal(env.NVIDIA_BASE_URL, "https://integrate.api.nvidia.com/v1");
  } finally {
    database.pool = originalPool;
  }
});

test("NVIDIA is a valid saved provider with native image support", () => {
  const provider = settings.validateProvider({
    name: "NVIDIA Nemotron",
    provider: "nvidia",
    model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    apiKey: "personal-nvidia-secret",
  });
  assert.equal(provider.provider, "nvidia");
  assert.equal(provider.baseUrl, "");
  assert.equal(settings.defaultNames.nvidia, "NVIDIA");
  assert.equal(
    require("../src/image-models.cjs").supportsImages(
      provider.provider,
      provider.model,
    ),
    true,
  );
});
