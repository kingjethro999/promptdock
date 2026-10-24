const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { researchDecision } = require("../src/research/intent");

function loadGeneration(responses) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/stores/prompt-builder-generation.ts"),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const requests = [];
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(id) {
      if (id === "@/lib/client/api") {
        return {
          api: async (_url, options) => {
            requests.push(JSON.parse(options.body));
            return responses.shift();
          },
        };
      }
      if (id === "@/lib/client/images") {
        return {
          ideaPayload: async (idea, guidance, _files, clarifications) =>
            JSON.stringify({ idea, guidance, clarifications }),
        };
      }
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return { exports, requests };
}

function stateFor(researchMode, referenceUrl) {
  return {
    idea: "Research the latest API documentation",
    guidance: {},
    researchMode,
    referenceUrl,
    attachments: [],
    busy: false,
    revision: 0,
    documentRevision: 0,
    documentSource: "",
    documentEdited: false,
    pending: null,
    result: null,
    ready: false,
    status: "",
  };
}

function stateAccess(initialState) {
  let state = initialState;
  return {
    get: () => state,
    set(update) {
      state = {
        ...state,
        ...(typeof update === "function" ? update(state) : update),
      };
    },
  };
}

for (const researchMode of ["off", "on", "auto"]) {
  test(`clarification continuation retains Research ${researchMode} and the entered URL`, async () => {
    const loaded = loadGeneration([
      {
        questions: ["Which API version should this target?"],
        research: { used: false, sources: [] },
      },
      { data: { task: "Create an API documentation prompt" } },
    ]);
    const state = stateAccess(
      stateFor(researchMode, "https://docs.example.com/api"),
    );

    await loaded.exports.generatePrompt(state.get, state.set);
    await loaded.exports.completePromptClarification(state.get, state.set);

    const continuation = loaded.requests[1];
    assert.equal(continuation.researchMode, researchMode);
    assert.deepEqual(continuation.referenceUrls, [
      "https://docs.example.com/api",
    ]);
    const decision = researchDecision(continuation);
    assert.equal(decision.mode, researchMode);
    assert.deepEqual(decision.targetUrls, ["https://docs.example.com/api"]);
    if (researchMode === "off") assert.equal(decision.required, false);
  });
}

test("clarification skip also retains the initial research choices", async () => {
  const loaded = loadGeneration([
    { questions: ["Which API version should this target?"] },
    { data: { task: "Create an API documentation prompt" } },
  ]);
  const state = stateAccess(stateFor("off", "https://docs.example.com/api"));

  await loaded.exports.generatePrompt(state.get, state.set);
  await loaded.exports.completePromptClarification(state.get, state.set, true);

  assert.equal(loaded.requests[1].researchMode, "off");
  assert.deepEqual(loaded.requests[1].referenceUrls, [
    "https://docs.example.com/api",
  ]);
  assert.equal(loaded.requests[1].clarifications[0].answer, "");
});

test("clarification reuses cached research without dropping its source", async () => {
  const loaded = loadGeneration([
    {
      questions: ["Which API version should this target?"],
      research: {
        used: true,
        context: "Cached official API documentation",
        sources: [{ title: "API docs", url: "https://docs.example.com/api" }],
      },
    },
    { data: { task: "Create an API documentation prompt" } },
  ]);
  const state = stateAccess(stateFor("on", "https://docs.example.com/api"));

  await loaded.exports.generatePrompt(state.get, state.set);
  await loaded.exports.completePromptClarification(state.get, state.set);

  assert.equal(
    loaded.requests[1].researchContext,
    "Cached official API documentation",
  );
  assert.deepEqual(loaded.requests[1].researchSources, [
    { title: "API docs", url: "https://docs.example.com/api" },
  ]);
  assert.deepEqual(loaded.requests[1].referenceUrls, [
    "https://docs.example.com/api",
  ]);
});

test("clarification uses research choices changed while the question was open", async () => {
  const loaded = loadGeneration([
    { questions: ["Which API version should this target?"] },
    { data: { task: "Create an API documentation prompt" } },
  ]);
  const state = stateAccess(stateFor("off", ""));

  await loaded.exports.generatePrompt(state.get, state.set);
  state.set({
    researchMode: "on",
    referenceUrl: "https://docs.example.com/v2",
  });
  await loaded.exports.completePromptClarification(state.get, state.set);

  assert.equal(loaded.requests[1].researchMode, "on");
  assert.deepEqual(loaded.requests[1].referenceUrls, [
    "https://docs.example.com/v2",
  ]);
  assert.equal(researchDecision(loaded.requests[1]).required, true);
});
