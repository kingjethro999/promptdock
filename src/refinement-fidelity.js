/* global module */

const emptyFields = {
  role: "",
  audience: "",
  context: "",
  format: "",
  tone: "",
  approach: "",
  focus: "",
  depth: "",
  constraints: "",
};

function jsonFromText(content) {
  if (typeof content !== "string" || !content.trim())
    throw new Error("Empty AI response");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid AI response");
  return JSON.parse(content.slice(start, end + 1));
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(String(value || "").length / 4));
}

function sourceText({ idea = "", guidance = {}, clarifications = [] } = {}) {
  return [
    idea,
    ...Object.entries(guidance || {}).map(([key, value]) => `${key}: ${value}`),
    ...clarifications.map(
      ({ question, answer }) => `${question}\n${answer || ""}`,
    ),
  ].join("\n");
}

function classifyRefinement(input = {}) {
  const source = sourceText(input);
  const lines = source.split(/\r?\n/);
  const headings = lines.filter((line) =>
    /^\s{0,3}#{1,6}\s+/.test(line),
  ).length;
  const listItems = lines.filter((line) =>
    /^\s*(?:[-*+] |\d+[.)]\s+)/.test(line),
  ).length;
  const fences = (source.match(/```/g) || []).length / 2;
  const constraints = (
    source.match(
      /\b(?:must|must not|do not|never|required|preserve|retain|without changing|cannot|shall)\b/gi,
    ) || []
  ).length;
  const decisions = (
    source.match(
      /\b(?:use|support|keep|existing|instead|actually|final decision|supersede)\b/gi,
    ) || []
  ).length;
  const tokens = estimateTokens(source);
  const extensive = tokens >= 12000;
  const structured =
    lines.length >= 60 ||
    listItems >= 12 ||
    headings >= 4 ||
    (headings >= 2 && listItems >= 6) ||
    fences >= 2;
  const requirementDense = constraints >= 5 || constraints + decisions >= 10;
  const existingInstructions =
    /\b(?:AGENTS\.md|existing (?:prompt|instructions|specification|architecture)|minimal changes|preserve (?:the )?existing)\b/i.test(
      source,
    );
  const fidelity =
    extensive ||
    tokens >= 1500 ||
    (structured && requirementDense) ||
    (existingInstructions && (constraints >= 2 || listItems >= 5));
  const kind = extensive
    ? "extensive"
    : fidelity && existingInstructions
      ? "existing_instructions"
      : fidelity
        ? "detailed"
        : tokens < 80 && lines.length < 5
          ? "brief"
          : "ordinary";
  return {
    kind,
    fidelity,
    estimatedTokens: tokens,
    signals: { lines: lines.length, headings, listItems, fences, constraints },
  };
}

function splitStructuredDocument(value, { maxEstimatedTokens = 8000 } = {}) {
  const text = String(value || "").trim();
  if (!text || estimateTokens(text) <= maxEstimatedTokens)
    return text ? [text] : [];
  const maxChars = maxEstimatedTokens * 4;
  const chunks = [];
  let current = [];
  let size = 0;
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    const lineSize = line.length + 1;
    if (current.length && size + lineSize > maxChars && !inFence) {
      chunks.push(current.join("\n").trim());
      current = [];
      size = 0;
    }
    current.push(line);
    size += lineSize;
    if (/^\s*```/.test(line)) inFence = !inFence;
  }
  if (current.length) chunks.push(current.join("\n").trim());
  return chunks.filter(Boolean);
}

