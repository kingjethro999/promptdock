const test = require("node:test");
const assert = require("node:assert/strict");
const {
  configuredProviders,
  enhanceWithAI,
  ideaToPrompt,
  normalizeDraft,
  normalizeIdea,
  normalizeIdeaGuidance,
  normalizeClarifications,
  normalizeImages,
  normalizeRunInput,
  parseIdeaSuggestion,
  runPrompt,
} = require("../src/ai");
const {
  freeModelIds,
  chooseFreeModel,
  siteFreeModel,
} = require("../src/apmix-models.cjs");

test("APMIX site routing chooses an available free model from the key's catalog", async () => {
  const payload = {
    data: [
      { id: "deepseek/deepseek-v4-flash" },
      { id: "anthropic/claude-sonnet-4-6-free" },
      { id: "openai/gpt-6-luna-free" },
    ],
  };
  const ids = freeModelIds(payload);
  assert.deepEqual(ids, [
    "anthropic/claude-sonnet-4-6-free",
    "openai/gpt-6-luna-free",
  ]);
  assert.equal(
    chooseFreeModel(ids, "gpt-6-luna-free"),
    "openai/gpt-6-luna-free",
  );
  assert.equal(
    chooseFreeModel(ids, "deepseek-v4-flash-free"),
    "anthropic/claude-sonnet-4-6-free",
  );
  let target;
  const model = await siteFreeModel(
    {
      APMIX_API_KEY: "catalog-test-key",
      APMIX_BASE_URL: "https://api.apmix.ai/v1",
      APMIX_MODEL: "deepseek-v4-flash-free",
    },
    async (url) => {
      target = url;
      return { ok: true, json: async () => payload };
    },
  );
  assert.equal(target, "https://api.apmix.ai/v1/models");
  assert.equal(model, "anthropic/claude-sonnet-4-6-free");
});

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

test("fine-tune guidance is optional and validates only supported details", () => {
  assert.deepEqual(normalizeIdeaGuidance({ idea: "Build a game" }), {});
  assert.deepEqual(
    normalizeIdeaGuidance({
      guidance: { tone: " Creative ", focus: " Gameplay ", task: "ignore" },
    }),
    { tone: "Creative", focus: "Gameplay" },
  );
  assert.throws(
    () => normalizeIdeaGuidance({ guidance: { format: "Unknown" } }),
    /Invalid fine-tune/,
  );
});

test("clarification answers are bounded and keep unanswered questions visible", () => {
  assert.deepEqual(normalizeClarifications({}), []);
  assert.deepEqual(
    normalizeClarifications({
      clarifications: [{ question: "What should AI create?", answer: "  " }],
    }),
    [{ question: "What should AI create?", answer: "" }],
  );
  assert.throws(
    () =>
      normalizeClarifications({
        clarifications: Array(5).fill({ question: "x", answer: "y" }),
      }),
    /Invalid clarification/,
  );
});

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Xi2wAAAAASUVORK5CYII=";

test("image input is validated before it reaches a provider", () => {
  assert.equal(normalizeImages({ images: [tinyPng] }).length, 1);
  assert.throws(
    () => normalizeImages({ images: ["data:image/png;base64,AAAA"] }),
    /Invalid image/,
  );
  assert.throws(
    () => normalizeImages({ images: Array(4).fill(tinyPng) }),
    /three images/,
  );
});

test("Groq switches from its text model to vision and receives image parts", async () => {
  let sent;
  const result = await ideaToPrompt(
    { idea: "Make a prompt from this screenshot", images: [tinyPng] },
    {
      AI_PROVIDER_ORDER: "groq",
      GROQ_API_KEY: "test",
      GROQ_MODEL: "openai/gpt-oss-120b",
    },
    async (_url, options) => {
      sent = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: ["What should the result be used for?"],
                }),
              },
            },
          ],
        }),
      };
    },
  );
  assert.equal(sent.model, "qwen/qwen3.8-27b");
  assert.match(sent.messages[0].content, /exactly 1 image/);
  assert.match(sent.messages[0].content, /create this with code/);
  assert.deepEqual(JSON.parse(sent.messages[1].content[0].text), {
    idea: "Make a prompt from this screenshot",
    guidance: {},
    attachmentCount: 1,
  });
  assert.equal(sent.messages[1].content[1].type, "image_url");
  assert.equal(sent.messages[1].content[1].image_url.url, tinyPng);
  assert.equal(result.questions.length, 1);
});

