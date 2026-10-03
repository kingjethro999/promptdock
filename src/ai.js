const fs = require("node:fs");
const path = require("node:path");
const { ideaSystemPrompt, enhanceSystemPrompt } = require("./prompt-policy");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function")
  process.loadEnvFile(envPath);

const fieldNames = [
  "task",
  "role",
  "audience",
  "context",
  "format",
  "tone",
  "approach",
  "focus",
  "depth",
  "constraints",
];
const formats = [
  "Bulleted list",
  "Step-by-step guide",
  "Table",
  "Email",
  "Social post",
  "Article",
  "Code with explanation",
  "JSON",
];
const tones = [
  "Clear and concise",
  "Friendly",
  "Professional",
  "Persuasive",
  "Creative",
  "Educational",
];
const depths = ["Quick", "Balanced", "Deep"];

function configuredProviders(env = process.env) {
  const available = {
    apmix: Boolean(env.APMIX_API_KEY && env.APMIX_BASE_URL && env.APMIX_MODEL),
    groq: Boolean(env.GROQ_API_KEY && env.GROQ_MODEL),
    gemini: Boolean(env.GEMINI_API_KEY),
    openai: Boolean(
      env.OPENAI_API_KEY && env.OPENAI_BASE_URL && env.OPENAI_MODEL,
    ),
    anthropic: Boolean(
      env.ANTHROPIC_API_KEY && env.ANTHROPIC_BASE_URL && env.ANTHROPIC_MODEL,
    ),
  };
  const order = (env.AI_PROVIDER_ORDER || "apmix,groq,gemini,openai,anthropic")
    .split(",")
    .map((name) => name.trim().toLowerCase());
  return [...new Set(order)].filter((name) => available[name]);
}

function normalizeDraft(input) {
  const data = {};
  for (const field of fieldNames)
    data[field] =
      typeof input?.[field] === "string"
        ? input[field].trim().slice(0, 100000)
        : "";
  if (JSON.stringify(data).length > 400000)
    throw new Error("Draft is too long.");
  if (!data.task) throw new Error("Add a task before enhancing.");
  return data;
}

function parseSuggestion(content, original) {
  if (typeof content !== "string") throw new Error("Empty AI response");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid AI response");
  const parsed = JSON.parse(content.slice(start, end + 1));
  const result = {};
  for (const field of fieldNames)
    result[field] =
      typeof parsed[field] === "string"
        ? parsed[field].trim().slice(0, 100000)
        : original[field];
  if (!result.task) result.task = original.task;
  if (!formats.includes(result.format)) result.format = original.format;
  if (!tones.includes(result.tone)) result.tone = original.tone;
  if (!depths.includes(result.depth)) result.depth = original.depth;
  return result;
}

function normalizeIdea(input) {
  const idea = typeof input?.idea === "string" ? input.idea.trim() : "";
  if (idea.length < 4) throw new Error("Describe your idea in a few words.");
  if (idea.length > 100000) throw new Error("Idea is too long.");
  return idea;
}

function normalizeIdeaGuidance(input) {
  const source = input?.guidance;
  if (source == null) return {};
  if (typeof source !== "object" || Array.isArray(source))
    throw new Error("Invalid fine-tune details.");
  const guidance = {};
  for (const field of fieldNames.filter((name) => name !== "task")) {
    const value = source[field];
    if (value == null || value === "") continue;
    if (typeof value !== "string" || value.length > 100000)
      throw new Error("Invalid fine-tune details.");
    if (value.trim()) guidance[field] = value.trim();
  }
  if (
    (guidance.format && !formats.includes(guidance.format)) ||
    (guidance.tone && !tones.includes(guidance.tone)) ||
    (guidance.depth && !depths.includes(guidance.depth)) ||
    JSON.stringify(guidance).length > 400000
  )
    throw new Error("Invalid fine-tune details.");
  return guidance;
}

