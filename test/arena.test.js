const test = require("node:test");
const assert = require("node:assert/strict");
const { runPromptComparison } = require("../src/ai");

test("runPromptComparison executes across available providers in parallel", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `Output from ${url.includes("groq") ? "groq" : "apmix"}`,
            },
          },
        ],
      }),
    };
  };

  const env = {
    GROQ_API_KEY: "groq-key",
    GROQ_MODEL: "groq-model",
    APMIX_API_KEY: "apmix-key",
    APMIX_BASE_URL: "https://api.apmix.ai/v1",
    APMIX_MODEL: "apmix-model",
    AI_PROVIDER_ORDER: "groq,apmix",
  };

  const result = await runPromptComparison(
    { prompt: "Task: say hello", providers: ["groq", "apmix"] },
    env,
    request,
  );

  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].provider, "groq");
  assert.equal(result.results[0].success, true);
  assert.equal(result.results[1].provider, "apmix");
  assert.equal(result.results[1].success, true);
});

test("runPromptComparison tolerates one failing provider and reports its error", async () => {
  const request = async (url) => {
    if (url.includes("groq")) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Groq succeeded" } }],
        }),
      };
    }
    return {
      ok: false,
      status: 500,
    };
  };

  const env = {
    GROQ_API_KEY: "groq-key",
    GROQ_MODEL: "groq-model",
    APMIX_API_KEY: "apmix-key",
    APMIX_BASE_URL: "https://api.apmix.ai/v1",
    APMIX_MODEL: "apmix-model",
    AI_PROVIDER_ORDER: "groq,apmix",
  };

  const result = await runPromptComparison(
    { prompt: "Task: say hello", providers: ["groq", "apmix"] },
    env,
    request,
  );

  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].success, true);
  assert.equal(result.results[0].text, "Groq succeeded");
  assert.equal(result.results[1].success, false);
  assert.ok(result.results[1].error);
});

test("runPromptComparison rejects empty or invalid prompt text", async () => {
  await assert.rejects(
    () => runPromptComparison({ prompt: "" }),
    /Add a task before running the prompt/,
  );
});