test("Gemini and Anthropic receive native image parts", async () => {
  for (const provider of ["gemini", "anthropic"]) {
    let sent;
    const env =
      provider === "gemini"
        ? {
            AI_PROVIDER_ORDER: "gemini",
            GEMINI_API_KEY: "test",
            GEMINI_MODEL: "gemini-2.5-flash",
          }
        : {
            AI_PROVIDER_ORDER: "anthropic",
            ANTHROPIC_API_KEY: "test",
            ANTHROPIC_MODEL: "claude-sonnet-4-5",
            ANTHROPIC_BASE_URL: "https://api.anthropic.com",
          };
    await ideaToPrompt(
      { idea: "Describe the attached image", images: [tinyPng] },
      env,
      async (_url, options) => {
        sent = JSON.parse(options.body);
        const content = JSON.stringify({
          questions: ["What is your intended output?"],
        });
        return provider === "gemini"
          ? {
              ok: true,
              json: async () => ({
                candidates: [{ content: { parts: [{ text: content }] } }],
              }),
            }
          : { ok: true, json: async () => ({ content: [{ text: content }] }) };
      },
    );
    if (provider === "gemini")
      assert.equal(sent.contents[0].parts[1].inlineData.mimeType, "image/png");
    else
      assert.equal(sent.messages[0].content[1].source.media_type, "image/png");
  }
});

test("image requests without a configured vision provider fail clearly", async () => {
  await assert.rejects(
    ideaToPrompt(
      { idea: "Explain this image", images: [tinyPng] },
      {
        AI_PROVIDER_ORDER: "openai",
        OPENAI_API_KEY: "test",
        OPENAI_BASE_URL: "https://example.com/v1",
        OPENAI_MODEL: "text-only",
      },
      async () => {
        throw new Error("should not call provider");
      },
    ),
    /image provider is unavailable/,
  );
});

test("a text-only personal model sends attached images through PromptDock vision", async () => {
  let destination;
  let auth;
  let model;
  const result = await ideaToPrompt(
    { idea: "Describe this image", images: [tinyPng] },
    {
      AI_PERSONAL_PROVIDER: "1",
      AI_PROVIDER_ORDER: "openai",
      OPENAI_API_KEY: "personal-key",
      OPENAI_MODEL: "text-only",
      OPENAI_BASE_URL: "https://custom.example/v1",
      PROMPTDOCK_VISION_ENV: {
        AI_PROVIDER_ORDER: "groq",
        GROQ_API_KEY: "site-key",
        GROQ_MODEL: "openai/gpt-oss-120b",
      },
    },
    async (url, options) => {
      destination = url;
      auth = options.headers.Authorization;
      model = JSON.parse(options.body).model;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ questions: ["What is the goal?"] }),
              },
            },
          ],
        }),
      };
    },
  );
  assert.equal(destination, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(auth, "Bearer site-key");
  assert.equal(model, "qwen/qwen3.8-27b");
  assert.equal(result.questions.length, 1);
});

