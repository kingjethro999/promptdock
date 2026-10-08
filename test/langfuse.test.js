const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isLangfuseEnabled,
  normalizeUsage,
  recordLangfuseTrace,
} = require("../src/langfuse");
const { enhanceWithAI } = require("../src/ai");

test("isLangfuseEnabled checks both flag and required keys", () => {
  assert.equal(isLangfuseEnabled({}), false);
  assert.equal(
    isLangfuseEnabled({
      ENABLE_LANGFUSE_TRACING: "true",
      LANGFUSE_PUBLIC_KEY: "pk-123",
      // missing secret
    }),
    false,
  );
  assert.equal(
    isLangfuseEnabled({
      ENABLE_LANGFUSE_TRACING: "false",
      LANGFUSE_PUBLIC_KEY: "pk-123",
      LANGFUSE_SECRET_KEY: "sk-123",
    }),
    false,
  );
  assert.equal(
    isLangfuseEnabled({
      ENABLE_LANGFUSE_TRACING: "true",
      LANGFUSE_PUBLIC_KEY: "pk-123",
      LANGFUSE_SECRET_KEY: "sk-123",
    }),
    true,
  );
  assert.equal(
    isLangfuseEnabled({
      ENABLE_LANGFUSE_TRACING: "1",
      LANGFUSE_PUBLIC_KEY: "pk-123",
      LANGFUSE_SECRET_KEY: "sk-123",
    }),
    true,
  );
});

test("normalizeUsage normalizes multiple provider usage schemas", () => {
  assert.equal(normalizeUsage(null), undefined);
  assert.deepEqual(
    normalizeUsage({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    }),
    { input: 10, output: 20, total: 30 },
  );
  assert.deepEqual(
    normalizeUsage({
      promptTokenCount: 15,
      candidatesTokenCount: 25,
      totalTokenCount: 40,
    }),
    { input: 15, output: 25, total: 40 },
  );
  assert.deepEqual(normalizeUsage({ input_tokens: 12, output_tokens: 18 }), {
    input: 12,
    output: 18,
    total: 30,
  });
});

test("recordLangfuseTrace formats Ingestion API batch payload with basic auth", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return { ok: true, status: 200 };
  };

  const env = {
    ENABLE_LANGFUSE_TRACING: "true",
    LANGFUSE_PUBLIC_KEY: "pk-test",
    LANGFUSE_SECRET_KEY: "sk-test",
    LANGFUSE_BASEURL: "https://langfuse.mycompany.com/",
  };

  const success = await recordLangfuseTrace(
    {
      traceId: "test-trace-id",
      name: "test-generation",
      userId: "user-123",
      input: { prompt: "Hello world" },
      output: { reply: "Hi there" },
      generations: [
        {
          provider: "groq",
          model: "openai/gpt-oss-120b",
          status: "success",
          input: [{ role: "user", content: "Hello world" }],
          output: "Hi there",
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        },
      ],
    },
    env,
    request,
  );

  assert.equal(success, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://langfuse.mycompany.com/api/public/ingestion",
  );

  const expectedAuth = `Basic ${Buffer.from("pk-test:sk-test").toString("base64")}`;
  assert.equal(calls[0].options.headers.Authorization, expectedAuth);

  const batch = calls[0].body.batch;
  assert.equal(batch.length, 2);
  assert.equal(batch[0].type, "trace-create");
  assert.equal(batch[0].body.id, "test-trace-id");
  assert.equal(batch[0].body.userId, "user-123");

  assert.equal(batch[1].type, "generation-create");
  assert.equal(batch[1].body.traceId, "test-trace-id");
  assert.equal(batch[1].body.model, "openai/gpt-oss-120b");
  assert.deepEqual(batch[1].body.usage, { input: 5, output: 3, total: 8 });
});

test("recordLangfuseTrace fails silently and returns false when network throws", async () => {
  const request = async () => {
    throw new Error("Network offline");
  };

  const env = {
    ENABLE_LANGFUSE_TRACING: "true",
    LANGFUSE_PUBLIC_KEY: "pk-test",
    LANGFUSE_SECRET_KEY: "sk-test",
  };

  const success = await recordLangfuseTrace(
    { name: "failing-trace" },
    env,
    request,
  );

  assert.equal(success, false);
});

test("AI generation triggers Langfuse trace recording when enabled", async () => {
  const traceCalls = [];
  const request = async (url, options) => {
    if (url.includes("langfuse") || url.endsWith("/ingestion")) {
      traceCalls.push({ url, body: JSON.parse(options.body) });
      return { ok: true, status: 200 };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                task: "Build a web app",
                role: "Senior Architect",
              }),
            },
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      }),
    };
  };

  const env = {
    ENABLE_LANGFUSE_TRACING: "true",
    LANGFUSE_PUBLIC_KEY: "pk-test-key",
    LANGFUSE_SECRET_KEY: "sk-test-key",
    LANGFUSE_BASEURL: "https://cloud.langfuse.com",
    GROQ_API_KEY: "groq-test-key",
    GROQ_MODEL: "openai/gpt-oss-120b",
    AI_PROVIDER_ORDER: "groq",
  };

  const result = await enhanceWithAI({ task: "Build a web app" }, env, request);

  assert.equal(result.data.task, "Build a web app");
  assert.equal(traceCalls.length, 1);
  assert.equal(traceCalls[0].body.batch[0].type, "trace-create");
  assert.equal(traceCalls[0].body.batch[1].type, "generation-create");
  assert.equal(traceCalls[0].body.batch[1].body.model, "openai/gpt-oss-120b");
});
