const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { ideaSystemPrompt, enhanceSystemPrompt } = require("./prompt-policy");
const { supportsImages } = require("./image-models.cjs");
const { siteFreeModel } = require("./apmix-models.cjs");
const { researchDecision } = require("./research/intent");
const { researchContext, performResearch } = require("./research/firecrawl");
const { isLangfuseEnabled, recordLangfuseTrace } = require("./langfuse");
const fidelity = require("./refinement-fidelity");

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
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 3000000;

function configuredProviders(env = process.env) {
  const available = {
    nvidia: Boolean(env.NVIDIA_API_KEY),
    apmix: Boolean(env.APMIX_API_KEY && env.APMIX_BASE_URL && env.APMIX_MODEL),
    groq: Boolean(env.GROQ_API_KEY && env.GROQ_MODEL),
    gemini: Boolean(env.GEMINI_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL),
    anthropic: Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL),
  };
  const order = (
    env.AI_PROVIDER_ORDER ||
    (env.NVIDIA_API_KEY
      ? "nvidia,groq,apmix,gemini,openai,anthropic"
      : "apmix,groq,gemini,openai,anthropic")
  )
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
  if (!idea && Array.isArray(input?.images) && input.images.length)
    return "Turn the attached image into a detailed, reusable prompt.";
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

function normalizeClarifications(input) {
  if (input?.clarifications == null) return [];
  if (
    !Array.isArray(input.clarifications) ||
    input.clarifications.length < 1 ||
    input.clarifications.length > 4
  )
    throw new Error("Invalid clarification answers.");
  const seen = new Set();
  return input.clarifications.map((item) => {
    const question =
      typeof item?.question === "string" ? item.question.trim() : "";
    const answer = typeof item?.answer === "string" ? item.answer.trim() : "";
    if (
      !question ||
      question.length > 240 ||
      answer.length > 5000 ||
      seen.has(question.toLowerCase())
    )
      throw new Error("Invalid clarification answers.");
    seen.add(question.toLowerCase());
    return { question, answer };
  });
}

function normalizeImages(input) {
  if (input?.images == null) return [];
  if (!Array.isArray(input.images) || input.images.length > 3)
    throw new Error("Attach up to three images.");
  let total = 0;
  return input.images.map((image) => {
    const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      image,
    );
    if (!match || !imageMimeTypes.has(match[1]))
      throw new Error("Use JPEG, PNG, or WebP images.");
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.toString("base64") !== match[2])
      throw new Error("Invalid image data.");
    total += bytes.length;
    if (total > maxImageBytes)
      throw new Error("Prepared images are too large for this request.");
    const signature =
      (match[1] === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) ||
      (match[1] === "image/png" &&
        bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) ||
      (match[1] === "image/webp" &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP");
    if (!signature) throw new Error("Invalid image data.");
    return { mimeType: match[1], data: match[2], url: image };
  });
}

function visionModel(provider, env) {
  if (provider === "nvidia")
    return (
      env.NVIDIA_VISION_MODEL ||
      env.NVIDIA_MODEL ||
      "nvidia/nemotron-3.5-super-vl-120b-a12b"
    );
  if (provider === "groq") return env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
  if (provider === "gemini")
    return env.GEMINI_VISION_MODEL || env.GEMINI_MODEL || "gemini-2.5-flash";
  if (provider === "anthropic")
    return env.ANTHROPIC_VISION_MODEL || env.ANTHROPIC_MODEL;
  if (provider === "apmix") return env.APMIX_VISION_MODEL;
  return env.OPENAI_VISION_MODEL;
}

