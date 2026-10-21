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

test("the live model benchmark refuses to run in CI", async () => {
  await assert.rejects(runBenchmark({ env: { CI: "true" } }), /disabled in CI/);
});
