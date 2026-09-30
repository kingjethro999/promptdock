const test = require("node:test");
const assert = require("node:assert/strict");
const {
  configuredProviders,
  enhanceWithAI,
  ideaToPrompt,
  normalizeDraft,
  normalizeIdea,
  normalizeRunInput,
  parseIdeaSuggestion,
  runPrompt,
} = require("../src/ai");

test("configured providers follow environment order", () => {
  assert.deepEqual(
    configuredProviders({
      AI_PROVIDER_ORDER: "apmix,groq,gemini",
      GROQ_API_KEY: "x",
      GROQ_MODEL: "m",
      GEMINI_API_KEY: "y",
    }),
    ["groq", "gemini"],
  );
});

test("APMIX uses its configured model and OpenAI-compatible endpoint", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, headers: options.headers, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                data: { task: "Write a note", focus: "Clarity first" },
              }),
            },
          },
        ],
      }),
    };
  };
  await ideaToPrompt(
    { idea: "Write a short note" },
    {
      AI_PROVIDER_ORDER: "apmix",
      APMIX_API_KEY: "personal-key",
      APMIX_MODEL: "provider/model",
      APMIX_BASE_URL: "https://api.apmix.ai/v1",
    },
    fakeFetch,
  );
  assert.equal(request.url, "https://api.apmix.ai/v1/chat/completions");
  assert.equal(request.headers.Authorization, "Bearer personal-key");
  assert.equal(request.body.model, "provider/model");
});

test("draft validation requires a task", () => {
  assert.throws(() => normalizeDraft({ task: "   " }), /Add a task/);
});

test("rough ideas require a useful amount of input", () => {
  assert.throws(() => normalizeIdea({ idea: "a " }), /Describe your idea/);
  assert.equal(
    normalizeIdea({ idea: "  meal planning app  " }),
    "meal planning app",
  );
});

test("idea response keeps ranked focus and flags missing details", () => {
  const result = parseIdeaSuggestion(
    JSON.stringify({
      data: {
        task: "Plan a meal app",
        approach: "1. Define user needs\n2. Plan the first release",
        focus: "1. User needs\n2. Core workflow",
        depth: "Deep",
        format: "Step-by-step guide",
        tone: "Invented tone",
      },
      interpretation: {
        goal: "Plan the app",
        whyThisDepth: "A product needs several decisions.",
        focusAreas: ["User needs", "Core workflow"],
        missingDetails: ["Target users"],
      },
    }),
    "meal app",
  );
  assert.equal(result.data.focus, "1. User needs\n2. Core workflow");
  assert.equal(
    result.data.approach,
    "1. Define user needs\n2. Plan the first release",
  );
  assert.equal(result.data.depth, "Deep");
  assert.equal(result.data.tone, "");
  assert.deepEqual(result.interpretation.missingDetails, ["Target users"]);
  assert.throws(
    () => parseIdeaSuggestion('{"data":{"task":"Plan an app"}}', "app"),
    /Incomplete AI response/,
  );
});

test("idea generation passes the raw idea and returns a structured prompt", async () => {
  const env = {
    AI_PROVIDER_ORDER: "groq",
    GROQ_API_KEY: "test",
    GROQ_MODEL: "test",
  };
  let submitted;
  const fakeFetch = async (url, options) => {
    submitted = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                data: {
                  task: "Plan a meal app",
                  role: "Product strategist",
                  approach: "1. Define user needs\n2. Plan the first release",
                  focus: "1. User needs\n2. Core workflow",
                  depth: "Deep",
                },
                interpretation: {
                  goal: "Plan the product",
                  focusAreas: ["User needs", "Core workflow"],
                  missingDetails: ["Target users"],
                },
              }),
            },
          },
        ],
      }),
    };
  };
  const result = await ideaToPrompt(
    { idea: "I want a meal planning app" },
    env,
    fakeFetch,
  );
  assert.deepEqual(JSON.parse(submitted.messages[1].content), {
    idea: "I want a meal planning app",
  });
  assert.match(submitted.messages[0].content, /build means build/);
  assert.equal(result.provider, "groq");
  assert.equal(result.data.depth, "Deep");
  assert.match(result.data.approach, /first release/);
  assert.equal(result.interpretation.focusAreas[0], "User needs");
});

