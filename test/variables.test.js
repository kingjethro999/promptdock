const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractPromptVariables,
  interpolatePrompt,
} = require("../src/prompt-variables");

test("extractPromptVariables finds unique placeholders in text", () => {
  const text = "Write a blog post about {{topic}} for {{audience}}. Make sure {{topic}} is explained clearly.";
  const variables = extractPromptVariables(text);
  assert.deepEqual(variables, ["topic", "audience"]);
});

test("extractPromptVariables returns empty array for plain text without variables", () => {
  assert.deepEqual(extractPromptVariables("A simple prompt without variables"), []);
  assert.deepEqual(extractPromptVariables(""), []);
  assert.deepEqual(extractPromptVariables(null), []);
});

test("extractPromptVariables handles spaces inside brackets", () => {
  const text = "Evaluate {{ product name }} for {{ target market }}";
  assert.deepEqual(extractPromptVariables(text), ["product name", "target market"]);
});

test("interpolatePrompt substitutes provided values", () => {
  const text = "Hello {{name}}, welcome to {{platform}}!";
  const result = interpolatePrompt(text, { name: "Alice", platform: "PromptDock" });
  assert.equal(result, "Hello Alice, welcome to PromptDock!");
});

test("interpolatePrompt preserves unfilled variables", () => {
  const text = "Analyze {{dataset}} using {{algorithm}} and output {{format}}.";
  const result = interpolatePrompt(text, { dataset: "sales_2026.csv" });
  assert.equal(result, "Analyze sales_2026.csv using {{algorithm}} and output {{format}}.");
});
