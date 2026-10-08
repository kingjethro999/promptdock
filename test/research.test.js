const test = require("node:test");
const assert = require("node:assert/strict");
const { researchDecision, redactSecrets } = require("../src/research/intent");
const {
  normalizeSources,
  researchContext,
  researchWithFirecrawl,
  performResearch,
} = require("../src/research/firecrawl");
const { researchWithJina } = require("../src/research/jina");

test("ordinary creative prompts skip research", () => {
  const decision = researchDecision({ idea: "Write a warm poem about rain" });
  assert.equal(decision.required, false);
});

test("current and explicit research requests trigger focused research", () => {
  const decision = researchDecision({
    idea: "Research the latest Next.js caching behavior and create a migration prompt",
  });
  assert.equal(decision.required, true);
  assert.equal(decision.queries.length, 1);
  assert.equal(decision.freshness, "current");
});

test("explicit no-browse instruction wins and URLs are detected", () => {
  const decision = researchDecision({
    idea: "Read https://example.com/docs but do not browse the web again",
  });
  assert.equal(decision.required, false);
  assert.deepEqual(decision.targetUrls, ["https://example.com/docs"]);
});

test("research context redacts secrets from search queries", () => {
  assert.equal(
    redactSecrets("Research API key: sk-secret-value and current docs"),
    "Research and current docs",
  );
});

test("Firecrawl results are deduplicated and bounded", () => {
  const sources = normalizeSources([
    { url: "https://example.com/page#one", markdown: "first" },
    { url: "https://example.com/page#two", markdown: "duplicate" },
    { url: "https://example.org/other", markdown: "second" },
  ]);
  assert.equal(sources.length, 2);
  assert.match(researchContext(sources), /SOURCE 1/);
  assert.match(researchContext(sources), /untrusted DATA/);
});

test("Firecrawl search is mocked and normalized without exposing credentials", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/search")) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              title: "Docs",
              url: "https://docs.example.com/guide",
              markdown: "Useful guidance",
            },
          ],
        }),
      };
    }
    throw new Error("unexpected request");
  };
  const result = await researchWithFirecrawl(
    researchDecision({ idea: "Research the current API documentation" }),
    { FIRECRAWL_API_KEY: "secret-key" },
    request,
  );
  assert.equal(result.used, true);
  assert.equal(result.sources[0].url, "https://docs.example.com/guide");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Authorization, "Bearer secret-key");
});

test("missing Firecrawl configuration falls back cleanly", async () => {
  const result = await researchWithFirecrawl(
    researchDecision({ idea: "Research current pricing" }),
    {},
    async () => {
      throw new Error("must not call Firecrawl");
    },
  );
  assert.equal(result.used, false);
  assert.equal(result.unavailable, true);
});

test("research context is injected into the existing prompt architect", async () => {
  const { ideaToPrompt } = require("../src/ai");
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith("/search")) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              title: "Official docs",
              url: "https://docs.example.com",
              markdown: "Current API behavior",
            },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                data: {
                  task: "Create a migration prompt",
                  focus: "Use current API behavior",
                },
              }),
            },
          },
        ],
      }),
    };
  };
  const result = await ideaToPrompt(
    { idea: "Research the current API behavior and create a migration prompt" },
    {
      FIRECRAWL_API_KEY: "firecrawl-test-key",
      APMIX_API_KEY: "provider-key",
      APMIX_BASE_URL: "https://api.apmix.ai/v1",
      APMIX_MODEL: "provider/model",
      AI_PROVIDER_ORDER: "apmix",
    },
    request,
  );
  assert.equal(result.research.used, true);
  assert.equal(result.research.sources.length, 1);
  assert.match(JSON.stringify(calls[1].body), /Current API behavior/);
});

test("Jina search and reader are mocked and normalized with authorization", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    if (url.includes("s.jina.ai")) {
      return {
        ok: true,
        json: async () => ({
          code: 200,
          data: [
            {
              title: "Jina Search Result",
              url: "https://jina.example.com/guide",
              content: "Clean extracted markdown content from search",
              description: "A description of the page",
            },
          ],
        }),
      };
    }
    if (url.includes("r.jina.ai")) {
      return {
        ok: true,
        json: async () => ({
          code: 200,
          data: {
            title: "Jina Reader Result",
            url: "https://jina.example.com/read",
            content: "Direct reader markdown content",
          },
        }),
      };
    }
    throw new Error(`Unexpected endpoint: ${url}`);
  };

  const decision = researchDecision({
    idea: "Read https://jina.example.com/read and research latest docs",
  });
  decision.required = true;

  const result = await researchWithJina(
    decision,
    { JINA_API_KEY: "jina-secret-key" },
    request,
  );

  assert.equal(result.used, true);
  assert.equal(result.provider, "jina");
  assert.equal(result.sources.length, 2);
  assert.equal(calls[0].options.headers.Authorization, "Bearer jina-secret-key");
  assert.equal(calls[0].options.headers.Accept, "application/json");
});

test("performResearch falls back to Jina when Firecrawl fails", async () => {
  const request = async (url) => {
    if (url.includes("firecrawl")) {
      return { ok: false, status: 500 };
    }
    if (url.includes("s.jina.ai")) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              title: "Fallback Result",
              url: "https://fallback.example.com",
              content: "Recovered via Jina fallback",
            },
          ],
        }),
      };
    }
    throw new Error(`Unexpected url: ${url}`);
  };

  const result = await performResearch(
    researchDecision({ idea: "Research current updates" }),
    {
      FIRECRAWL_API_KEY: "broken-firecrawl-key",
      JINA_API_KEY: "working-jina-key",
    },
    request,
  );

  assert.equal(result.used, true);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, "https://fallback.example.com");
  assert.equal(result.fallbackFrom, "firecrawl");
});

test("performResearch uses Jina directly when only JINA_API_KEY is configured", async () => {
  const request = async (url) => {
    assert.ok(url.includes("jina.ai"));
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            title: "Direct Jina",
            url: "https://direct.jina.example.com",
            content: "Direct result",
          },
        ],
      }),
    };
  };

  const result = await performResearch(
    researchDecision({ idea: "Research latest updates" }),
    { JINA_API_KEY: "direct-jina-key" },
    request,
  );

  assert.equal(result.used, true);
  assert.equal(result.sources[0].title, "Direct Jina");
});