function parseIdeaSuggestion(content, idea, guidance = {}) {
  if (typeof content !== "string") throw new Error("Empty AI response");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid AI response");
  const parsed = JSON.parse(content.slice(start, end + 1));
  const source =
    parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const data = {};
  for (const field of fieldNames)
    data[field] =
      typeof source[field] === "string"
        ? source[field].trim().slice(0, 100000)
        : "";
  if (!formats.includes(data.format)) data.format = "";
  if (!tones.includes(data.tone)) data.tone = "";
  if (!depths.includes(data.depth)) data.depth = "Balanced";
  const buildArtifact =
    /\b(build|implement|develop|code)\b/i.test(idea) &&
    /\b(app|game|website|tool|platform|system|api|feature)\b/i.test(idea);
  if (buildArtifact && !/\b(quick|brief)\b/i.test(idea)) data.depth = "Deep";
  Object.assign(data, guidance);
  if (!data.task || !data.focus) throw new Error("Incomplete AI response");
  const raw = parsed.interpretation || {};
  const list = (value, limit) =>
    Array.isArray(value)
      ? value
          .filter((item) => typeof item === "string")
          .map((item) => item.trim().slice(0, 160))
          .filter(Boolean)
          .slice(0, limit)
      : [];
  const interpretation = {
    goal:
      typeof raw.goal === "string"
        ? raw.goal.trim().slice(0, 180)
        : data.task.slice(0, 180),
    whyThisDepth:
      buildArtifact && data.depth === "Deep"
        ? "A working build needs implementation and a check that it runs."
        : typeof raw.whyThisDepth === "string"
          ? raw.whyThisDepth.trim().slice(0, 240)
          : "",
    focusAreas: list(raw.focusAreas, 4),
    missingDetails: list(raw.missingDetails, 3),
  };
  if (!interpretation.focusAreas.length)
    interpretation.focusAreas = data.focus
      .split(/\n|;/)
      .map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 4);
  if (guidance.focus)
    interpretation.focusAreas = guidance.focus
      .split(/\n|;/)
      .map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 4);
  if (guidance.depth)
    interpretation.whyThisDepth = `You chose ${guidance.depth.toLowerCase()} depth in fine-tune.`;
  return { idea, data, interpretation };
}

function assertProviderUrl(endpoint) {
  const url = new URL(endpoint);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const loopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw new Error("Provider URL must use HTTPS");
}

function anthropicRequest(messages, env, options = {}) {
  const root = (env.ANTHROPIC_BASE_URL || "https://api.anthropic.com")
    .replace(/\/+$/, "")
    .replace(/\/v1\/messages$/, "")
    .replace(/\/v1$/, "");
  const endpoint = `${root}/v1/messages`;
  assertProviderUrl(endpoint);
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const rest = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));
  return {
    url: endpoint,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: {
      model: env.ANTHROPIC_MODEL,
      max_tokens: options.maxTokens || 2600,
      ...(system ? { system } : {}),
      messages: rest,
    },
    extract: (json) =>
      Array.isArray(json.content)
        ? json.content.map((block) => block.text || "").join("")
        : "",
  };
}

function providerRequest(provider, messages, env, options = {}) {
  if (provider === "anthropic") return anthropicRequest(messages, env, options);
  if (provider === "gemini") {
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const body = {
      systemInstruction: { parts: [{ text: messages[0].content }] },
      contents: [{ role: "user", parts: [{ text: messages[1].content }] }],
    };
    if (options.json !== false)
      body.generationConfig = { responseMimeType: "application/json" };
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body,
      extract: (json) =>
        json.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join(""),
    };
  }
  const openai = provider === "openai";
  const base = openai
    ? env.OPENAI_BASE_URL
    : provider === "apmix"
      ? env.APMIX_BASE_URL
      : "https://api.groq.com/openai/v1";
  const endpoint =
    base.replace(/\/+$/, "").replace(/\/chat\/completions$/, "") +
    "/chat/completions";
  assertProviderUrl(endpoint);
  const apiKey = openai
    ? env.OPENAI_API_KEY
    : provider === "apmix"
      ? env.APMIX_API_KEY
      : env.GROQ_API_KEY;
  const model = openai
    ? env.OPENAI_MODEL
    : provider === "apmix"
      ? env.APMIX_MODEL
      : env.GROQ_MODEL;
  return {
    url: endpoint,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model,
      messages,
      max_tokens: options.maxTokens || 2600,
    },
    extract: (json) => json.choices?.[0]?.message?.content,
  };
}

