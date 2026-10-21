const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildModelMatrix,
  estimateCost,
  parseCompletion,
  publicReport,
  renderMarkdown,
  loadFixtures,
  runBenchmark,
  requestCompletion,
  scoreResponse,
} = require("../scripts/model-benchmark.cjs");

const fixture = {
  id: "preservation-sample",
  title: "Preservation sample",
  requirements: [
    {
      id: "R1",
      description: "Keep the existing PostgreSQL schema",
      hard: true,
      anchors: [
        ["preserve", "existing postgresql schema"],
        ["do not change", "postgresql schema"],
      ],
    },
    {
      id: "R2",
      description: "Run focused tests",
      hard: false,
      anchors: [["run", "focused tests"]],
    },
  ],
  unsupportedAdditions: [
    {
      id: "U1",
      description: "Do not invent a Redis dependency",
      anchors: [["use redis"], ["add redis"]],
    },
  ],
};

test("scoreResponse measures requirement coverage and hard omissions from authored anchors", () => {
  const result = scoreResponse(
    fixture,
    "Preserve the existing PostgreSQL schema. Use Redis for caching.",
  );

  assert.equal(result.requirementCoverage, 0.5);
  assert.deepEqual(result.coveredRequirementIds, ["R1"]);
  assert.deepEqual(result.missingRequirementIds, ["R2"]);
  assert.deepEqual(result.hardConstraintOmissions, []);
  assert.deepEqual(result.unsupportedAdditions, ["U1"]);
});

test("scoreResponse reports an omitted hard constraint", () => {
  const result = scoreResponse(fixture, "Run focused tests before delivery.");

  assert.deepEqual(result.hardConstraintOmissions, ["R1"]);
  assert.equal(result.passed, false);
});

test("estimated benchmark costs require configured per-token pricing", () => {
  assert.equal(
    estimateCost(
      { promptTokens: 1000, completionTokens: 500 },
      { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
    ),
    0.00045,
  );
  assert.equal(
    estimateCost({ promptTokens: 1000, completionTokens: 500 }, {}),
    null,
  );
});

test("parseCompletion rejects token-limited and empty responses", () => {
  const limited = parseCompletion({
    choices: [
      {
        finish_reason: "length",
        message: { content: "Preserve the existing PostgreSQL schema." },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
  });
  assert.equal(limited.truncated, true);
  assert.equal(limited.validResponse, false);
  assert.equal(limited.finishReason, "length");
  assert.equal(limited.usage.totalTokens, 125);

  const empty = parseCompletion({
    choices: [{ finish_reason: "stop", message: { content: "  " } }],
  });
  assert.equal(empty.validResponse, false);
});

test("buildModelMatrix requires explicit provider keys and gives candidates equal budgets", () => {
  assert.throws(() => buildModelMatrix({}), /NVIDIA_API_KEY and GROQ_API_KEY/);

  const models = buildModelMatrix({
    NVIDIA_API_KEY: "nvidia-secret",
    GROQ_API_KEY: "groq-secret",
    AI_BENCHMARK_MAX_TOKENS: "16384",
    BENCHMARK_NVIDIA_SUPER_MODEL: "nvidia/older-super",
  });

  assert.deepEqual(
    models.map(({ id }) => id),
    [
      "nvidia-super-vl",
      "nvidia-lightning",
      "nvidia-super-text",
      "groq-gpt-oss-120b",
    ],
  );
  assert.deepEqual(
    [...new Set(models.map(({ maxTokens }) => maxTokens))],
    [16384],
  );
  assert.equal(JSON.stringify(models).includes("nvidia-secret"), false);
  assert.equal(JSON.stringify(models).includes("groq-secret"), false);
});

test("provider errors retain safe diagnostics without treating errors as omissions", async () => {
  const model = {
    id: "nvidia-super-vl",
    provider: "NVIDIA",
    model: "nvidia/test-model",
    baseUrl: "https://provider.example/v1",
    apiKeyEnv: "NVIDIA_API_KEY",
    maxTokens: 16384,
    prices: {},
  };
  const error = await requestCompletion(
    model,
    { id: "short-idea", title: "Short idea", source: "Build a small app." },
    { NVIDIA_API_KEY: "test-secret" },
    async () => ({
      ok: false,
      status: 500,
      headers: {
        get(name) {
          return name === "x-request-id" ? "req-123" : null;
        },
      },
      json: async () => ({ error: { code: "backend_overloaded" } }),
    }),
  ).catch((failure) => failure);

  assert.equal(error.benchmark.httpStatus, 500);
  assert.equal(error.benchmark.providerCode, "backend_overloaded");
  assert.equal(error.benchmark.requestId, "req-123");
  assert.ok(error.benchmark.latencyMs >= 0);
  assert.doesNotMatch(error.message, /test-secret/);
});

test("runBenchmark separates provider errors from requirement omissions", async () => {
  const report = await runBenchmark({
    fixtureId: "short-idea",
    modelId: "nvidia-super-vl",
    env: { NVIDIA_API_KEY: "nvidia-secret", GROQ_API_KEY: "groq-secret" },
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      headers: {
        get: (name) => (name === "x-request-id" ? "req-123" : null),
      },
      json: async () => ({ error: { code: "backend_overloaded" } }),
    }),
  });
  const [result] = report.results;
  assert.equal(result.errorStatus, 500);
  assert.equal(result.errorCode, "backend_overloaded");
  assert.equal(result.errorRequestId, "req-123");
  assert.deepEqual(result.scoring.hardConstraintOmissions, []);
  assert.deepEqual(result.scoring.missingRequirementIds, []);
  const publicJson = JSON.stringify(publicReport(report));
  assert.match(publicJson, /backend_overloaded/);
  assert.doesNotMatch(publicJson, /req-123|nvidia-secret|groq-secret/);
});

test("raw outputs require local opt-in and never enter the public report", async () => {
  const generated =
    "friendly launch announcement; do not add a date or location";
  const report = await runBenchmark({
    fixtureId: "short-idea",
    modelId: "nvidia-super-vl",
    retainOutput: true,
    env: { NVIDIA_API_KEY: "nvidia-secret", GROQ_API_KEY: "groq-secret" },
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => null },
      json: async () => ({
        choices: [{ finish_reason: "stop", message: { content: generated } }],
      }),
    }),
  });

  assert.equal(report.results[0].output, generated);
  assert.doesNotMatch(JSON.stringify(publicReport(report)), /friendly launch/);
});

