const URL_PATTERN = /https?:\/\/[^\s<>'"`]+/gi;
const SECRET_PATTERNS = [
  /(?:api[_ -]?key|access[_ -]?token|secret|password|private[_ -]?key)\s*[:=]\s*[^\s,;]+/gi,
  /(?:sk|pk|AIza|gh[pousr]_[A-Za-z0-9_]+)[A-Za-z0-9_-]{12,}/g,
];

function normalizeResearchMode(value) {
  return value === "on" || value === "off" || value === "auto" ? value : "auto";
}

function extractUrls(value) {
  if (typeof value !== "string") return [];
  return [
    ...new Set(
      (value.match(URL_PATTERN) || []).map((url) =>
        url.replace(/[),.;!?]+$/, ""),
      ),
    ),
  ].slice(0, 3);
}

function redactSecrets(value) {
  let safe = String(value || "");
  for (const pattern of SECRET_PATTERNS) safe = safe.replace(pattern, "");
  return safe.replace(/\s+/g, " ").trim().slice(0, 1200);
}

function researchDecision(input = {}) {
  const idea = typeof input.idea === "string" ? input.idea.trim() : "";
  const guidance =
    input.guidance && typeof input.guidance === "object" ? input.guidance : {};
  const mode = normalizeResearchMode(input.researchMode);
  const guidanceText = Object.values(guidance)
    .filter((value) => typeof value === "string")
    .join(" ");
  const combined = `${idea} ${guidanceText}`.trim();
  const targetUrls = extractUrls(combined);
  const lower = combined.toLowerCase();
  const explicitlyOff =
    /\b(do not|don't|dont|without|no)\s+(browse|search|research|web|internet|online sources?)\b/.test(
      lower,
    );
  if (mode === "off" || explicitlyOff) {
    return {
      required: false,
      mode: "off",
      reason: "Research was disabled.",
      queries: [],
      targetUrls,
    };
  }

  const explicit =
    /\b(research|browse|search|look up|verify|find sources?|cite sources?|read|scrape|latest|newest|current|today|recent|this year|in 2026|price|pricing|market|competitor|statistics?|regulation|law|policy|documentation|docs|api reference|compare|versus|\bvs\b)\b/i.test(
      combined,
    );
  const externalSubject =
    /\b(news|release notes?|framework|library|package|product|service|company|tool|platform|standard|requirement|trend|recommend(?:ation|ations)?|benchmark)\b/i.test(
      combined,
    );
  const factualQuestion =
    /\b(what|which|who|when|where|how much|how many)\b[^.!?]{0,100}\?/.test(
      combined,
    );
  const required =
    mode === "on" ||
    targetUrls.length > 0 ||
    explicit ||
    (externalSubject && factualQuestion);
  if (!required)
    return { required: false, mode: "auto", queries: [], targetUrls };

  const safeQuery = redactSecrets(combined.replace(URL_PATTERN, "")).slice(
    0,
    700,
  );
  const query = safeQuery || targetUrls[0] || "relevant current information";
  const freshness =
    /\b(today|current|latest|newest|recent|this week|this month|this year|2026)\b/i.test(
      combined,
    )
      ? "current"
      : "evergreen";
  return {
    required: true,
    mode,
    reason:
      mode === "on"
        ? "Research was requested."
        : targetUrls.length
          ? "A source URL was provided."
          : "The request depends on external or current information.",
    queries: query ? [query] : [],
    targetUrls,
    freshness,
  };
}

module.exports = {
  extractUrls,
  normalizeResearchMode,
  redactSecrets,
  researchDecision,
};
