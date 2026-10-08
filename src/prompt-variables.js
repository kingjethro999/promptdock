const VARIABLE_PATTERN = /\{\{([a-zA-Z0-9_ -]+)\}\}/g;

function extractPromptVariables(text) {
  if (typeof text !== "string" || !text) return [];
  const found = new Set();
  let match;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    const name = match[1].trim();
    if (name) found.add(name);
  }
  return [...found];
}

function interpolatePrompt(text, values = {}) {
  if (typeof text !== "string") return "";
  if (!values || typeof values !== "object") return text;
  return text.replace(VARIABLE_PATTERN, (match, rawName) => {
    const name = rawName.trim();
    const val = values[name];
    return val !== undefined && val !== null && String(val).trim() !== ""
      ? String(val)
      : match;
  });
}

module.exports = {
  VARIABLE_PATTERN,
  extractPromptVariables,
  interpolatePrompt,
};
