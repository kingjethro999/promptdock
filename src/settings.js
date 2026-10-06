const {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} = require("node:crypto");
const database = require("./database");

const providerTypes = ["groq", "gemini", "apmix", "openai", "anthropic"];
const customTypes = new Set(["openai", "anthropic"]);
const defaultNames = {
  groq: "Groq",
  gemini: "Gemini",
  apmix: "APMIX",
  openai: "Custom OpenAI",
  anthropic: "Custom Anthropic",
};
const maxProviders = 10;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rowColumns =
  "provider_id, name, provider, base_url, model, vision_model, active, updated_at";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function encryptionKey(env = process.env) {
  const value = env.BYOK_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  return Buffer.from(value, "hex");
}

function encryptKey(userId, value, env = process.env) {
  const key = encryptionKey(env);
  if (!key) throw new Error("BYOK encryption is not configured.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptKey(userId, encoded, env = process.env) {
  const key = encryptionKey(env);
  if (!key) throw new Error("BYOK encryption is not configured.");
  const parts = String(encoded)
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16)
    throw new Error("Saved provider key is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", key, parts[0]);
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(parts[1]);
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString(
    "utf8",
  );
}

function normalizeBaseUrl(provider, value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (raw.length > 200) throw fail("Base URL must be 200 characters or fewer.");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw fail("Enter a valid base URL such as https://api.example.com/v1.");
  }
  if (url.username || url.password)
    throw fail("Base URL must not include a username or password.");
  if (url.search || url.hash)
    throw fail("Base URL must not include a query or fragment.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const loopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw fail("Base URL must use HTTPS.");
  let pathname = url.pathname.replace(/\/+$/, "");
  if (provider === "anthropic")
    pathname = pathname.replace(/\/v1\/messages$/, "").replace(/\/v1$/, "");
  if (provider === "openai")
    pathname = pathname.replace(/\/chat\/completions$/, "");
  const base = `${url.origin}${pathname}`;
  if (base.length > 200)
    throw fail("Base URL must be 200 characters or fewer.");
  return base;
}

function validateSetting(input) {
  const provider = input?.provider;
  const model = typeof input?.model === "string" ? input.model.trim() : "";
  const visionModel =
    typeof input?.visionModel === "string" ? input.visionModel.trim() : "";
  const apiKey = typeof input?.apiKey === "string" ? input.apiKey.trim() : "";
  if (!["groq", "gemini", "apmix"].includes(provider))
    throw fail("Choose Groq, Gemini, or APMIX.");
  if (!/^[A-Za-z0-9._:/-]{2,120}$/.test(model))
    throw fail("Enter a valid model ID.");
  if (visionModel && !/^[A-Za-z0-9._:/-]{2,120}$/.test(visionModel))
    throw fail("Enter a valid image model ID.");
  if (apiKey && (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey)))
    throw fail("Enter a valid API key.");
  return { provider, model, visionModel, apiKey };
}

function validateProvider(input) {
  const provider = input?.provider;
  const name =
    typeof input?.name === "string"
      ? input.name.trim().replace(/\s+/g, " ")
      : "";
  const model = typeof input?.model === "string" ? input.model.trim() : "";
  const visionModel =
    typeof input?.visionModel === "string" ? input.visionModel.trim() : "";
  const apiKey = typeof input?.apiKey === "string" ? input.apiKey.trim() : "";
  if (!providerTypes.includes(provider))
    throw fail("Choose a supported provider.");
  if (!name || name.length > 40 || /[\r\n\t]/.test(name))
    throw fail("Give this provider a name of 1 to 40 characters.");
  if (!/^[A-Za-z0-9._:/-]{2,120}$/.test(model))
    throw fail("Enter a valid model ID.");
  if (visionModel && !/^[A-Za-z0-9._:/-]{2,120}$/.test(visionModel))
    throw fail("Enter a valid image model ID.");
  if (apiKey && (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey)))
    throw fail("Enter a valid API key.");
  const baseUrl = normalizeBaseUrl(provider, input?.baseUrl);
  if (customTypes.has(provider) && !baseUrl)
    throw fail("Enter the base URL for this endpoint.");
  return {
    name,
    provider,
    baseUrl: customTypes.has(provider) ? baseUrl : "",
    model,
    visionModel,
    apiKey,
  };
}