function parseIdeaResponse(content, idea, guidance, clarified, imageCount = 0) {
  if (!clarified && typeof content === "string") {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(content.slice(start, end + 1));
      if (Array.isArray(parsed.questions)) {
        const seen = new Set();
        const questions = parsed.questions
          .filter((item) => typeof item === "string")
          .map((item) => item.trim().slice(0, 240))
          .filter((item) => {
            const key = item.toLowerCase();
            if (!item || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 4);
        if (questions.length) return { idea, questions };
      }
    }
  }
  return parseIdeaSuggestion(content, idea, guidance, imageCount);
}

function selfContainedVisualText(value) {
  return value.replace(
    /\b(?:the|this)\s+(?:(?:attached|provided|uploaded|source|reference)\s+)?(image|images|screenshot|screenshots|photo|photos|picture|pictures|illustration|illustrations)\b(?:['’]s\s+(design|style|layout))?/gi,
    (match, kind, feature) =>
      `${match[0] === "T" ? "The" : "the"} ${feature || kind.toLowerCase()} described here`,
  );
}

function parseIdeaSuggestion(content, idea, guidance = {}, imageCount = 0) {
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
  if (imageCount && !data.context)
    throw new Error("The image was not described in the AI response.");
  const buildArtifact =
    /\b(build|implement|develop|code)\b/i.test(idea) &&
    /\b(app|game|website|tool|platform|system|api|feature)\b/i.test(idea);
  if (buildArtifact && !/\b(quick|brief)\b/i.test(idea)) data.depth = "Deep";

  const isExecutionTask =
    /\b(build|implement|develop|code|evolve|redesign|refactor|fix|debug|test|qa)\b/i.test(
      idea,
    ) &&
    !/\b(only\s+a\s+plan|just\s+a\s+plan|plan\s+only|strategic\s+plan|business\s+plan|roadmap\s+only|migration\s+plan)\b/i.test(
      idea,
    );

  if (isExecutionTask) {
    const planWrapMatch = data.task.match(
      /^(?:create|write|produce|draft|provide)\s+(?:a\s+)?(?:comprehensive\s+|detailed\s+)?(?:design\s+and\s+implementation\s+|implementation\s+|action\s+)?(?:plan|specification|spec|roadmap|guide|checklist|proposal)\s+to\s+(.+)$/is,
    );
    if (planWrapMatch) {
      let target = planWrapMatch[1].trim();
      target = target.replace(/^(?:how\s+to\s+|to\s+)?/i, "");
      if (/^evolve\b/i.test(target)) {
        data.task = `Audit, design, implement, and visually validate the evolution of ${target
          .slice(6)
          .replace(/^(?:the\s+)?/, "")
          .trim()}`;
      } else if (/^redesign\b/i.test(target)) {
        data.task = `Audit, design, implement, and visually validate the redesign of ${target
          .slice(8)
          .replace(/^(?:the\s+)?/, "")
          .trim()}`;
      } else if (/^build\b/i.test(target)) {
        data.task = `Build, verify, and deliver ${target
          .slice(5)
          .replace(/^(?:the\s+)?/, "")
          .trim()}`;
      } else if (/^implement\b/i.test(target)) {
        data.task = `Implement, run, and visually validate ${target
          .slice(9)
          .replace(/^(?:the\s+)?/, "")
          .trim()}`;
      } else {
        data.task = `Audit, implement, and visually validate: ${target}`;
      }
    }
    data.task = data.task.replace(
      /\b(?:the|this)\s+plan\s+must\s+include\b/gi,
      "Execution must include",
    );
    if (
      !/do not stop (?:at|after) (?:producing a )?(?:design )?plan/i.test(
        data.task,
      )
    ) {
      data.task +=
        " Do not stop after producing a design plan; inspect, implement, run, verify, and refine directly.";
    }

    if (
      !guidance.audience &&
      /\b(?:developers?|dev\s+team|engineers?|team\s+who\s+will\s+implement|implementation\s+team)\b/i.test(
        data.audience,
      )
    ) {
      data.audience = "";
    }

    const nonStoppingDirective =
      "Do not stop at planning. Inspect, plan, implement, run, visually evaluate, refine, and verify.";
    if (
      !guidance.constraints &&
      !/do not stop (?:at|after) planning/i.test(data.constraints) &&
      !/do not stop (?:at|after) planning/i.test(data.task)
    ) {
      data.constraints = data.constraints
        ? `${data.constraints} ${nonStoppingDirective}`
        : nonStoppingDirective;
    }
  }

  Object.assign(data, guidance);
  if (imageCount)
    for (const field of fieldNames)
      data[field] = selfContainedVisualText(data[field]);
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
  if (imageCount) {
    interpretation.goal = selfContainedVisualText(interpretation.goal);
    interpretation.focusAreas = interpretation.focusAreas.map(
      selfContainedVisualText,
    );
  }
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
      model: options.images?.length
        ? visionModel("anthropic", env)
        : env.ANTHROPIC_MODEL,
      max_tokens:
        options.maxTokens || providerOutputBudget("anthropic", env, options),
      ...(system ? { system } : {}),
      messages: rest,
    },
    extract: (json) => {
      if (json.stop_reason === "max_tokens") {
        const error = new Error("AI response reached its output token limit.");
        error.code = "OUTPUT_TRUNCATED";
        error.finishReason = json.stop_reason;
        throw error;
      }
      return Array.isArray(json.content)
        ? json.content.map((block) => block.text || "").join("")
        : "";
    },
  };
}

function providerRequest(provider, messages, env, options = {}) {
  if (provider === "anthropic") {
    const prepared = options.images?.length
      ? [
          messages[0],
          {
            role: "user",
            content: [
              { type: "text", text: messages[1].content },
              ...options.images.map((image) => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mimeType,
                  data: image.data,
                },
              })),
            ],
          },
        ]
      : messages;
    return anthropicRequest(prepared, env, options);
  }
  if (provider === "gemini") {
    const model = options.images?.length
      ? visionModel("gemini", env)
      : env.GEMINI_MODEL || "gemini-2.5-flash";
    const body = {
      systemInstruction: { parts: [{ text: messages[0].content }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: messages[1].content },
            ...(options.images || []).map((image) => ({
              inlineData: { mimeType: image.mimeType, data: image.data },
            })),
          ],
        },
      ],
    };
    body.generationConfig = {
      ...(options.json !== false
        ? { responseMimeType: "application/json" }
        : {}),
      maxOutputTokens:
        options.maxTokens || providerOutputBudget("gemini", env, options),
    };
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body,
      extract: (json) => {
        if (json.candidates?.[0]?.finishReason === "MAX_TOKENS") {
          const error = new Error(
            "AI response reached its output token limit.",
          );
          error.code = "OUTPUT_TRUNCATED";
          error.finishReason = "MAX_TOKENS";
          throw error;
        }
        return json.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("");
      },
    };
  }
  const openai = provider === "openai";
  const nvidia = provider === "nvidia";
  const base = nvidia
    ? env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"
    : openai
      ? env.OPENAI_BASE_URL || "https://api.openai.com/v1"
      : provider === "apmix"
        ? env.APMIX_BASE_URL
        : "https://api.groq.com/openai/v1";
  const endpoint =
    base.replace(/\/+$/, "").replace(/\/chat\/completions$/, "") +
    "/chat/completions";
  assertProviderUrl(endpoint);
  const apiKey = nvidia
    ? env.NVIDIA_API_KEY
    : openai
      ? env.OPENAI_API_KEY
      : provider === "apmix"
        ? env.APMIX_API_KEY
        : env.GROQ_API_KEY;
  const model = options.images?.length
    ? visionModel(provider, env)
    : nvidia
      ? env.NVIDIA_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b"
      : openai
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
      messages: options.images?.length
        ? [
            messages[0],
            {
              role: "user",
              content: [
                { type: "text", text: messages[1].content },
                ...options.images.map((image) => ({
                  type: "image_url",
                  image_url: { url: image.url },
                })),
              ],
            },
          ]
        : messages,
      max_tokens:
        options.maxTokens || providerOutputBudget(provider, env, options),
      ...(nvidia
        ? {
            chat_template_kwargs: {
              enable_thinking:
                options.reasoningEnabled ??
                options.reasoning ??
                Boolean(options.fidelity || options.reasoningEffort),
            },
            ...(options.reasoningEffort
              ? { reasoning_effort: options.reasoningEffort }
              : {}),
          }
        : {}),
      ...(options.jsonSchema && (nvidia || provider === "groq" || openai)
        ? {
            response_format: {
              type: "json_schema",
              json_schema: options.jsonSchema,
            },
          }
        : options.json !== false
          ? { response_format: { type: "json_object" } }
          : {}),
    },
    extract: (json) => {
      const choice = json.choices?.[0];
      if (choice?.finish_reason === "length") {
        const error = new Error("AI response reached its output token limit.");
        error.code = "OUTPUT_TRUNCATED";
        error.finishReason = choice.finish_reason;
        throw error;
      }
      return choice?.message?.content;
    },
  };
}

