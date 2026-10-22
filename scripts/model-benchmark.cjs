#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_FIXTURE_DIR = path.join(ROOT, "benchmark", "fixtures");
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "benchmark-results");
const DEFAULT_MAX_TOKENS = 16384;
const DEFAULT_TIMEOUT_MS = 180000;

const SYSTEM_POLICY = `You refine prompts without summarizing away the user's intent.

Return only the complete refined prompt. Preserve every explicit requirement, constraint, example, file path, technology choice, dependency, negative instruction, and active decision. A later decision supersedes an earlier contradictory choice. Do not invent missing facts or replace supplied facts with placeholders. Improve clarity, organization, and executability while retaining the complete meaning of the source. If the source is already detailed, reorganize it with minimal semantic change.`;

function parsePositiveInteger(
  value,
  fallback,
  name,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return parsed;
}

function buildModelMatrix(env = process.env) {
  if (!env.NVIDIA_API_KEY || !env.GROQ_API_KEY) {
    throw new Error(
      "Set NVIDIA_API_KEY and GROQ_API_KEY explicitly before running the live benchmark.",
    );
  }

  const maxTokens = parsePositiveInteger(
    env.AI_BENCHMARK_MAX_TOKENS,
    DEFAULT_MAX_TOKENS,
    "AI_BENCHMARK_MAX_TOKENS",
    131072,
  );
  const pricesFor = (modelKey) => ({
    inputUsdPerMillion: parseOptionalPrice(
      env[`AI_BENCHMARK_${modelKey}_INPUT_USD_PER_MILLION`],
    ),
    outputUsdPerMillion: parseOptionalPrice(
      env[`AI_BENCHMARK_${modelKey}_OUTPUT_USD_PER_MILLION`],
    ),
  });
  const nvidiaBaseUrl = (
    env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"
  ).replace(/\/+$/, "");
  const groqBaseUrl = (
    env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
  ).replace(/\/+$/, "");

  const models = [
    {
      id: "nvidia-super-vl",
      provider: "NVIDIA",
      model:
        env.BENCHMARK_NVIDIA_SUPER_VL_MODEL ||
        "nvidia/nemotron-3.5-super-vl-120b-a12b",
      baseUrl: nvidiaBaseUrl,
      apiKeyEnv: "NVIDIA_API_KEY",
      maxTokens,
      prices: pricesFor("NVIDIA_SUPER_VL"),
    },
    {
      id: "nvidia-lightning",
      provider: "NVIDIA",
      model:
        env.BENCHMARK_NVIDIA_LIGHTNING_MODEL ||
        "nvidia/nemotron-3.5-lightning-30b-a3b",
      baseUrl: nvidiaBaseUrl,
      apiKeyEnv: "NVIDIA_API_KEY",
      maxTokens,
      prices: pricesFor("NVIDIA_LIGHTNING"),
    },
  ];

  models.push(
    {
      id: "nvidia-super-text",
      provider: "NVIDIA",
      model:
        env.BENCHMARK_NVIDIA_SUPER_MODEL || "nvidia/nemotron-3-super-120b-a12b",
      baseUrl: nvidiaBaseUrl,
      apiKeyEnv: "NVIDIA_API_KEY",
      maxTokens,
      prices: pricesFor("NVIDIA_SUPER_TEXT"),
    },
    {
      id: "nvidia-ultra-text",
      provider: "NVIDIA",
      model:
        env.BENCHMARK_NVIDIA_ULTRA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b",
      baseUrl: nvidiaBaseUrl,
      apiKeyEnv: "NVIDIA_API_KEY",
      maxTokens,
      prices: pricesFor("NVIDIA_ULTRA_TEXT"),
    },
  );

  models.push({
    id: "groq-gpt-oss-120b",
    provider: "Groq",
    model: env.BENCHMARK_GROQ_MODEL || "openai/gpt-oss-120b",
    baseUrl: groqBaseUrl,
    apiKeyEnv: "GROQ_API_KEY",
    maxTokens,
    prices: pricesFor("GROQ_GPT_OSS_120B"),
  });

  return models;
}