function providerFromRow(row) {
  return {
    providerId: row.provider_id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    visionModel: row.vision_model || "",
    baseUrl: row.base_url || "",
    active: Boolean(row.active),
    updatedAt: row.updated_at || null,
  };
}

async function existingRows(userId) {
  await database.ensureSchema();
  const result = await database.pool.query(
    `SELECT provider_id, name, provider, encrypted_key
    FROM user_ai_providers WHERE user_id = $1 ORDER BY created_at, name`,
    [userId],
  );
  return result.rows;
}

async function getSettings(userId) {
  await database.ensureSchema();
  const result = await database.pool.query(
    `SELECT ${rowColumns} FROM user_ai_providers WHERE user_id = $1
    ORDER BY active DESC, created_at, name`,
    [userId],
  );
  const providers = result.rows.map(providerFromRow);
  const active = providers.find((entry) => entry.active) || null;
  return {
    available: Boolean(encryptionKey()),
    providers,
    activeProviderId: active ? active.providerId : null,
    provider: active ? active.provider : null,
    model: active ? active.model : "",
    hasKey: Boolean(active),
    updatedAt: active ? active.updatedAt : null,
  };
}

async function saveProvider(userId, input) {
  const fields = validateProvider(input);
  if (!encryptionKey()) throw fail("BYOK encryption is not configured.", 503);
  const providerId =
    typeof input?.providerId === "string" ? input.providerId.trim() : "";
  if (providerId && !uuidPattern.test(providerId))
    throw fail("Provider not found.", 404);
  const rows = await existingRows(userId);
  const existing = providerId
    ? rows.find((row) => row.provider_id === providerId)
    : null;
  if (providerId && !existing) throw fail("Provider not found.", 404);
  const clash = rows.find(
    (row) =>
      row.name.toLowerCase() === fields.name.toLowerCase() &&
      row.provider_id !== providerId,
  );
  if (clash) throw fail("You already have a provider with that name.");
  if (!existing && rows.length >= maxProviders)
    throw fail(`You can save up to ${maxProviders} providers.`);
  if (!fields.apiKey && !existing)
    throw fail("Enter an API key for this provider.");
  const encrypted = fields.apiKey
    ? encryptKey(userId, fields.apiKey)
    : existing.encrypted_key;
  const saved = providerId
    ? await database.pool.query(
        `WITH cleared AS (
          UPDATE user_ai_providers SET active = false
          WHERE user_id = $1 AND provider_id <> $2::uuid AND active RETURNING 1
        )
        UPDATE user_ai_providers
        SET name = $3, provider = $4, base_url = $5, model = $6,
          encrypted_key = $7, vision_model = $8, active = true, updated_at = now()
        WHERE user_id = $1 AND provider_id = $2::uuid
        RETURNING ${rowColumns}`,
        [
          userId,
          providerId,
          fields.name,
          fields.provider,
          fields.baseUrl,
          fields.model,
          encrypted,
          fields.visionModel,
        ],
      )
    : await database.pool.query(
        `WITH cleared AS (
          UPDATE user_ai_providers SET active = false
          WHERE user_id = $1 AND active RETURNING 1
        )
        INSERT INTO user_ai_providers
          (user_id, name, provider, base_url, model, encrypted_key, vision_model, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING ${rowColumns}`,
        [
          userId,
          fields.name,
          fields.provider,
          fields.baseUrl,
          fields.model,
          encrypted,
          fields.visionModel,
        ],
      );
  if (!saved.rows[0]) throw fail("Provider not found.", 404);
  return getSettings(userId);
}