test("a working build keeps implementation depth even when a model undershoots", () => {
  const result = parseIdeaSuggestion(
    JSON.stringify({
      data: {
        task: "Build a playable browser game",
        focus: "Working game first",
        depth: "Balanced",
      },
      interpretation: { whyThisDepth: "This is a moderate task." },
    }),
    "Build a browser game with working code",
  );
  assert.equal(result.data.depth, "Deep");
  assert.match(result.interpretation.whyThisDepth, /working build/);
});

test("Gemini receives a separate system instruction and JSON output request", async () => {
  let body;
  const fakeFetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    data: {
                      task: "Write a note",
                      focus: "Clarity first",
                      depth: "Quick",
                    },
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };
  await ideaToPrompt(
    { idea: "Write a quick note" },
    {
      AI_PROVIDER_ORDER: "gemini",
      GEMINI_API_KEY: "test",
      GEMINI_MODEL: "gemini-test",
    },
    fakeFetch,
  );
  assert.match(body.systemInstruction.parts[0].text, /prompt architect/);
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), {
    idea: "Write a quick note",
  });
  assert.equal(body.generationConfig.responseMimeType, "application/json");
});

test("idea generation retries a transient connection failure", async () => {
  const env = {
    AI_PROVIDER_ORDER: "groq",
    GROQ_API_KEY: "test",
    GROQ_MODEL: "test",
  };
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    if (calls === 1) throw new TypeError("fetch failed");
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                data: {
                  task: "Plan an app",
                  focus: "1. User needs",
                  depth: "Balanced",
                },
              }),
            },
          },
        ],
      }),
    };
  };
  const result = await ideaToPrompt(
    { idea: "Make a study app" },
    env,
    fakeFetch,
  );
  assert.equal(calls, 2);
  assert.equal(result.data.task, "Plan an app");
});

test("AI enhancement falls back and keeps unknown details blank", async () => {
  const env = {
    AI_PROVIDER_ORDER: "apmix,groq",
    AI_MAX_FALLBACKS: "1",
    APMIX_API_KEY: "x",
    APMIX_BASE_URL: "https://example.com/v1",
    APMIX_MODEL: "test",
    GROQ_API_KEY: "y",
    GROQ_MODEL: "test",
  };
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (calls.length === 1) return { ok: false, status: 503 };
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                task: "Write a clear launch email",
                role: "Copywriter",
                format: "Email",
                tone: "Friendly",
              }),
            },
          },
        ],
      }),
    };
  };
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const result = await enhanceWithAI(
      { task: "write launch email" },
      env,
      fakeFetch,
    );
    assert.equal(result.provider, "groq");
    assert.equal(result.data.task, "Write a clear launch email");
    assert.equal(result.data.context, "");
    assert.equal(result.data.format, "Email");
    assert.equal(calls.length, 2);
  } finally {
    console.warn = originalWarn;
  }
});

test("run input needs a useful prompt and stays within limits", () => {
  assert.throws(() => normalizeRunInput({ prompt: "go" }), /Add a task/);
  assert.throws(() => normalizeRunInput({}), /Add a task/);
  assert.throws(
    () => normalizeRunInput({ prompt: "x".repeat(400001) }),
    /too long/,
  );
  assert.equal(
    normalizeRunInput({ prompt: "  Summarize this article  " }),
    "Summarize this article",
  );
});

test("running a prompt sends it verbatim and returns the plain reply", async () => {
  const env = {
    AI_PROVIDER_ORDER: "groq",
    GROQ_API_KEY: "test",
    GROQ_MODEL: "test",
  };
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "  Here is the result.  " } }],
      }),
    };
  };
  const result = await runPrompt(
    { prompt: "Task: Write a haiku about rivers" },
    env,
    fakeFetch,
  );
  assert.equal(
    request.body.messages[1].content,
    "Task: Write a haiku about rivers",
  );
  assert.match(
    request.body.messages[0].content,
    /Follow the user's instructions/,
  );
  assert.equal(request.body.max_tokens, 4000);
  assert.equal(result.text, "Here is the result.");
  assert.equal(result.provider, "groq");
});

test("a Gemini test run asks for plain text instead of JSON", async () => {
  let body;
  const fakeFetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Answer" }] } }],
      }),
    };
  };
  const result = await runPrompt(
    { prompt: "Task: Explain photosynthesis" },
    {
      AI_PROVIDER_ORDER: "gemini",
      GEMINI_API_KEY: "test",
      GEMINI_MODEL: "gemini-test",
    },
    fakeFetch,
  );
  assert.equal(body.generationConfig, undefined);
  assert.equal(result.text, "Answer");
});