function providerOutputBudget(provider, env = process.env, options = {}) {
  if (Number.isFinite(options.maxTokens) && options.maxTokens > 0)
    return options.maxTokens;
  const minimum = provider === "nvidia" ? 16384 : 4096;
  const estimated = Math.max(
    minimum,
    Math.ceil((options.inputTokens || 0) * 1.5 + 2048),
  );
  if (provider === "nvidia")
    return Math.min(estimated, Number(env.NVIDIA_MAX_OUTPUT_TOKENS) || 131072);
  if (provider === "groq")
    return Math.min(estimated, Number(env.GROQ_MAX_OUTPUT_TOKENS) || 2600);
  if (provider === "apmix")
    return Math.min(estimated, Number(env.APMIX_MAX_OUTPUT_TOKENS) || 4096);
  if (provider === "gemini")
    return Math.min(estimated, Number(env.GEMINI_MAX_OUTPUT_TOKENS) || 8192);
  if (provider === "anthropic")
    return Math.min(estimated, Number(env.ANTHROPIC_MAX_OUTPUT_TOKENS) || 8192);
  return Math.min(estimated, Number(env.OPENAI_MAX_OUTPUT_TOKENS) || 8192);
}

async function generateWithProviders(
  messages,
  parse,
  env,
  request,
  options = {},
) {
  const selected = configuredProviders(env)[0];
  const personalModel = selected && env[`${selected.toUpperCase()}_MODEL`];
  const useDefaultVision = Boolean(
    options.images?.length &&
    env.AI_PERSONAL_PROVIDER &&
    !supportsImages(selected, personalModel),
  );
  const runEnv = useDefaultVision ? env.PROMPTDOCK_VISION_ENV || env : env;
  const providers = configuredProviders(runEnv).filter(
    (provider) =>
      !options.images?.length || Boolean(visionModel(provider, runEnv)),
  );
  if (options.images?.length && !providers.length)
    throw new Error(
      "PromptDock's image provider is unavailable. Please try again later.",
    );
  if (!providers.length) throw new Error("No AI provider is configured.");
  const timeout = Math.min(
    Math.max(
      Number(runEnv.AI_REQUEST_TIMEOUT_MS) || 12000,
      options.timeoutMs || 0,
      1000,
    ),
    60000,
  );
  const configuredFallbacks = runEnv.AI_MAX_FALLBACKS;
  const fallbackLimit =
    configuredFallbacks === undefined || configuredFallbacks === ""
      ? providers.length - 1
      : Math.max(0, Number(configuredFallbacks) || 0);
  const maxAttempts = Math.min(providers.length, fallbackLimit + 1);
  const traceId = randomUUID();
  const startTime = new Date().toISOString();
  const generations = [];
  const captureTraceContent = runEnv.LANGFUSE_CAPTURE_CONTENT === "true";
  const traceInput = captureTraceContent
    ? messages
    : {
        messageCount: messages.length,
        inputCharacters: messages.reduce(
          (total, message) =>
            total +
            (typeof message.content === "string"
              ? message.content.length
              : JSON.stringify(message.content || "").length),
          0,
        ),
      };

  for (const provider of providers.slice(0, maxAttempts)) {
    const providerEnv =
      provider === "apmix" && runEnv === process.env
        ? { ...runEnv, APMIX_MODEL: await siteFreeModel(runEnv) }
        : runEnv;
    for (let attempt = 0; attempt < 2; attempt++) {
      const attemptStart = new Date().toISOString();
      let config;
      try {
        config = providerRequest(provider, messages, providerEnv, options);
        const response = await request(config.url, {
          method: "POST",
          headers: config.headers,
          body: JSON.stringify(config.body),
          signal: AbortSignal.timeout(timeout),
        });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          error.category =
            response.status === 401 || response.status === 403
              ? "authentication"
              : response.status === 429
                ? "rate_limit_or_quota"
                : response.status >= 500
                  ? "temporary_provider_failure"
                  : "invalid_request_or_unsupported_parameter";
          const retryAfter = response.headers?.get?.("retry-after");
          if (retryAfter) {
            const seconds = Number(retryAfter);
            const date = Date.parse(retryAfter);
            error.retryAfterMs = Number.isFinite(seconds)
              ? Math.max(0, seconds * 1000)
              : Number.isFinite(date)
                ? Math.max(0, date - Date.now())
                : undefined;
          }
          throw error;
        }
        const json = await response.json();
        const content = config.extract(json);
        const parsed = parse(content);
        generations.push({
          provider,
          model: config.body?.model || provider,
          startTime: attemptStart,
          endTime: new Date().toISOString(),
          status: "success",
          input: captureTraceContent ? messages : undefined,
          output: captureTraceContent ? content : undefined,
          usage: json?.usage || json?.usageMetadata,
        });
        if (isLangfuseEnabled(runEnv)) {
          recordLangfuseTrace(
            {
              traceId,
              name: options.traceName || "ai-generation",
              userId: options.userId,
              input: traceInput,
              output: captureTraceContent ? parsed : undefined,
              metadata: { contentCaptureEnabled: captureTraceContent },
              startTime,
              endTime: new Date().toISOString(),
              generations,
            },
            runEnv,
            request,
          ).catch(() => {});
        }
        return { ...parsed, provider };
      } catch (error) {
        generations.push({
          provider,
          model: config?.body?.model || provider,
          startTime: attemptStart,
          endTime: new Date().toISOString(),
          status: "error",
          error: error.message,
          category: error.category || "request_or_response_failure",
          statusCode: error.status,
          retryAfterMs: error.retryAfterMs,
          input: captureTraceContent ? messages : undefined,
        });
        if (attempt === 0 && error.message === "fetch failed") {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        console.warn(
          `AI provider ${provider} failed (${error.category || "request_or_response_failure"}${error.status ? `, HTTP ${error.status}` : ""})${error.retryAfterMs ? `; retry after ${Math.ceil(error.retryAfterMs / 1000)}s` : ""}.`,
        );
        break;
      }
    }
  }
  if (
    options.images?.length &&
    env.AI_PERSONAL_PROVIDER &&
    !useDefaultVision &&
    env.PROMPTDOCK_VISION_ENV
  )
    return generateWithProviders(
      messages,
      parse,
      env.PROMPTDOCK_VISION_ENV,
      request,
      options,
    );
  if (isLangfuseEnabled(runEnv)) {
    recordLangfuseTrace(
      {
        traceId,
        name: options.traceName || "ai-generation",
        userId: options.userId,
        input: traceInput,
        error:
          options.errorMessage ||
          "AI suggestions are temporarily unavailable. Please try again.",
        startTime,
        endTime: new Date().toISOString(),
        metadata: { contentCaptureEnabled: captureTraceContent },
        generations,
      },
      runEnv,
      request,
    ).catch(() => {});
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
    { traceName: "enhance-prompt", userId: input?.userId },
  );
}

