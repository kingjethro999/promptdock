const { createHash } = require("node:crypto");

const fallbackModel = "claude-sonnet-4-6-free";
const cache = new Map();
const cacheMs = 15 * 60 * 1000;

function freeModelIds(payload) {
  if (!Array.isArray(payload?.data)) return [];
  return payload.data
    .map((entry) => entry?.id)
    .filter((id) => typeof id === "string" && /-free$/i.test(id));
}

function chooseFreeModel(ids, preferred) {
  const find = (name) =>
    ids.find((id) => id === name || id.endsWith(`/${name}`));
  return find(preferred) || find(fallbackModel) || ids[0] || fallbackModel;
}

async function siteFreeModel(env, request = fetch) {
  const base = (env.APMIX_BASE_URL || "https://api.apmix.ai/v1").replace(
    /\/+$/,
    "",
  );
  const key = createHash("sha256")
    .update(`${base}:${env.APMIX_API_KEY || ""}`)
    .digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.model;
  let model = fallbackModel;
  try {
    const response = await request(`${base}/models`, {
      headers: { Authorization: `Bearer ${env.APMIX_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok)
      model = chooseFreeModel(
        freeModelIds(await response.json()),
        env.APMIX_MODEL,
      );
  } catch {
    // Use the last confirmed free model if the catalog is unavailable.
  }
  cache.set(key, { model, expires: Date.now() + cacheMs });
  return model;
}

module.exports = {
  fallbackModel,
  freeModelIds,
  chooseFreeModel,
  siteFreeModel,
};