test("configured providers include custom OpenAI and Anthropic endpoints", () => {
  assert.deepEqual(
    configuredProviders({
      AI_PROVIDER_ORDER: "anthropic,openai,groq",
      ANTHROPIC_API_KEY: "a",
      ANTHROPIC_BASE_URL: "https://api.anthropic.com",
      ANTHROPIC_MODEL: "claude-sonnet-4-5",
      OPENAI_API_KEY: "b",
      OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
      OPENAI_MODEL: "llama-3.3-70b",
      GROQ_API_KEY: "g",
      GROQ_MODEL: "gm",
    }),
    ["anthropic", "openai", "groq"],
  );
  assert.deepEqual(
    configuredProviders({ OPENAI_API_KEY: "b", GROQ_API_KEY: "g" }),
    [],
  );
});

test("Anthropic-compatible endpoints use the Messages API", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = {
      url,
      headers: options.headers,
      body: JSON.parse(options.body),
    };
    return {
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              data: { task: "Write a note", focus: "Clarity first" },
            }),
          },
        ],
      }),
    };
  };
  const result = await ideaToPrompt(
    { idea: "Write a short note" },
    {
      AI_PROVIDER_ORDER: "anthropic",
      ANTHROPIC_API_KEY: "personal-key",
      ANTHROPIC_MODEL: "claude-sonnet-4-5",
      ANTHROPIC_BASE_URL: "https://api.anthropic.com",
    },
    fakeFetch,
  );
  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.headers["x-api-key"], "personal-key");
  assert.equal(request.headers["anthropic-version"], "2023-06-01");
  assert.equal(request.body.model, "claude-sonnet-4-5");
  assert.ok(request.body.system.includes("prompt architect"));
  assert.deepEqual(
    request.body.messages.map((message) => message.role),
    ["user"],
  );
  assert.equal(result.data.task, "Write a note");
});

test("custom OpenAI-compatible endpoints post to their own base URL", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = {
      url,
      headers: options.headers,
      body: JSON.parse(options.body),
    };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Three colours: red, green, blue." } }],
      }),
    };
  };
  const result = await runPrompt(
    { prompt: "Task: list three colours" },
    {
      AI_PROVIDER_ORDER: "openai",
      OPENAI_API_KEY: "personal-key",
      OPENAI_MODEL: "llama-3.3-70b-instruct",
      OPENAI_BASE_URL: "https://openrouter.ai/api/v1/chat/completions",
    },
    fakeFetch,
  );
  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(request.headers.Authorization, "Bearer personal-key");
  assert.equal(request.body.model, "llama-3.3-70b-instruct");
  assert.equal(request.body.max_tokens, 4000);
  assert.equal(result.text, "Three colours: red, green, blue.");
});

test("local endpoints may use HTTP while remote endpoints must use HTTPS", async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "local result" } }],
      }),
    };
  };
  const result = await runPrompt(
    { prompt: "Task: hello" },
    {
      AI_PROVIDER_ORDER: "openai",
      OPENAI_API_KEY: "local-key",
      OPENAI_MODEL: "llama3",
      OPENAI_BASE_URL: "http://localhost:11434/v1",
    },
    fakeFetch,
  );
  assert.equal(request.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(result.text, "local result");

  await assert.rejects(
    runPrompt(
      { prompt: "Task: hello" },
      {
        AI_PROVIDER_ORDER: "openai",
        OPENAI_API_KEY: "local-key",
        OPENAI_MODEL: "llama3",
        OPENAI_BASE_URL: "http://api.example.com/v1",
      },
      fakeFetch,
    ),
    /could not be run/i,
  );
});

test("people can write as much as they need to", () => {
  const idea =
    `Please look at this in detail. ${"detail ".repeat(12000)}`.trim();
  assert.equal(normalizeIdea({ idea }), idea);
  const prompt = `Summarise everything below. ${"body ".repeat(40000)}`.trim();
  assert.equal(normalizeRunInput({ prompt }), prompt);
  const draft = normalizeDraft({
    task: `Write ${"about the topic. ".repeat(5000)}`.trim(),
  });
  assert.ok(draft.task.length > 80000);
  assert.doesNotThrow(() => normalizeDraft(draft));
});