function parseOptionalPrice(value) {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error("Benchmark token prices must be non-negative numbers.");
  return parsed;
}

function estimateCost(usage, prices) {
  if (
    prices?.inputUsdPerMillion == null ||
    prices?.outputUsdPerMillion == null ||
    usage?.promptTokens == null ||
    usage?.completionTokens == null
  )
    return null;
  return (
    (usage.promptTokens * prices.inputUsdPerMillion +
      usage.completionTokens * prices.outputUsdPerMillion) /
    1_000_000
  );
}

function classifyBenchmarkError(error) {
  if (error?.benchmark?.httpStatus) return "http-error";
  if (
    error?.name === "AbortError" ||
    /operation was aborted|timed out/i.test(error?.message || "")
  ) {
    return "timeout";
  }
  if (
    error instanceof SyntaxError ||
    /invalid json|malformed response/i.test(error?.message || "")
  ) {
    return "invalid-response";
  }
  if (
    error?.cause?.code ||
    /fetch failed|network/i.test(error?.message || "")
  ) {
    return "network-error";
  }
  return "request-error";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

function matchesAnchorGroups(text, anchorGroups) {
  const normalized = normalizeText(text);
  return anchorGroups.some((group) =>
    group.every((anchor) => normalized.includes(normalizeText(anchor))),
  );
}

// Lexical anchors remain useful in fixture tests and diagnostics only. Published
// quality scores use the evidence-backed rubric review in scoreReviewedResponse.
function scoreResponse(fixture, output) {
  const requirements = fixture.requirements || [];
  const covered = requirements.filter((requirement) =>
    matchesAnchorGroups(output, requirement.anchors),
  );
  const missing = requirements.filter(
    (requirement) => !covered.includes(requirement),
  );
  const unsupported = (fixture.unsupportedAdditions || []).filter((addition) =>
    matchesAnchorGroups(output, addition.anchors),
  );
  const requirementCoverage = requirements.length
    ? covered.length / requirements.length
    : 1;
  const hardConstraintOmissions = missing
    .filter((requirement) => requirement.hard)
    .map((requirement) => requirement.id);

  return {
    requirementCoverage,
    coveredRequirementIds: covered.map((requirement) => requirement.id),
    missingRequirementIds: missing.map((requirement) => requirement.id),
    hardConstraintOmissions,
    unsupportedAdditions: unsupported.map((addition) => addition.id),
    passed:
      requirementCoverage === 1 &&
      hardConstraintOmissions.length === 0 &&
      unsupported.length === 0,
  };
}

function scoreReviewedResponse(fixture, assessment, output) {
  const requirements = fixture.requirements || [];
  const additions = fixture.unsupportedAdditions || [];
  const reviewedRequirements = assessment?.requirements || {};
  const reviewedAdditions = assessment?.unsupportedAdditions || {};
  const expectedRequirementIds = requirements.map(({ id }) => id).sort();
  const expectedAdditionIds = additions.map(({ id }) => id).sort();
  const actualRequirementIds = Object.keys(reviewedRequirements).sort();
  const actualAdditionIds = Object.keys(reviewedAdditions).sort();

  if (
    JSON.stringify(actualRequirementIds) !==
    JSON.stringify(expectedRequirementIds)
  ) {
    const missing = expectedRequirementIds.filter(
      (id) => !actualRequirementIds.includes(id),
    );
    const extra = actualRequirementIds.filter(
      (id) => !expectedRequirementIds.includes(id),
    );
    throw new Error(
      `Incomplete requirement review for ${fixture.id}; missing: ${missing.join(", ") || "none"}; unknown: ${extra.join(", ") || "none"}.`,
    );
  }
  if (
    JSON.stringify(actualAdditionIds) !== JSON.stringify(expectedAdditionIds)
  ) {
    throw new Error(
      `Incomplete unsupported-addition review for ${fixture.id}.`,
    );
  }

  const evidence = {};
  let points = 0;
  for (const requirement of requirements) {
    const judgment = reviewedRequirements[requirement.id];
    if (
      !judgment ||
      !["covered", "partial", "missing"].includes(judgment.rating)
    ) {
      throw new Error(
        `Invalid rubric rating for ${fixture.id}/${requirement.id}.`,
      );
    }
    const quote =
      typeof judgment.evidence === "string" ? judgment.evidence.trim() : "";
    if (judgment.rating !== "missing" && !quote) {
      throw new Error(
        `Evidence is required for covered criteria ${requirement.id}.`,
      );
    }
    if (quote && !normalizeText(output).includes(normalizeText(quote))) {
      throw new Error(
        `Review evidence for ${requirement.id} was not found in the generated response.`,
      );
    }
    evidence[requirement.id] = quote;
    points +=
      judgment.rating === "covered"
        ? 1
        : judgment.rating === "partial"
          ? 0.5
          : 0;
  }

  const missingRequirementIds = requirements
    .filter(({ id }) => reviewedRequirements[id].rating === "missing")
    .map(({ id }) => id);
  const partialRequirementIds = requirements
    .filter(({ id }) => reviewedRequirements[id].rating === "partial")
    .map(({ id }) => id);
  const hardConstraintOmissions = requirements
    .filter(
      ({ id, hard }) => hard && reviewedRequirements[id].rating !== "covered",
    )
    .map(({ id }) => id);
  const unsupportedAdditions = additions
    .filter(({ id }) => reviewedAdditions[id].present === true)
    .map(({ id }) => id);
  for (const addition of additions) {
    const judgment = reviewedAdditions[addition.id];
    if (!judgment || typeof judgment.present !== "boolean") {
      throw new Error(
        `Invalid addition review for ${fixture.id}/${addition.id}.`,
      );
    }
    const quote =
      typeof judgment.evidence === "string" ? judgment.evidence.trim() : "";
    if (judgment.present && !quote) {
      throw new Error(
        `Evidence is required for unsupported addition ${addition.id}.`,
      );
    }
    if (quote && !normalizeText(output).includes(normalizeText(quote))) {
      throw new Error(
        `Review evidence for ${addition.id} was not found in the generated response.`,
      );
    }
    evidence[addition.id] = quote;
  }
  const requirementCount = requirements.length;
  const requirementCoverage = requirementCount ? points / requirementCount : 1;

  return {
    requirementCoverage,
    requirementCount,
    requirementPoints: points,
    coveredRequirementIds: requirements
      .filter(({ id }) => reviewedRequirements[id].rating === "covered")
      .map(({ id }) => id),
    partialRequirementIds,
    missingRequirementIds,
    hardConstraintOmissions,
    unsupportedAdditions,
    evidence,
    passed:
      requirementCoverage === 1 &&
      hardConstraintOmissions.length === 0 &&
      unsupportedAdditions.length === 0,
  };
}

function applyReviews(report, reviews) {
  return {
    ...report,
    results: report.results.map((result) => {
      if (!result.validResponse || result.truncated || result.errorStatus) {
        return { ...result, scoring: null, reviewStatus: "not-evaluable" };
      }
      const assessment = reviews?.[result.modelId]?.[result.fixtureId];
      if (!assessment) {
        return { ...result, scoring: null, reviewStatus: "pending" };
      }
      const fixture = loadFixtures().find(({ id }) => id === result.fixtureId);
      if (!fixture)
        throw new Error(`Unknown reviewed fixture ${result.fixtureId}.`);
      return {
        ...result,
        scoring: scoreReviewedResponse(fixture, assessment, result.output),
        reviewStatus: "reviewed",
      };
    }),
  };
}

function parseCompletion(payload) {
  const choice =
    payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = choice?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  const finishReason = choice?.finish_reason || "missing";
  const truncated = ["length", "max_tokens"].includes(finishReason);
  const usage = payload?.usage || {};

  return {
    servedModel: typeof payload?.model === "string" ? payload.model : null,
    text,
    finishReason,
    truncated,
    validResponse: Boolean(text) && !truncated,
    usage: {
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      reasoningTokens:
        usage.completion_tokens_details?.reasoning_tokens ??
        usage.reasoning_tokens ??
        null,
    },
  };
}

function validateAnchorItem(item, label, fixtureId) {
  if (!item || typeof item.id !== "string" || !Array.isArray(item.anchors)) {
    throw new Error(`${fixtureId}: ${label} must have an id and anchors.`);
  }
  if (
    item.anchors.length === 0 ||
    item.anchors.some(
      (group) =>
        !Array.isArray(group) ||
        group.length === 0 ||
        group.some((anchor) => typeof anchor !== "string" || !anchor.trim()),
    )
  ) {
    throw new Error(`${fixtureId}: ${item.id} has invalid anchor groups.`);
  }
}

function loadFixtures(fixtureDir = DEFAULT_FIXTURE_DIR, onlyFixtureId) {
  const manifests = [];
  const collectManifests = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectManifests(entryPath);
      else if (entry.isFile() && entry.name.endsWith(".json"))
        manifests.push(entryPath);
    }
  };
  collectManifests(fixtureDir);
  manifests.sort();
  const fixtures = manifests.map((manifestPath) => {
    const name = path.relative(fixtureDir, manifestPath);
    const fixture = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!fixture.id || !fixture.title || !fixture.sourceFile) {
      throw new Error(`${name}: fixture requires id, title, and sourceFile.`);
    }
    for (const requirement of fixture.requirements || []) {
      validateAnchorItem(requirement, "requirement", fixture.id);
    }
    for (const addition of fixture.unsupportedAdditions || []) {
      validateAnchorItem(addition, "unsupported addition", fixture.id);
    }
    const sourcePath = path.resolve(
      path.dirname(manifestPath),
      fixture.sourceFile,
    );
    const relativeSource = path.relative(fixtureDir, sourcePath);
    if (relativeSource.startsWith("..") || path.isAbsolute(relativeSource)) {
      throw new Error(
        `${fixture.id}: sourceFile must remain inside the fixture directory.`,
      );
    }
    fixture.source = fs.readFileSync(sourcePath, "utf8");
    return fixture;
  });
  const selected = onlyFixtureId
    ? fixtures.filter((fixture) => fixture.id === onlyFixtureId)
    : fixtures;
  if (selected.length === 0) {
    throw new Error(
      onlyFixtureId
        ? `Unknown benchmark fixture: ${onlyFixtureId}`
        : "No benchmark fixtures were found.",
    );
  }
  return selected;
}