test("an image rejection from a personal model retries through PromptDock vision", async () => {
  const targets = [];
  const result = await ideaToPrompt(
    { idea: "Describe this image", images: [tinyPng] },
    {
      AI_PERSONAL_PROVIDER: "1",
      AI_PROVIDER_ORDER: "openai",
      OPENAI_API_KEY: "personal-key",
      OPENAI_MODEL: "gpt-4o",
      OPENAI_VISION_MODEL: "gpt-4o",
      OPENAI_BASE_URL: "https://custom.example/v1",
      PROMPTDOCK_VISION_ENV: {
        AI_PROVIDER_ORDER: "groq",
        GROQ_API_KEY: "site-key",
        GROQ_MODEL: "openai/gpt-oss-120b",
      },
    },
    async (url) => {
      targets.push(url);
      return url.includes("custom.example")
        ? { ok: false, status: 400 }
        : {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      questions: ["What is the goal?"],
                    }),
                  },
                },
              ],
            }),
          };
    },
  );
  assert.equal(targets.length, 2);
  assert.match(targets[1], /api\.groq\.com/);
  assert.equal(result.questions.length, 1);
});

test("official OpenAI keys use the official endpoint without a custom URL", async () => {
  let url;
  const result = await runPrompt(
    { prompt: "Write a short greeting" },
    {
      AI_PROVIDER_ORDER: "openai",
      OPENAI_API_KEY: "test-key",
      OPENAI_MODEL: "gpt-4o",
    },
    async (target) => {
      url = target;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Hello!" } }] }),
      };
    },
  );
  assert.equal(url, "https://api.openai.com/v1/chat/completions");
  assert.equal(result.text, "Hello!");
});

test("image prompts keep visual facts while removing references to unseen attachments", async () => {
  const result = await ideaToPrompt(
    {
      idea: "Create this with code",
      images: [tinyPng],
    },
    {
      AI_PROVIDER_ORDER: "groq",
      GROQ_API_KEY: "test",
      GROQ_MODEL: "text-model",
    },
    async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                data: {
                  task: "Implement the UI in the attached screenshot",
                  context:
                    "The provided screenshot shows a green navigation bar and a white card.",
                  focus: "Match the screenshot's design and layout",
                },
                interpretation: {
                  goal: "Recreate the attached screenshot",
                  focusAreas: ["Match the provided screenshot"],
                },
              }),
            },
          },
        ],
      }),
    }),
  );
  assert.match(result.data.context, /green navigation bar and a white card/);
  assert.doesNotMatch(
    JSON.stringify(result.data),
    /(?:attached|provided) screenshot|the screenshot(?! described here)/i,
  );
  assert.match(result.data.task, /screenshot described here/);
  assert.match(result.data.focus, /design described here and layout/);
  assert.match(result.interpretation.goal, /screenshot described here/);
});

test("an image response without visual context cannot pass as a finished prompt", () => {
  assert.throws(
    () =>
      parseIdeaSuggestion(
        JSON.stringify({
          data: { task: "Build a page", focus: "Make it usable" },
        }),
        "Build this page from the image",
        {},
        1,
      ),
    /image was not described/i,
  );
});

test("material ambiguity yields one compact question group before a prompt", async () => {
  let submitted;
  const result = await ideaToPrompt(
    { idea: "I want AI to help with my shop" },
    { AI_PROVIDER_ORDER: "groq", GROQ_API_KEY: "test", GROQ_MODEL: "test" },
    async (_url, options) => {
      submitted = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    "What kind of shop is it?",
                    "What should AI mainly help with?",
                    "Are you building a new tool or improving an existing one?",
                  ],
                }),
              },
            },
          ],
        }),
      };
    },
  );
  assert.equal(result.data, undefined);
  assert.equal(result.questions.length, 3);
  assert.match(
    submitted.messages[0].content,
    /unresolved choice would materially change/i,
  );
  assert.deepEqual(JSON.parse(submitted.messages[1].content), {
    idea: "I want AI to help with my shop",
    guidance: {},
  });
});

