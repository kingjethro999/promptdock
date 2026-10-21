const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyRefinement,
  splitStructuredDocument,
  parseRequirementInventory,
  parseCoverageValidation,
  parseDetailedRefinement,
  preservedSourcePrompt,
} = require("../src/refinement-fidelity");

test("classifies short ideas separately from detailed specifications", () => {
  assert.equal(
    classifyRefinement({ idea: "Write a launch email" }).kind,
    "brief",
  );

  const detailed = [
    "# Existing application",
    "Preserve the PostgreSQL schema.",
    "- Authentication must support Google.",
    "- Authentication must support GitHub.",
    "- Do not create duplicate accounts.",
    "- Existing users must sign in before linking providers.",
    "## API",
    "- Keep the current response contract.",
    "- Do not expose secrets in logs.",
    "## Tests",
    "- Run the existing suite.",
    "- Add regression coverage.",
    "## Deployment",
    "- Preserve current environment variables.",
    "- Do not introduce downtime.",
  ].join("\n");
  assert.equal(classifyRefinement({ idea: detailed }).fidelity, true);
});

test("splits extensive documents on line boundaries without breaking fences", () => {
  const section = [
    "## Requirement",
    "```ts",
    "const enabled = true;",
    "```",
    "The implementation must preserve this example.",
  ].join("\n");
  const chunks = splitStructuredDocument(Array(80).fill(section).join("\n"), {
    maxEstimatedTokens: 500,
  });
  assert.ok(chunks.length > 1);
  assert.ok(
    chunks.every((chunk) => (chunk.match(/```/g) || []).length % 2 === 0),
  );
  assert.equal(
    chunks.join("\n").replace(/\n+/g, "\n").includes("const enabled = true;"),
    true,
  );
});

test("inventory parser assigns stable server IDs and retains negative requirements", () => {
  const inventory = parseRequirementInventory(
    JSON.stringify({
      sourceType: "detailed_document",
      intent: "Refine authentication instructions",
      requirements: [
        {
          text: "Support Google authentication",
          kind: "functionality",
          priority: "required",
          evidence: "Authentication must support Google",
        },
        {
          text: "Do not create duplicate accounts",
          kind: "prohibition",
          priority: "required",
          evidence: "Do not create duplicate accounts",
        },
      ],
      unresolvedQuestions: [],
    }),
  );
  assert.deepEqual(
    inventory.requirements.map(({ id }) => id),
    ["R001", "R002"],
  );
  assert.equal(inventory.requirements[1].kind, "prohibition");
});

test("coverage validation cannot pass when a requirement ID is absent", () => {
  const inventory = {
    requirements: [{ id: "R001" }, { id: "R002" }, { id: "R003" }],
  };
  const result = parseCoverageValidation(
    JSON.stringify({
      passed: true,
      coveredRequirementIds: ["R001", "R003"],
      missingRequirementIds: [],
      weakenedRequirementIds: [],
      sourceRequirementsMissingFromInventory: [],
      contradictions: [],
      unsupportedAssumptions: [],
      placeholdersForKnownInfo: [],
      changedDeliverable: false,
    }),
    inventory,
  );
  assert.equal(result.passed, false);
  assert.deepEqual(result.missingRequirementIds, ["R002"]);
});

test("coverage validation fails when source requirements were omitted from the inventory", () => {
  const result = parseCoverageValidation(
    JSON.stringify({
      coveredRequirementIds: ["R001"],
      sourceRequirementsMissingFromInventory: [
        "Preserve the explicit rollback constraint.",
      ],
    }),
    { requirements: [{ id: "R001" }] },
  );
  assert.equal(result.passed, false);
  assert.deepEqual(result.sourceRequirementsMissingFromInventory, [
    "Preserve the explicit rollback constraint.",
  ]);
});

test("detailed refinement becomes a compatible raw PromptData response", () => {
  const result = parseDetailedRefinement(
    JSON.stringify({
      refinedPrompt: "# Objective\nPreserve every explicit requirement.",
      interpretation: {
        goal: "Preserve the specification",
        focusAreas: ["Requirement coverage"],
        missingDetails: [],
      },
    }),
  );
  assert.equal(result.data.raw, true);
  assert.equal(
    result.data.task,
    "# Objective\nPreserve every explicit requirement.",
  );
  assert.equal(result.data.context, "");
});

test("safe fallback preserves source, guidance, clarifications, and research context", () => {
  const prompt = preservedSourcePrompt({
    idea: "Keep the existing schema exactly.",
    guidance: { constraints: "No downtime" },
    clarifications: [
      { question: "Which database?", answer: "PostgreSQL" },
      { question: "What region?", answer: "" },
    ],
    context: "Official docs recommend the current stable release.",
  });
  assert.match(prompt, /^Keep the existing schema exactly\./);
  assert.match(prompt, /No downtime/);
  assert.match(prompt, /Which database\?/);
  assert.match(prompt, /PostgreSQL/);
  assert.match(prompt, /What region\?/);
  assert.match(prompt, /left unanswered/);
  assert.match(prompt, /Official docs recommend/);
});