async function ideaToPrompt(input, env = process.env, request = fetch) {
  const images = normalizeImages(input);
  const idea = normalizeIdea(input);
  const guidance = normalizeIdeaGuidance(input);
  const clarifications = normalizeClarifications(input);
  const existingResearch =
    typeof input?.researchContext === "string"
      ? input.researchContext.trim().slice(0, 14000)
      : "";
  const decision = researchDecision({
    idea,
    guidance,
    researchMode: input?.researchMode,
    referenceUrls: input?.referenceUrls,
  });
  const research = existingResearch
    ? {
        used: true,
        attempted: false,
        queries: [],
        sources: Array.isArray(input?.researchSources)
          ? input.researchSources.slice(0, 4)
          : [],
        context: existingResearch,
        reused: true,
      }
    : await performResearch(decision, env, request);
  const context = existingResearch || researchContext(research.sources);
  const refinement = fidelity.classifyRefinement({
    idea,
    guidance,
    clarifications,
  });
  if (refinement.fidelity && !images.length) {
    let detailed;
    try {
      detailed = await fidelityIdeaToPrompt(
        { idea, guidance, clarifications, context, refinement },
        env,
        request,
      );
    } catch {
      detailed = {
        idea,
        provider: "source-preserved",
        data: {
          task: fidelity.preservedSourcePrompt({
            idea,
            guidance,
            clarifications,
            context,
          }),
          ...Object.fromEntries(
            fieldNames.slice(1).map((field) => [field, ""]),
          ),
          raw: true,
        },
        interpretation: {
          goal: "Preserve your supplied instructions in full",
          whyThisDepth:
            "PromptDock kept your original content intact because a complete refinement could not be verified.",
          focusAreas: [],
          missingDetails: [],
        },
      };
    }
    return {
      ...detailed,
      research: {
        used: Boolean(context),
        attempted: Boolean(research.attempted),
        queries: research.queries || decision.queries || [],
        sources: (research.sources || []).map(
          ({ title, url, description, publishedAt, sourceType }) => ({
            title,
            url,
            description,
            publishedAt,
            sourceType,
          }),
        ),
        reused: Boolean(research.reused),
        ...(research.fallbackReason
          ? { fallbackReason: research.fallbackReason }
          : {}),
        ...(context && detailed.questions?.length ? { context } : {}),
      },
    };
  }
  const system = ideaSystemPrompt({
    fields: fieldNames,
    formats,
    tones,
    clarified: clarifications.length > 0,
    imageCount: images.length,
    researchAvailable: Boolean(context),
  });
  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: JSON.stringify({
        idea,
        guidance,
        ...(images.length ? { attachmentCount: images.length } : {}),
        ...(clarifications.length ? { clarifications } : {}),
        ...(context ? { researchContext: context } : {}),
      }),
    },
  ];
  const result = await generateWithProviders(
    messages,
    (content) =>
      parseIdeaResponse(
        content,
        idea,
        guidance,
        clarifications.length > 0,
        images.length,
      ),
    env,
    request,
    {
      images,
      reasoning: input?.reasoning,
      traceName: "idea-to-prompt",
      userId: input?.userId,
      ...(images.length ? { maxTokens: 4000, timeoutMs: 30000 } : {}),
    },
  );
  return {
    ...result,
    research: {
      used: Boolean(context),
      attempted: Boolean(research.attempted),
      queries: research.queries || decision.queries || [],
      sources: (research.sources || []).map(
        ({ title, url, description, publishedAt, sourceType }) => ({
          title,
          url,
          description,
          publishedAt,
          sourceType,
        }),
      ),
      reused: Boolean(research.reused),
      ...(research.fallbackReason
        ? { fallbackReason: research.fallbackReason }
        : {}),
      ...(context && result.questions?.length ? { context } : {}),
    },
  };
}