async function setActiveProvider(userId, input) {
  const raw =
    input && typeof input === "object" && "providerId" in input
      ? input.providerId
      : input;
  const providerId =
    raw === null || raw === undefined || raw === "" ? null : String(raw).trim();
  if (!providerId) {
    await database.ensureSchema();
    await database.pool.query(
      "UPDATE user_ai_providers SET active = false WHERE user_id = $1 AND active",
      [userId],
    );
    return getSettings(userId);
  }
  if (!uuidPattern.test(providerId)) throw fail("Provider not found.", 404);
  await database.ensureSchema();
  const found = await database.pool.query(
    "SELECT provider_id FROM user_ai_providers WHERE user_id = $1 AND provider_id = $2",
    [userId, providerId],
  );
  if (!found.rows[0]) throw fail("Provider not found.", 404);
  await database.pool.query(
    "UPDATE user_ai_providers SET active = (provider_id = $2::uuid) WHERE user_id = $1",
    [userId, providerId],
  );
  return getSettings(userId);
}

async function removeProvider(userId, providerId) {
  const id = String(providerId || "").trim();
  if (!uuidPattern.test(id)) throw fail("Provider not found.", 404);
  await database.ensureSchema();
  const result = await database.pool.query(
    "DELETE FROM user_ai_providers WHERE user_id = $1 AND provider_id = $2 RETURNING provider_id",
    [userId, id],
  );
  if (!result.rows[0]) throw fail("Provider not found.", 404);
  return getSettings(userId);
}

async function saveSettings(userId, input) {
  const { provider, model, visionModel, apiKey } = validateSetting(input);
  const name = defaultNames[provider];
  const rows = await existingRows(userId);
  const match =
    rows.find((row) => row.name === name) ||
    rows.find((row) => row.provider === provider);
  return saveProvider(userId, {
    provider,
    model,
    visionModel,
    apiKey,
    name,
    providerId: match ? match.provider_id : "",
  });
}

async function deleteSettings(userId) {
  await database.ensureSchema();
  await database.pool.query(
    "UPDATE user_ai_providers SET active = false WHERE user_id = $1 AND active",
    [userId],
  );
  return getSettings(userId);
}

async function effectiveEnv(userId, env = process.env) {
  if (!userId) return env;
  await database.ensureSchema();
  const result = await database.pool.query(
    "SELECT provider, model, vision_model, base_url, encrypted_key FROM user_ai_providers WHERE user_id = $1 AND active",
    [userId],
  );
  const setting = result.rows[0];
  if (!setting) return env;
  const apiKey = decryptKey(userId, setting.encrypted_key, env);
  const next = {
    ...env,
    AI_PROVIDER_ORDER: setting.provider,
    AI_MAX_FALLBACKS: "0",
  };
  if (setting.provider === "groq") {
    next.GROQ_API_KEY = apiKey;
    next.GROQ_MODEL = setting.model;
    next.GROQ_VISION_MODEL =
      setting.vision_model || env.GROQ_VISION_MODEL || "";
  }
  if (setting.provider === "gemini") {
    next.GEMINI_API_KEY = apiKey;
    next.GEMINI_MODEL = setting.model;
    next.GEMINI_VISION_MODEL = setting.vision_model || "";
  }
  if (setting.provider === "apmix") {
    next.APMIX_API_KEY = apiKey;
    next.APMIX_MODEL = setting.model;
    next.APMIX_VISION_MODEL = setting.vision_model || "";
    next.APMIX_BASE_URL =
      setting.base_url || env.APMIX_BASE_URL || "https://api.apmix.ai/v1";
  }
  if (setting.provider === "openai") {
    next.OPENAI_API_KEY = apiKey;
    next.OPENAI_MODEL = setting.model;
    next.OPENAI_VISION_MODEL = setting.vision_model || "";
    next.OPENAI_BASE_URL = setting.base_url;
  }
  if (setting.provider === "anthropic") {
    next.ANTHROPIC_API_KEY = apiKey;
    next.ANTHROPIC_MODEL = setting.model;
    next.ANTHROPIC_VISION_MODEL = setting.vision_model || "";
    next.ANTHROPIC_BASE_URL = setting.base_url;
  }
  return next;
}

module.exports = {
  providerTypes,
  customTypes,
  defaultNames,
  maxProviders,
  encryptionKey,
  encryptKey,
  decryptKey,
  validateSetting,
  validateProvider,
  normalizeBaseUrl,
  getSettings,
  saveProvider,
  setActiveProvider,
  removeProvider,
  saveSettings,
  deleteSettings,
  effectiveEnv,
};
