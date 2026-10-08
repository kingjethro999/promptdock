const { randomUUID } = require("node:crypto");

const DEFAULT_LANGFUSE_BASEURL = "https://cloud.langfuse.com";
const DEFAULT_TIMEOUT_MS = 4000;

function isLangfuseEnabled(env = process.env) {
  if (!env) return false;
  const flag = env.ENABLE_LANGFUSE_TRACING;
  const isFlagTrue =
    flag === true || flag === "true" || flag === "1" || flag === 1;
  return Boolean(
    isFlagTrue && env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY,
  );
}

function normalizeUsage(rawUsage) {
  if (!rawUsage || typeof rawUsage !== "object") return undefined;
  const promptTokens =
    rawUsage.prompt_tokens ?? rawUsage.promptTokenCount ?? rawUsage.input_tokens;
  const completionTokens =
    rawUsage.completion_tokens ??
    rawUsage.candidatesTokenCount ??
    rawUsage.output_tokens;
  const totalTokens =
    rawUsage.total_tokens ??
    rawUsage.totalTokenCount ??
    ((promptTokens || 0) + (completionTokens || 0) || undefined);
  if (promptTokens == null && completionTokens == null && totalTokens == null)
    return undefined;
  return {
    input: promptTokens,
    output: completionTokens,
    total: totalTokens,
  };
}

async function recordLangfuseTrace(
  {
    traceId,
    name = "ai-generation",
    userId,
    input,
    output,
    startTime = new Date().toISOString(),
    endTime = new Date().toISOString(),
    generations = [],
    metadata = {},
    error,
  },
  env = process.env,
  request = fetch,
) {
  if (!isLangfuseEnabled(env)) return false;

  const baseUrl = (env.LANGFUSE_BASEURL || DEFAULT_LANGFUSE_BASEURL).replace(
    /\/+$/,
    "",
  );
  const endpoint = `${baseUrl}/api/public/ingestion`;
  const resolvedTraceId = traceId || randomUUID();

  const batch = [
    {
      id: randomUUID(),
      type: "trace-create",
      timestamp: startTime,
      body: {
        id: resolvedTraceId,
        name,
        userId: userId || undefined,
        input: input ?? null,
        output: output ?? (error ? { error } : null),
        metadata: {
          ...metadata,
          ...(error ? { error } : {}),
        },
      },
    },
  ];

  for (const gen of generations) {
    batch.push({
      id: randomUUID(),
      type: "generation-create",
      timestamp: gen.startTime || startTime,
      body: {
        id: randomUUID(),
        traceId: resolvedTraceId,
        name: `${gen.provider || "ai"}-generation`,
        model: gen.model || gen.provider,
        input: gen.input ?? null,
        output: gen.output ?? (gen.error ? { error: gen.error } : null),
        usage: normalizeUsage(gen.usage),
        startTime: gen.startTime || startTime,
        endTime: gen.endTime || endTime,
        level: gen.status === "error" || gen.error ? "ERROR" : "DEFAULT",
        statusMessage: gen.error || undefined,
        metadata: {
          provider: gen.provider,
          attempt: gen.attempt,
          status: gen.status,
        },
      },
    });
  }

  const credentials = Buffer.from(
    `${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`,
  ).toString("base64");

  try {
    const response = await request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ batch }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    // Non-blocking observability: never interrupt user requests on network or tracing errors
    return false;
  }
}

module.exports = {
  isLangfuseEnabled,
  normalizeUsage,
  recordLangfuseTrace,
};