test("final generation receives the original idea, fine-tuning, and every answer", async () => {
  let submitted;
  const clarifications = [
    { question: "What kind of shop is it?", answer: "A local bakery" },
    { question: "What should AI mainly help with?", answer: "Inventory" },
    { question: "Are you building a new tool?", answer: "" },
  ];
  const result = await ideaToPrompt(
    {
      idea: "I want AI to help with my shop",
      guidance: { tone: "Friendly" },
      clarifications,
    },
    { AI_PROVIDER_ORDER: "groq", GROQ_API_KEY: "test", GROQ_MODEL: "test" },
    async (_url, options) => {
      submitted = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  data: {
                    task: "Build an inventory helper for a local bakery",
                    focus: "Track stock first",
                  },
                  interpretation: { goal: "Track bakery inventory" },
                }),
              },
            },
          ],
        }),
      };
    },
  );
  assert.deepEqual(JSON.parse(submitted.messages[1].content), {
    idea: "I want AI to help with my shop",
    guidance: { tone: "Friendly" },
    clarifications,
  });
  assert.match(
    submitted.messages[0].content,
    /original idea as the primary source/i,
  );
  assert.equal(
    result.data.task,
    "Build an inventory helper for a local bakery",
  );
  assert.equal(result.data.tone, "Friendly");
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
    guidance: {},
  });
  assert.match(submitted.messages[0].content, /build means build/i);
  assert.match(submitted.messages[0].content, /<response_contract>/);
  assert.match(submitted.messages[0].content, /<examples>/);
  assert.match(submitted.messages[0].content, /three bullets for beginners/);
  assert.match(
    submitted.messages[0].content,
    /do not.*expose private reasoning/i,
  );
  assert.equal(result.provider, "groq");
  assert.equal(result.data.depth, "Deep");
  assert.match(result.data.approach, /first release/);
  assert.equal(result.interpretation.focusAreas[0], "User needs");
});

test("idea generation sends guidance with the idea and keeps explicit choices", async () => {
  let submitted;
  const result = await ideaToPrompt(
    {
      idea: "Build a small game",
      guidance: {
        format: "JSON",
        depth: "Quick",
        focus: "Playable game first",
        constraints: "Use plain JavaScript",
      },
    },
    { AI_PROVIDER_ORDER: "groq", GROQ_API_KEY: "test", GROQ_MODEL: "test" },
    async (_url, options) => {
      submitted = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  data: {
                    task: "Build a small game",
                    focus: "Something else",
                    format: "Table",
                    depth: "Deep",
                  },
                  interpretation: { focusAreas: ["Something else"] },
                }),
              },
            },
          ],
        }),
      };
    },
  );
  assert.deepEqual(JSON.parse(submitted.messages[1].content), {
    idea: "Build a small game",
    guidance: {
      format: "JSON",
      depth: "Quick",
      focus: "Playable game first",
      constraints: "Use plain JavaScript",
    },
  });
  assert.equal(result.data.format, "JSON");
  assert.equal(result.data.depth, "Quick");
  assert.equal(result.data.focus, "Playable game first");
  assert.equal(result.data.constraints, "Use plain JavaScript");
  assert.deepEqual(result.interpretation.focusAreas, ["Playable game first"]);
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
    guidance: {},
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

test("execution tasks unwrap plan-wrapped tasks and enforce non-stopping execution", () => {
  const result = parseIdeaSuggestion(
    JSON.stringify({
      data: {
        task: "Create a comprehensive design and implementation plan to evolve the current application's landing page and overall UI. The plan must include visual audit and motion system.",
        audience:
          "The product's development team who will implement the design updates and QA the changes",
        focus: "1. Motion system\n2. Liquid buttons",
        constraints: "Preserve brand identity.",
      },
      interpretation: {
        goal: "Evolve application UI",
        focusAreas: ["Motion system", "Liquid buttons"],
      },
    }),
    "I want to evolve the current application visually and interactively with Playwright visual QA",
  );

  assert.match(result.data.task, /^Audit, design, implement, and visually validate the evolution of/);
  assert.match(result.data.task, /Execution must include visual audit/);
  assert.match(result.data.task, /Do not stop after producing a design plan/);
  assert.equal(result.data.audience, "");
  assert.match(
    result.data.constraints,
    /Do not stop at planning\. Inspect, plan, implement, run, visually evaluate, refine, and verify\./,
  );
  assert.match(result.data.constraints, /Preserve brand identity\./);
});