async function generateWithProviders(
  messages,
  parse,
  env,
  request,
  options = {},
) {
  const providers = configuredProviders(env);
  if (!providers.length) throw new Error("No AI provider is configured.");
  const timeout = Math.min(
    Math.max(
      Number(env.AI_REQUEST_TIMEOUT_MS) || options.timeoutMs || 12000,
      1000,
    ),
    60000,
  );
  const maxAttempts = Math.min(
    providers.length,
    Math.max(1, (Number(env.AI_MAX_FALLBACKS) || 0) + 1),
  );
  for (const provider of providers.slice(0, maxAttempts)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config = providerRequest(provider, messages, env, options);
        const response = await request(config.url, {
          method: "POST",
          headers: config.headers,
          body: JSON.stringify(config.body),
          signal: AbortSignal.timeout(timeout),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = config.extract(await response.json());
        return { ...parse(content), provider };
      } catch (error) {
        if (attempt === 0 && error.message === "fetch failed") {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        console.warn(
          `AI provider ${provider} failed: ${error.message?.slice(0, 100) || "Unknown error"}`,
        );
        break;
      }
    }
  }
  throw new Error(
    options.errorMessage ||
      "AI suggestions are temporarily unavailable. Please try again.",
  );
}

async function enhanceWithAI(input, env = process.env, request = fetch) {
  const original = normalizeDraft(input);
  const system = enhanceSystemPrompt({ fields: fieldNames, formats, tones });
  const messages = [
    { role: "system", content: system },
    { role: "user", content: JSON.stringify(original) },
  ];
  return generateWithProviders(
    messages,
    (content) => ({ data: parseSuggestion(content, original) }),
    env,
    request,
  );
}

async function ideaToPrompt(input, env = process.env, request = fetch) {
  const idea = normalizeIdea(input);
  const guidance = normalizeIdeaGuidance(input);
  const system = ideaSystemPrompt({ fields: fieldNames, formats, tones });
  const messages = [
    { role: "system", content: system },
    { role: "user", content: JSON.stringify({ idea, guidance }) },
  ];
  return generateWithProviders(
    messages,
    (content) => parseIdeaSuggestion(content, idea, guidance),
    env,
    request,
  );
}

function normalizeRunInput(input) {
  const text = typeof input?.prompt === "string" ? input.prompt.trim() : "";
  if (text.length < 4) throw new Error("Add a task before running the prompt.");
  if (text.length > 400000) throw new Error("Prompt is too long to run.");
  return text;
}

async function runPrompt(input, env = process.env, request = fetch) {
  const text = normalizeRunInput(input);
  const messages = [
    {
      role: "system",
      content:
        "Follow the user's instructions exactly and produce the deliverable they asked for. Do not comment on the prompt itself.",
    },
    { role: "user", content: text },
  ];
  return generateWithProviders(
    messages,
    (content) => {
      if (typeof content !== "string" || !content.trim())
        throw new Error("Empty AI response");
      return { text: content.trim() };
    },
    env,
    request,
    {
      json: false,
      maxTokens: 4000,
      timeoutMs: 30000,
      errorMessage: "The prompt could not be run right now. Please try again.",
    },
  );
}

module.exports = {
  configuredProviders,
  normalizeDraft,
  normalizeIdea,
  normalizeIdeaGuidance,
  normalizeRunInput,
  parseSuggestion,
  parseIdeaSuggestion,
  enhanceWithAI,
  ideaToPrompt,
  runPrompt,
};