function schemaFor(type) {
  if (type === "inventory") return fidelity.inventorySchema();
  if (type === "coverage") return fidelity.coverageSchema();
  return fidelity.refinedPromptSchema();
}

async function fidelityCall(messages, parse, env, request, options = {}) {
  return generateWithProviders(messages, parse, env, request, options);
}

async function fidelityIdeaToPrompt(
  { idea, guidance, clarifications, context },
  env,
  request,
) {
  const preserved = fidelity.preservedSourcePrompt({
    idea,
    guidance,
    clarifications,
  });
  const source = [preserved, context ? `## Research context\n${context}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const chunks = fidelity.splitStructuredDocument(source, {
    maxEstimatedTokens: Number(env.AI_FIDELITY_CHUNK_TOKENS) || 8000,
  });
  const inventories = [];
  for (const chunk of chunks) {
    const messages = fidelity.inventoryMessages({
      source: "",
      guidance: {},
      clarifications: [],
      chunk,
    });
    const result = await fidelityCall(
      messages,
      (content) => ({ inventory: fidelity.parseRequirementInventory(content) }),
      env,
      request,
      {
        fidelity: true,
        reasoningEnabled: true,
        reasoningEffort: "low",
        jsonSchema: schemaFor("inventory"),
        inputTokens: fidelity.estimateTokens(chunk),
        traceName: "fidelity-requirement-inventory",
      },
    );
    inventories.push(result.inventory);
  }
  const inventory = fidelity.mergeRequirementInventories(inventories);
  if (!clarifications.length && inventory.unresolvedQuestions.length) {
    return {
      idea,
      questions: inventory.unresolvedQuestions,
      provider: inventories.provider || configuredProviders(env)[0],
    };
  }
  const common = { source, guidance: {}, clarifications: [], inventory };
  const messages = fidelity.detailedRefinementMessages(common);
  const generated = await fidelityCall(
    messages,
    fidelity.parseDetailedRefinement,
    env,
    request,
    {
      fidelity: true,
      reasoningEnabled: true,
      reasoningEffort: "high",
      jsonSchema: schemaFor("refined"),
      inputTokens: fidelity.estimateTokens(JSON.stringify(common)),
      traceName: "fidelity-detailed-refinement",
    },
  );
  let candidate = generated.data.task;
  const validate = async (prompt) => {
    const auditMessages = fidelity.coverageValidationMessages({
      source,
      inventory,
      refinedPrompt: prompt,
    });
    const checked = await fidelityCall(
      auditMessages,
      (content) => ({
        validation: fidelity.parseCoverageValidation(content, inventory),
      }),
      env,
      request,
      {
        fidelity: true,
        reasoningEnabled: false,
        jsonSchema: schemaFor("coverage"),
        inputTokens: fidelity.estimateTokens(
          JSON.stringify({ source, inventory, prompt }),
        ),
        traceName: "fidelity-coverage-validation",
      },
    );
    return checked.validation;
  };
  let validation;
  try {
    validation = await validate(candidate);
    if (!validation.passed) {
      const repaired = await fidelityCall(
        fidelity.repairMessages({
          source,
          inventory,
          refinedPrompt: candidate,
          validation,
        }),
        fidelity.parseDetailedRefinement,
        env,
        request,
        {
          fidelity: true,
          reasoningEnabled: true,
          reasoningEffort: "high",
          jsonSchema: schemaFor("refined"),
          inputTokens: fidelity.estimateTokens(
            JSON.stringify({ source, inventory, candidate, validation }),
          ),
          traceName: "fidelity-repair",
        },
      );
      candidate = repaired.data.task;
      validation = await validate(candidate);
    }
  } catch {
    validation = { passed: false };
  }
  if (!validation?.passed) {
    candidate = fidelity.preservedSourcePrompt({
      idea,
      guidance,
      clarifications,
      context,
    });
    generated.data.task = candidate;
    generated.interpretation = {
      ...generated.interpretation,
      goal: "Preserve your supplied instructions in full",
      whyThisDepth:
        "PromptDock kept your original content intact because the refinement could not pass its completeness check.",
    };
  }
  generated.data.raw = true;
  return { idea, ...generated };
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
      traceName: "run-prompt",
      userId: input?.userId,
      errorMessage: "The prompt could not be run right now. Please try again.",
    },
  );
}

async function runPromptComparison(input, env = process.env, request = fetch) {
  const text = normalizeRunInput(input);
  const available = configuredProviders(env);
  const selected =
    Array.isArray(input.providers) && input.providers.length
      ? input.providers.filter((p) => available.includes(p))
      : available.slice(0, 2);
  const targets = selected.length ? selected : available.slice(0, 1);
  if (!targets.length) {
    throw new Error("No AI providers configured to run comparison.");
  }
  const runs = await Promise.allSettled(
    targets.map(async (provider) => {
      const specificEnv = {
        ...env,
        AI_PROVIDER_ORDER: provider,
        AI_MAX_FALLBACKS: "0",
      };
      const result = await runPrompt(
        { ...input, prompt: text },
        specificEnv,
        request,
      );
      return { provider, text: result.text, success: true };
    }),
  );
  const results = runs.map((res, index) => {
    const provider = targets[index];
    if (res.status === "fulfilled") {
      return res.value;
    }
    return {
      provider,
      error: res.reason?.message || "Execution failed",
      success: false,
    };
  });
  return { results };
}

module.exports = {
  configuredProviders,
  runPromptComparison,
  normalizeDraft,
  normalizeIdea,
  normalizeIdeaGuidance,
  normalizeClarifications,
  normalizeImages,
  normalizeRunInput,
  parseSuggestion,
  parseIdeaSuggestion,
  enhanceWithAI,
  ideaToPrompt,
  runPrompt,
  researchDecision,
};