function normalizeList(value, limit = 1000, itemLimit = 5000) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().slice(0, itemLimit))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function parseRequirementInventory(content) {
  const parsed = jsonFromText(content);
  const sourceType = [
    "brief_idea",
    "ordinary_prompt",
    "detailed_document",
    "extensive_specification",
    "existing_instructions",
    "conversation",
  ].includes(parsed.sourceType)
    ? parsed.sourceType
    : "detailed_document";
  const seen = new Set();
  const requirements = (
    Array.isArray(parsed.requirements) ? parsed.requirements : []
  )
    .filter((item) => item && typeof item.text === "string")
    .map((item) => ({
      text: item.text.trim().slice(0, 5000),
      kind: [
        "functionality",
        "constraint",
        "prohibition",
        "decision",
        "example",
        "context",
        "deliverable",
      ].includes(item.kind)
        ? item.kind
        : "constraint",
      priority: item.priority === "optional" ? "optional" : "required",
      evidence:
        typeof item.evidence === "string"
          ? item.evidence.trim().slice(0, 5000)
          : "",
      status: item.status === "superseded" ? "superseded" : "active",
    }))
    .filter((item) => {
      const key = `${item.status}:${item.text.toLowerCase()}`;
      if (!item.text || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 1000)
    .map((item, index) => ({
      id: `R${String(index + 1).padStart(3, "0")}`,
      ...item,
    }));
  if (!requirements.length) throw new Error("Incomplete requirement inventory");
  return {
    sourceType,
    intent:
      typeof parsed.intent === "string"
        ? parsed.intent.trim().slice(0, 5000)
        : "",
    requirements,
    unresolvedQuestions: normalizeList(parsed.unresolvedQuestions, 4, 240),
  };
}

function mergeRequirementInventories(inventories) {
  const combined = [];
  const seen = new Set();
  for (const inventory of inventories) {
    for (const requirement of inventory.requirements || []) {
      const key = `${requirement.status}:${requirement.text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(requirement);
    }
  }
  return {
    sourceType:
      inventories.length > 1
        ? "extensive_specification"
        : inventories[0]?.sourceType || "detailed_document",
    intent: inventories
      .map((item) => item.intent)
      .filter(Boolean)
      .join("; "),
    requirements: combined.map((item, index) => ({
      ...item,
      id: `R${String(index + 1).padStart(3, "0")}`,
    })),
    unresolvedQuestions: [
      ...new Set(inventories.flatMap((item) => item.unresolvedQuestions || [])),
    ].slice(0, 4),
  };
}

function parseDetailedRefinement(content) {
  const parsed = jsonFromText(content);
  const prompt =
    typeof parsed.refinedPrompt === "string" ? parsed.refinedPrompt.trim() : "";
  if (!prompt) throw new Error("Incomplete AI response");
  const raw = parsed.interpretation || {};
  return {
    data: { task: prompt.slice(0, 400000), ...emptyFields, raw: true },
    interpretation: {
      goal:
        typeof raw.goal === "string"
          ? raw.goal.trim().slice(0, 180)
          : "Preserve and clarify the supplied instructions",
      whyThisDepth:
        typeof raw.whyThisDepth === "string"
          ? raw.whyThisDepth.trim().slice(0, 240)
          : "A detailed source needs complete requirement coverage.",
      focusAreas: normalizeList(raw.focusAreas, 4, 160),
      missingDetails: normalizeList(raw.missingDetails, 3, 160),
    },
  };
}

function parseCoverageValidation(content, inventory) {
  const parsed = jsonFromText(content);
  if (!Array.isArray(parsed.sourceRequirementsMissingFromInventory))
    throw new Error("Incomplete source coverage audit");
  const expected = new Set(
    (inventory.requirements || [])
      .filter((item) => item.status !== "superseded")
      .map((item) => item.id),
  );
  const covered = normalizeList(parsed.coveredRequirementIds).filter((id) =>
    expected.has(id),
  );
  const coveredSet = new Set(covered);
  const missing = new Set(
    normalizeList(parsed.missingRequirementIds).filter((id) =>
      expected.has(id),
    ),
  );
  for (const id of expected) if (!coveredSet.has(id)) missing.add(id);
  const result = {
    coveredRequirementIds: covered,
    missingRequirementIds: [...missing],
    weakenedRequirementIds: normalizeList(parsed.weakenedRequirementIds).filter(
      (id) => expected.has(id),
    ),
    sourceRequirementsMissingFromInventory: normalizeList(
      parsed.sourceRequirementsMissingFromInventory,
      100,
      1000,
    ),
    contradictions: normalizeList(parsed.contradictions, 100, 1000),
    unsupportedAssumptions: normalizeList(
      parsed.unsupportedAssumptions,
      100,
      1000,
    ),
    placeholdersForKnownInfo: normalizeList(
      parsed.placeholdersForKnownInfo,
      100,
      1000,
    ),
    changedDeliverable: parsed.changedDeliverable === true,
  };
  result.passed = Boolean(
    expected.size &&
    result.missingRequirementIds.length === 0 &&
    result.weakenedRequirementIds.length === 0 &&
    result.sourceRequirementsMissingFromInventory.length === 0 &&
    result.contradictions.length === 0 &&
    result.unsupportedAssumptions.length === 0 &&
    result.placeholdersForKnownInfo.length === 0 &&
    !result.changedDeliverable,
  );
  return result;
}

function preservedSourcePrompt({
  idea,
  guidance = {},
  clarifications = [],
  context = "",
}) {
  const sections = [String(idea || "").trim()];
  const selected = Object.entries(guidance).filter(
    ([, value]) => typeof value === "string" && value.trim(),
  );
  if (selected.length)
    sections.push(
      `## User-selected guidance\n${selected
        .map(([key, value]) => `- ${key}: ${value.trim()}`)
        .join("\n")}`,
    );
  const answered = clarifications.filter(
    ({ question, answer }) => question?.trim() && answer?.trim(),
  );
  if (answered.length)
    sections.push(
      `## Confirmed clarifications\n${answered
        .map(
          ({ question, answer }) => `- ${question.trim()}\n  ${answer.trim()}`,
        )
        .join("\n")}`,
    );
  const unanswered = clarifications.filter(
    ({ question, answer }) => question?.trim() && !answer?.trim(),
  );
  if (unanswered.length)
    sections.push(
      `## Unanswered clarification questions\n${unanswered
        .map(
          ({ question }) =>
            `- ${question.trim()} (left unanswered; keep this decision open)`,
        )
        .join("\n")}`,
    );
  if (typeof context === "string" && context.trim())
    sections.push(`## Relevant research context\n${context.trim()}`);
  return sections.filter(Boolean).join("\n\n");
}

function inventoryMessages({ source, guidance, clarifications, chunk }) {
  return [
    {
      role: "system",
      content:
        "Extract every active and superseded requirement from the supplied source. Preserve negative requirements, examples, paths, technologies, existing decisions, and constraints. Never summarize multiple independent requirements into one vague item. Return JSON matching the requested schema only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        source,
        guidance,
        clarifications,
        ...(chunk ? { chunk } : {}),
      }),
    },
  ];
}

