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

  if (env.BENCHMARK_NVIDIA_SUPER_MODEL) {
    models.push({
      id: "nvidia-super-text",
      provider: "NVIDIA",
      model: env.BENCHMARK_NVIDIA_SUPER_MODEL,
      baseUrl: nvidiaBaseUrl,
      apiKeyEnv: "NVIDIA_API_KEY",
      maxTokens,
      prices: pricesFor("NVIDIA_SUPER_TEXT"),
    });
  }

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

function parseCompletion(payload) {
  const choice =
    payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = choice?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  const finishReason = choice?.finish_reason || "missing";
  const truncated = ["length", "max_tokens"].includes(finishReason);
  const usage = payload?.usage || {};

  return {
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
        const scoring = scoreResponse(fixture, completion.text);
        const accepted = completion.validResponse && scoring.passed;
        const estimatedCostUsd = estimateCost(completion.usage, model.prices);
        results.push({
          modelId: model.id,
          provider: model.provider,
          model: model.model,
          fixtureId: fixture.id,
          fixtureTitle: fixture.title,
          validResponse: completion.validResponse,
          finishReason: completion.finishReason,
          truncated: completion.truncated,
          latencyMs: completion.latencyMs,
          usage: completion.usage,
          estimatedCostUsd,
          scoring: { ...scoring, passed: accepted },
          outputSha256: crypto
            .createHash("sha256")
            .update(completion.text)
            .digest("hex"),
          outputCharacters: completion.text.length,
          ...(options.retainOutput ? { output: completion.text } : {}),
        });
        process.stdout.write(`${accepted ? "PASS" : "FAIL"}\n`);
      } catch (error) {
        results.push({
          modelId: model.id,
          provider: model.provider,
          model: model.model,
          fixtureId: fixture.id,
          fixtureTitle: fixture.title,
          validResponse: false,
          finishReason: "error",
          truncated: false,
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
          scoring: {
            requirementCoverage: 0,
            coveredRequirementIds: [],
            missingRequirementIds: [],
            hardConstraintOmissions: [],
            unsupportedAdditions: [],
            passed: false,
          },
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
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    configuration: {
      maxTokens: models[0].maxTokens,
      fixtureCount: fixtures.length,
      modelCount: models.length,
      pricingConfigured: models.every(
        ({ prices: item }) =>
          item?.inputUsdPerMillion != null && item?.outputUsdPerMillion != null,
      ),
      policySha256: crypto
        .createHash("sha256")
        .update(SYSTEM_POLICY)
        .digest("hex"),
    },
    results,
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
      `| ${result.provider} | \`${result.model}\` | ${result.fixtureTitle} | ${percent(result.scoring.requirementCoverage)} | ${result.scoring.hardConstraintOmissions.length} | ${result.scoring.unsupportedAdditions.length} | ${result.validResponse ? "Yes" : "No"} | ${result.finishReason} | ${result.truncated ? "Yes" : "No"} | ${result.latencyMs === null ? "—" : `${display(result.latencyMs)} ms`} | ${display(usage.promptTokens)} / ${display(usage.completionTokens)} / ${display(usage.totalTokens)} | ${result.estimatedCostUsd == null ? "Unknown" : `$${result.estimatedCostUsd.toFixed(6)}`} | ${result.outputSha256 || "—"} |`,
    );
  }

  lines.push("", "## Failures", "");
  const failures = report.results.filter((result) => !result.scoring.passed);
  if (failures.length === 0) {
    lines.push("All model and fixture combinations passed.");
  } else {
    for (const result of failures) {
      const details = [
        result.error ? `error: ${result.error}` : null,
        result.scoring.missingRequirementIds?.length
          ? `missing: ${result.scoring.missingRequirementIds.join(", ")}`
          : null,
        result.scoring.unsupportedAdditions?.length
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
  return {
    generatedAt: report.generatedAt,
    results: report.results.map((result) => ({
      modelId: result.modelId,
      fixtureId: result.fixtureId,
      validResponse: result.validResponse,
      finishReason: result.finishReason,
      truncated: result.truncated,
      errorStatus: result.errorStatus ?? null,
      errorCode: result.errorCode ?? null,
      latencyMs: result.latencyMs,
      usage: {
        totalTokens: result.usage?.totalTokens ?? null,
      },
      estimatedCostUsd: result.estimatedCostUsd,
      scoring: {
        requirementCoverage: result.scoring.requirementCoverage,
        hardConstraintOmissions: result.scoring.hardConstraintOmissions,
        unsupportedAdditions: result.scoring.unsupportedAdditions,
        passed: result.scoring.passed,
      },
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
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown benchmark argument: ${argument}`);
    }
  }
  return options;
}

function helpText() {
  return `Usage: npm run benchmark:models -- [--model ID] [--fixture ID] [--output-dir PATH] [--retain-output] [--publish]\n\nRequired environment variables:\n  NVIDIA_API_KEY\n  GROQ_API_KEY\n\nOptional environment variables:\n  AI_BENCHMARK_MAX_TOKENS (default: 16384)\n  AI_BENCHMARK_TIMEOUT_MS (default: 180000)\n  BENCHMARK_NVIDIA_SUPER_MODEL (adds the older text-only Super candidate)\n\n--retain-output stores completions only in the ignored local report.\n--publish writes a sanitized score summary to public/model-benchmark.json for the landing page.\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
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
  estimateCost,
  fixturePrompt,
  loadFixtures,
  parseCompletion,
  renderMarkdown,
  publicReport,
  requestCompletion,
  runBenchmark,
  scoreResponse,
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