function fixturePrompt(fixture) {
  return `Refine the source below into one complete prompt for a downstream AI system. Return the refined prompt only.\n\nSOURCE (${fixture.title})\n---\n${fixture.source}\n---\nEND SOURCE`;
}

async function requestCompletion(model, fixture, env, fetchImpl = fetch) {
  const startedAt = Date.now();
  const timeoutMs = parsePositiveInteger(
    env.AI_BENCHMARK_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    "AI_BENCHMARK_TIMEOUT_MS",
    900000,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${model.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env[model.apiKeyEnv]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.model,
        messages: [
          { role: "system", content: SYSTEM_POLICY },
          { role: "user", content: fixturePrompt(fixture) },
        ],
        temperature: 0,
        max_tokens: model.maxTokens,
        ...(model.provider === "NVIDIA"
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {}),
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        // Keep status and headers even if the provider returned no JSON.
      }
      const rawCode = payload?.error?.code ?? payload?.code;
      const providerCode =
        typeof rawCode === "string" && /^[\w.-]{1,80}$/.test(rawCode)
          ? rawCode
          : null;
      const rawRequestId =
        response.headers.get("x-request-id") ||
        response.headers.get("request-id") ||
        response.headers.get("x-nvidia-request-id");
      const requestId =
        rawRequestId && /^[\w.-]{1,120}$/.test(rawRequestId)
          ? rawRequestId
          : null;
      const retryAfter = response.headers.get("retry-after");
      const error = new Error(
        `${model.provider} returned HTTP ${response.status}.`,
      );
      error.benchmark = {
        httpStatus: response.status,
        providerCode,
        requestId,
        retryAfter:
          retryAfter && /^[\w.-]{1,80}$/.test(retryAfter) ? retryAfter : null,
        latencyMs,
      };
      throw error;
    }
    const payload = await response.json();
    return { ...parseCompletion(payload), latencyMs };
  } catch (error) {
    if (error instanceof Error) {
      error.benchmark ||= { latencyMs: Date.now() - startedAt };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runBenchmark(options = {}) {
  const env = options.env || process.env;
  if (String(env.CI || "").toLowerCase() === "true" || env.CI === "1") {
    throw new Error("The live model benchmark is disabled in CI.");
  }
  const configuredModels = buildModelMatrix(env);
  const models = options.modelId
    ? configuredModels.filter(({ id }) => id === options.modelId)
    : configuredModels;
  if (models.length === 0)
    throw new Error(`Unknown benchmark model: ${options.modelId}`);
  const fixtures = loadFixtures(
    options.fixtureDir || DEFAULT_FIXTURE_DIR,
    options.fixtureId,
  );
  const results = [];

  for (const model of models) {
    for (const fixture of fixtures) {
      process.stdout.write(`Benchmarking ${model.model} on ${fixture.id}... `);
      try {
        const completion = await requestCompletion(
          model,
          fixture,
          env,
          options.fetchImpl,
        );
        const estimatedCostUsd = estimateCost(completion.usage, model.prices);
        results.push({
          modelId: model.id,
          provider: model.provider,
          model: model.model,
          servedModel: completion.servedModel,
          fixtureId: fixture.id,
          fixtureTitle: fixture.title,
          validResponse: completion.validResponse,
          finishReason: completion.finishReason,
          truncated: completion.truncated,
          errorCategory: completion.truncated
            ? "truncated"
            : completion.validResponse
              ? null
              : "invalid-response",
          latencyMs: completion.latencyMs,
          usage: completion.usage,
          estimatedCostUsd,
          scoring: null,
          reviewStatus: completion.validResponse ? "pending" : "not-evaluable",
          outputSha256: crypto
            .createHash("sha256")
            .update(completion.text)
            .digest("hex"),
          outputCharacters: completion.text.length,
          ...(options.retainOutput ? { output: completion.text } : {}),
        });
        process.stdout.write(
          `${completion.validResponse ? "RESPONSE" : "INVALID RESPONSE"}\n`,
        );
      } catch (error) {
        results.push({
          modelId: model.id,
          provider: model.provider,
          model: model.model,
          servedModel: null,
          fixtureId: fixture.id,
          fixtureTitle: fixture.title,
          validResponse: false,
          finishReason: "error",
          truncated: false,
          errorCategory: classifyBenchmarkError(error),
          latencyMs: error?.benchmark?.latencyMs ?? null,
          errorStatus: error?.benchmark?.httpStatus ?? null,
          errorCode: error?.benchmark?.providerCode ?? null,
          errorRequestId: error?.benchmark?.requestId ?? null,
          retryAfter: error?.benchmark?.retryAfter ?? null,
          usage: {
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            reasoningTokens: null,
          },
          estimatedCostUsd: null,
          scoring: null,
          reviewStatus: "not-evaluable",
          error:
            error instanceof Error ? error.message : "Unknown benchmark error",
          outputSha256: null,
          outputCharacters: 0,
        });
        const status = error?.benchmark?.httpStatus;
        const code = error?.benchmark?.providerCode;
        process.stdout.write(
          `ERROR${status ? ` (HTTP ${status}${code ? ` ${code}` : ""})` : ""}\n`,
        );
      }
    }
  }

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    configuration: {
      maxTokens: models[0].maxTokens,
      timeoutMs: parsePositiveInteger(
        env.AI_BENCHMARK_TIMEOUT_MS,
        DEFAULT_TIMEOUT_MS,
        "AI_BENCHMARK_TIMEOUT_MS",
        900000,
      ),
      fixtureCount: fixtures.length,
      modelCount: models.length,
      nvidiaThinkingEnabled: false,
      pricingConfigured: models.every(
        ({ prices: item }) =>
          item?.inputUsdPerMillion != null && item?.outputUsdPerMillion != null,
      ),
      policySha256: crypto
        .createHash("sha256")
        .update(SYSTEM_POLICY)
        .digest("hex"),
    },
    results: options.reviews
      ? applyReviews({ results }, options.reviews).results
      : results,
  };
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function display(value) {
  return value === null || value === undefined
    ? "—"
    : value.toLocaleString("en-US");
}

function renderMarkdown(report) {
  const lines = [
    "# PromptDock Model Fidelity Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `All candidates used the same preservation policy and a maximum completion budget of ${display(report.configuration.maxTokens)} tokens. Outputs are identified by SHA-256 rather than embedded in the report.`,
    "",
    "| Provider | Model | Fixture | Coverage | Hard omissions | Unsupported additions | Valid | Finish | Truncated | Latency | Prompt / completion / total tokens | Est. cost (USD) | Output SHA-256 |",
    "| --- | --- | --- | ---: | ---: | ---: | :---: | --- | :---: | ---: | --- | ---: | --- |",
  ];

  for (const result of report.results) {
    const usage = result.usage || {};
    lines.push(
      `| ${result.provider} | \`${result.model}\` | ${result.fixtureTitle} | ${result.scoring ? percent(result.scoring.requirementCoverage) : "Not reviewed"} | ${result.scoring?.hardConstraintOmissions.length ?? "—"} | ${result.scoring?.unsupportedAdditions.length ?? "—"} | ${result.validResponse ? "Yes" : "No"} | ${result.finishReason} | ${result.truncated ? "Yes" : "No"} | ${result.latencyMs === null ? "—" : `${display(result.latencyMs)} ms`} | ${display(usage.promptTokens)} / ${display(usage.completionTokens)} / ${display(usage.totalTokens)} | ${result.estimatedCostUsd == null ? "Unknown" : `$${result.estimatedCostUsd.toFixed(6)}`} | ${result.outputSha256 || "—"} |`,
    );
  }

  lines.push("", "## Failures", "");
  const failures = report.results.filter(
    (result) => result.scoring?.passed !== true,
  );
  if (failures.length === 0) {
    lines.push("All model and fixture combinations passed.");
  } else {
    for (const result of failures) {
      const details = [
        result.error ? `error: ${result.error}` : null,
        result.scoring?.missingRequirementIds?.length
          ? `missing: ${result.scoring.missingRequirementIds.join(", ")}`
          : null,
        result.scoring?.unsupportedAdditions?.length
          ? `unsupported additions: ${result.scoring.unsupportedAdditions.join(", ")}`
          : null,
        result.truncated ? "provider reported truncation" : null,
      ].filter(Boolean);
      lines.push(
        `- **${result.model} / ${result.fixtureId}:** ${details.join("; ") || "quality gate failed"}.`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function publicReport(report) {
  const groups = new Map();
  for (const result of report.results) {
    if (!groups.has(result.modelId)) groups.set(result.modelId, []);
    groups.get(result.modelId).push(result);
  }
  const models = [...groups.entries()].map(([modelId, results]) => {
    const valid = results.filter(
      ({ validResponse, truncated }) => validResponse && !truncated,
    );
    const reviewed = valid.filter(
      ({ reviewStatus, scoring }) => reviewStatus === "reviewed" && scoring,
    );
    const requirementCount = reviewed.reduce(
      (sum, { scoring }) => sum + (scoring.requirementCount || 0),
      0,
    );
    const requirementPoints = reviewed.reduce(
      (sum, { scoring }) => sum + (scoring.requirementPoints || 0),
      0,
    );
    const latencies = results
      .map(({ latencyMs }) => latencyMs)
      .filter((latency) => typeof latency === "number");
    const allPricesKnown = results.every(
      ({ estimatedCostUsd }) => estimatedCostUsd != null,
    );
    const errorBreakdown = {};
    for (const result of results) {
      if (result.validResponse || result.truncated) continue;
      const label = result.errorStatus
        ? `HTTP ${result.errorStatus}`
        : result.errorCategory || "request error";
      errorBreakdown[label] = (errorBreakdown[label] || 0) + 1;
    }
    return {
      modelId,
      servedModels: [
        ...new Set(valid.map(({ servedModel }) => servedModel).filter(Boolean)),
      ],
      attemptedCount: results.length,
      validResponseCount: valid.length,
      responseRate: results.length ? valid.length / results.length : null,
      errorCount: results.filter(
        ({ validResponse, truncated }) => !validResponse && !truncated,
      ).length,
      errorBreakdown,
      truncatedCount: results.filter(({ truncated }) => truncated).length,
      evaluatedCount: reviewed.length,
      requirementCount,
      requirementCoverage: requirementCount
        ? requirementPoints / requirementCount
        : null,
      strictCompleteCount: reviewed.filter(({ scoring }) => scoring.passed)
        .length,
      strictCompleteRate: reviewed.length
        ? reviewed.filter(({ scoring }) => scoring.passed).length /
          reviewed.length
        : null,
      hardConstraintOmissions: reviewed.reduce(
        (sum, { scoring }) => sum + scoring.hardConstraintOmissions.length,
        0,
      ),
      unsupportedAdditionCount: reviewed.reduce(
        (sum, { scoring }) => sum + scoring.unsupportedAdditions.length,
        0,
      ),
      averageLatencyMs: latencies.length
        ? Math.round(
            latencies.reduce((sum, latency) => sum + latency, 0) /
              latencies.length,
          )
        : null,
      totalTokens: results.reduce(
        (sum, { usage }) => sum + (usage?.totalTokens || 0),
        0,
      ),
      estimatedCostUsd: allPricesKnown
        ? results.reduce(
            (sum, { estimatedCostUsd }) => sum + estimatedCostUsd,
            0,
          )
        : null,
    };
  });

  return {
    generatedAt: report.generatedAt,
    configuration: {
      maxTokens: report.configuration?.maxTokens ?? null,
      timeoutMs: report.configuration?.timeoutMs ?? null,
      fixtureCount: report.configuration?.fixtureCount ?? null,
      modelCount: report.configuration?.modelCount ?? models.length,
      nvidiaThinkingEnabled:
        report.configuration?.nvidiaThinkingEnabled ?? null,
    },
    models,
    results: report.results.map((result) => ({
      modelId: result.modelId,
      servedModel: result.servedModel ?? null,
      fixtureId: result.fixtureId,
      validResponse: result.validResponse,
      finishReason: result.finishReason,
      truncated: result.truncated,
      errorCategory: result.errorCategory ?? null,
      reviewStatus: result.reviewStatus || "pending",
      errorStatus: result.errorStatus ?? null,
      errorCode: result.errorCode ?? null,
      latencyMs: result.latencyMs,
      usage: {
        totalTokens: result.usage?.totalTokens ?? null,
      },
      estimatedCostUsd: result.estimatedCostUsd,
      scoring: result.scoring
        ? {
            requirementCoverage: result.scoring.requirementCoverage,
            requirementCount: result.scoring.requirementCount,
            requirementPoints: result.scoring.requirementPoints,
            hardConstraintOmissions: result.scoring.hardConstraintOmissions,
            unsupportedAdditions: result.scoring.unsupportedAdditions,
            passed: result.scoring.passed,
          }
        : null,
    })),
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--fixture") {
      options.fixtureId = argv[index + 1];
      index += 1;
    } else if (argument === "--model") {
      options.modelId = argv[index + 1];
      index += 1;
    } else if (argument === "--retain-output") {
      options.retainOutput = true;
    } else if (argument === "--output-dir") {
      options.outputDir = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--publish") {
      options.publish = true;
    } else if (argument === "--publish-report") {
      options.publishReport = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--reviews") {
      options.reviewsPath = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown benchmark argument: ${argument}`);
    }
  }
  return options;
}

function helpText() {
  return `Usage: npm run benchmark:models -- [--model ID] [--fixture ID] [--output-dir PATH] [--retain-output] [--publish]\n       npm run benchmark:models -- --publish-report REPORT.json --reviews REVIEWS.json\n\nRequired environment variables for live runs:\n  NVIDIA_API_KEY\n  GROQ_API_KEY\n\nOptional environment variables:\n  AI_BENCHMARK_MAX_TOKENS (default: 16384)\n  AI_BENCHMARK_TIMEOUT_MS (default: 180000)\n  BENCHMARK_NVIDIA_SUPER_MODEL\n  BENCHMARK_NVIDIA_ULTRA_MODEL\n\n--retain-output stores completions only in the ignored local report.\n--publish writes a sanitized report for unreviewed availability data.\n--publish-report combines an existing retained report with reviewed rubric evidence, stores a local reviewed report, and publishes sanitized metrics.\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }
  if (options.publishReport) {
    if (!options.reviewsPath) {
      throw new Error("--publish-report requires a local --reviews JSON file.");
    }
    const sourceReport = JSON.parse(
      fs.readFileSync(options.publishReport, "utf8"),
    );
    const reviews = JSON.parse(fs.readFileSync(options.reviewsPath, "utf8"));
    const reviewedReport = applyReviews(sourceReport, reviews);
    const reviewedPath = options.publishReport.replace(
      /\.json$/i,
      "-reviewed.json",
    );
    fs.writeFileSync(
      reviewedPath,
      `${JSON.stringify(reviewedReport, null, 2)}\n`,
    );
    const publicPath = path.join(ROOT, "public", "model-benchmark.json");
    fs.writeFileSync(
      publicPath,
      `${JSON.stringify(publicReport(reviewedReport), null, 2)}\n`,
    );
    process.stdout.write(
      `Reviewed local report: ${reviewedPath}\nPublic benchmark data: ${publicPath}\n`,
    );
    return;
  }
  const report = await runBenchmark(options);
  const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `model-benchmark-${timestamp}.json`);
  const markdownPath = path.join(outputDir, `model-benchmark-${timestamp}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderMarkdown(report));
  if (options.publish) {
    const publicPath = path.join(ROOT, "public", "model-benchmark.json");
    fs.writeFileSync(
      publicPath,
      `${JSON.stringify(publicReport(report), null, 2)}\n`,
    );
    process.stdout.write(`Public benchmark data: ${publicPath}\n`);
  }
  process.stdout.write(
    `JSON report: ${jsonPath}\nMarkdown report: ${markdownPath}\n`,
  );
}

module.exports = {
  SYSTEM_POLICY,
  buildModelMatrix,
  classifyBenchmarkError,
  estimateCost,
  fixturePrompt,
  loadFixtures,
  parseCompletion,
  renderMarkdown,
  publicReport,
  applyReviews,
  requestCompletion,
  runBenchmark,
  scoreResponse,
  scoreReviewedResponse,
  parseOptionalPrice,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Benchmark failed."}\n`,
    );
    process.exitCode = 1;
  });
}