function inventorySchema() {
  return {
    name: "promptdock_requirement_inventory",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["sourceType", "intent", "requirements", "unresolvedQuestions"],
      properties: {
        sourceType: {
          type: "string",
          enum: [
            "brief_idea",
            "ordinary_prompt",
            "detailed_document",
            "extensive_specification",
            "existing_instructions",
            "conversation",
          ],
        },
        intent: { type: "string" },
        requirements: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text", "kind", "priority", "evidence", "status"],
            properties: {
              text: { type: "string" },
              kind: {
                type: "string",
                enum: [
                  "functionality",
                  "constraint",
                  "prohibition",
                  "decision",
                  "example",
                  "context",
                  "deliverable",
                ],
              },
              priority: { type: "string", enum: ["required", "optional"] },
              evidence: { type: "string" },
              status: { type: "string", enum: ["active", "superseded"] },
            },
          },
        },
        unresolvedQuestions: { type: "array", items: { type: "string" } },
      },
    },
  };
}

function refinedPromptSchema() {
  return {
    name: "promptdock_refined_prompt",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["refinedPrompt", "interpretation"],
      properties: {
        refinedPrompt: { type: "string" },
        interpretation: {
          type: "object",
          additionalProperties: false,
          required: ["goal", "whyThisDepth", "focusAreas", "missingDetails"],
          properties: {
            goal: { type: "string" },
            whyThisDepth: { type: "string" },
            focusAreas: { type: "array", items: { type: "string" } },
            missingDetails: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };
}

function coverageSchema() {
  return {
    name: "promptdock_requirement_coverage",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "passed",
        "coveredRequirementIds",
        "missingRequirementIds",
        "weakenedRequirementIds",
        "sourceRequirementsMissingFromInventory",
        "contradictions",
        "unsupportedAssumptions",
        "placeholdersForKnownInfo",
        "changedDeliverable",
      ],
      properties: {
        passed: { type: "boolean" },
        coveredRequirementIds: { type: "array", items: { type: "string" } },
        missingRequirementIds: { type: "array", items: { type: "string" } },
        weakenedRequirementIds: { type: "array", items: { type: "string" } },
        sourceRequirementsMissingFromInventory: {
          type: "array",
          items: { type: "string" },
        },
        contradictions: { type: "array", items: { type: "string" } },
        unsupportedAssumptions: { type: "array", items: { type: "string" } },
        placeholdersForKnownInfo: { type: "array", items: { type: "string" } },
        changedDeliverable: { type: "boolean" },
      },
    },
  };
}

function detailedRefinementMessages({
  source,
  guidance,
  clarifications,
  inventory,
}) {
  return [
    {
      role: "system",
      content:
        "Refine the supplied instructions without summarizing them. Every active requirement ID must remain meaningfully present. Improve organization, clarity, and executability; preserve examples and negative requirements; honor later decisions over superseded ones; never invent missing values or placeholders for supplied information. Return JSON with refinedPrompt and interpretation only.",
    },
    {
      role: "user",
      content: JSON.stringify({ source, guidance, clarifications, inventory }),
    },
  ];
}

function coverageValidationMessages({ source, inventory, refinedPrompt }) {
  return [
    {
      role: "system",
      content:
        "Audit the refined prompt against both the original source and the requirement inventory. Mark an ID covered only when its complete meaning and strength survive. Also inspect whether the inventory itself omitted any requirement from the original source; list each such omission in sourceRequirementsMissingFromInventory. Detect omissions, weakened constraints, contradictions, unsupported assumptions, placeholders for known facts, and changed deliverables. Return JSON only. Do not reveal private reasoning.",
    },
    {
      role: "user",
      content: JSON.stringify({ source, inventory, refinedPrompt }),
    },
  ];
}

function repairMessages({ source, inventory, refinedPrompt, validation }) {
  return [
    {
      role: "system",
      content:
        "Repair only the audited fidelity problems while preserving everything already correct. Return the complete refined prompt, not a patch or summary, as JSON with refinedPrompt and interpretation. Do not reveal private reasoning.",
    },
    {
      role: "user",
      content: JSON.stringify({ source, inventory, refinedPrompt, validation }),
    },
  ];
}

module.exports = {
  classifyRefinement,
  coverageValidationMessages,
  detailedRefinementMessages,
  estimateTokens,
  inventoryMessages,
  inventorySchema,
  mergeRequirementInventories,
  parseCoverageValidation,
  parseDetailedRefinement,
  parseRequirementInventory,
  preservedSourcePrompt,
  repairMessages,
  refinedPromptSchema,
  coverageSchema,
  splitStructuredDocument,
};