test("renderMarkdown summarizes quality and performance without response bodies", () => {
  const markdown = renderMarkdown({
    generatedAt: "2026-10-20T12:00:00.000Z",
    configuration: { maxTokens: 16384, fixtureCount: 1 },
    results: [
      {
        modelId: "nvidia-super-vl",
        provider: "NVIDIA",
        model: "nvidia/model",
        fixtureId: "preservation-sample",
        fixtureTitle: "Preservation sample",
        validResponse: true,
        finishReason: "stop",
        truncated: false,
        latencyMs: 1500,
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        scoring: {
          requirementCoverage: 1,
          hardConstraintOmissions: [],
          unsupportedAdditions: [],
          passed: true,
        },
        outputSha256: "abc123",
        outputCharacters: 800,
      },
    ],
  });

  assert.match(markdown, /NVIDIA/);
  assert.match(markdown, /100\.0%/);
  assert.match(markdown, /1,500 ms/);
  assert.match(markdown, /abc123/);
  assert.doesNotMatch(markdown, /responseBody/);
});

test("public benchmark summaries include metrics but exclude model output and hashes", () => {
  const sanitized = publicReport({
    generatedAt: "2026-10-20T12:00:00.000Z",
    results: [
      {
        modelId: "nvidia-super-vl",
        fixtureId: "long-spec",
        validResponse: true,
        finishReason: "stop",
        truncated: false,
        latencyMs: 800,
        usage: { totalTokens: 1200, promptTokens: 1000 },
        estimatedCostUsd: null,
        scoring: {
          requirementCoverage: 0.95,
          hardConstraintOmissions: [],
          unsupportedAdditions: [],
          passed: true,
        },
        outputSha256: "private-output-hash",
        outputCharacters: 1300,
        output: "private generated prompt",
      },
    ],
  });
  const json = JSON.stringify(sanitized);
  assert.match(json, /nvidia-super-vl/);
  assert.match(json, /0\.95/);
  assert.doesNotMatch(
    json,
    /private-output-hash|private generated prompt|outputCharacters/,
  );
});

test("the benchmark fixtures cover short, long, contradictory, and strict inputs", () => {
  const fixtures = loadFixtures();
  const ids = fixtures.map(({ id }) => id).sort();
  assert.deepEqual(ids, [
    "contradictory-decisions",
    "detailed-workspace",
    "short-idea",
    "strict-constraints",
  ]);
  const detailed = fixtures.find(({ id }) => id === "detailed-workspace");
  assert.ok(detailed.requirements.length >= 20);
  assert.ok(detailed.requirements.some(({ hard }) => hard));
  assert.ok(detailed.unsupportedAdditions.length > 0);
});

test("the short-idea fixture recognizes equivalent wording for unknown date and location", () => {
  const shortIdea = loadFixtures().find(({ id }) => id === "short-idea");
  const results = [
    "Do not invent or add a date or location; those details have not been chosen.",
    "Do not include a date or a location; those details have not been chosen.",
    "Do not include a date or location, as those details have not yet been chosen.",
    "Do not include a date. Do not include a location. A date and location have not been chosen and must not be added.",
    "Strictly omit any date or location, as those have not been chosen.",
    "This must not include any date or location information.",
  ].map((output) => scoreResponse(shortIdea, output));

  for (const result of results) {
    assert.ok(result.coveredRequirementIds.includes("R05"));
    assert.ok(!result.hardConstraintOmissions.includes("R05"));
  }
});

test("the contradiction fixture accepts preserved decisions and ignores negated superseded options", () => {
  const contradictory = loadFixtures().find(
    ({ id }) => id === "contradictory-decisions",
  );
  const result = scoreResponse(
    contradictory,
    "Use PostgreSQL. Do not migrate to MongoDB or replace the database. Preserve the current schema. Keep all existing account records intact. Implement the feature using the current identity table. Do not create duplicate accounts; add a regression test.",
  );

  assert.equal(result.requirementCoverage, 1);
  assert.deepEqual(result.hardConstraintOmissions, []);
  assert.deepEqual(result.unsupportedAdditions, []);
  assert.equal(result.passed, true);
});

test("the contradiction fixture recognizes equivalent duplicate-account safeguards", () => {
  const contradictory = loadFixtures().find(
    ({ id }) => id === "contradictory-decisions",
  );
  const result = scoreResponse(
    contradictory,
    "Use PostgreSQL and preserve the current schema. Do not migrate or replace the database. Keep all existing account records. Use the current identity table. Strictly prevent the creation of duplicate accounts. Add a regression test that validates the duplicate-account prevention rule.",
  );

  assert.equal(result.requirementCoverage, 1);
  assert.deepEqual(result.hardConstraintOmissions, []);
});

test("the live model benchmark refuses to run in CI", async () => {
  await assert.rejects(runBenchmark({ env: { CI: "true" } }), /disabled in CI/);
});
