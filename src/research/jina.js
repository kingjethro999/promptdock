const { normalizeSources } = require("./firecrawl");

const JINA_READER_ENDPOINT = "https://r.jina.ai/";
const JINA_SEARCH_ENDPOINT = "https://s.jina.ai/";
const DEFAULT_TIMEOUT_MS = 12000;

async function jinaRequest(endpoint, body, env, request) {
  const timeout = Number(env.JINA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const response = await request(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.JINA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok)
    throw new Error(`Jina request failed with HTTP ${response.status}`);
  return response.json();
}

async function researchWithJina(decision, env = process.env, request = fetch) {
  const base = {
    provider: "jina",
    used: false,
    attempted: false,
    queries: decision?.queries || [],
    sources: [],
    reason: decision?.reason,
  };
  if (!decision?.required) return base;
  if (!env.JINA_API_KEY)
    return {
      ...base,
      attempted: true,
      unavailable: true,
      fallbackReason: "Jina research is not configured.",
    };

  const tasks = [];
  for (const url of (decision.targetUrls || []).slice(0, 2)) {
    tasks.push(jinaRequest(JINA_READER_ENDPOINT, { url }, env, request));
  }
  for (const query of (decision.queries || []).slice(0, 2)) {
    tasks.push(jinaRequest(JINA_SEARCH_ENDPOINT, { q: query }, env, request));
  }
  if (!tasks.length)
    return {
      ...base,
      attempted: true,
      unavailable: true,
      fallbackReason: "No research query could be prepared.",
    };

  const settled = await Promise.allSettled(tasks);
  const values = [];
  let failures = 0;
  for (const result of settled) {
    if (result.status === "rejected") {
      failures += 1;
      continue;
    }
    const payload = result.value;
    const data = Array.isArray(payload?.data)
      ? payload.data
      : payload?.data
        ? [payload.data]
        : [];
    values.push(...data);
  }
  const sources = normalizeSources(values);
  if (!sources.length)
    return {
      ...base,
      attempted: true,
      unavailable: true,
      fallbackReason: failures
        ? "Jina research sources were unavailable."
        : "No useful research sources were returned.",
    };
  return {
    ...base,
    attempted: true,
    used: true,
    sources,
    failedRequests: failures,
  };
}

module.exports = {
  JINA_READER_ENDPOINT,
  JINA_SEARCH_ENDPOINT,
  jinaRequest,
  researchWithJina,
};
