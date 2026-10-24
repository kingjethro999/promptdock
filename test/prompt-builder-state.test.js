const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createClientLoader,
  memoryStorage,
} = require("./helpers/load-client-module.cjs");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { JSDOM } = require("jsdom");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture() {
  const requests = [];
  const storage = memoryStorage();
  const load = createClientLoader({
    localStorage: storage,
    fetch: (url, options) =>
      new Promise((resolve, reject) => {
        requests.push({
          url,
          body: JSON.parse(options.body),
          reject,
          resolve: (body) =>
            resolve({
              ok: true,
              headers: new Headers({ "content-type": "application/json" }),
              json: async () => body,
            }),
        });
      }),
  });
  const store = load("src/stores/prompt-builder.ts").usePromptBuilderStore;
  const data = {
    ...load("src/lib/prompt/types.ts").emptyPromptData,
    task: "Original document",
    raw: true,
  };
  const saved = {
    id: "saved-a",
    name: "Original",
    idea: "Original source",
    data,
    tags: [],
    analysis: null,
    updatedAt: "2026-10-23T00:00:00Z",
  };
  return { store, requests, storage, saved, load };
}

async function start(store) {
  const pending = store.getState().generate();
  await Promise.resolve();
  return { pending };
}

test("typing source before submission does not produce a ready document", () => {
  const { store } = fixture();
  store.getState().setIdea("An existing prompt pasted as source");
  assert.equal(store.getState().result, null);
  assert.equal(store.getState().ready, false);
});

test("editing source retains the current document and its source snapshot", () => {
  const { store, saved } = fixture();
  store.getState().loadPrompt(saved);
  const result = store.getState().result;
  const documentRevision = store.getState().documentRevision;
  store.getState().setIdea("Changed original source");
  assert.equal(store.getState().result, result);
  assert.equal(store.getState().ready, true);
  assert.equal(store.getState().documentSource, "Original source");
  assert.equal(store.getState().documentRevision, documentRevision);
  assert.match(store.getState().status, /kept|unchanged|previous/i);
});

test("request guidance never changes the current preview or saved payload", async () => {
  const { store, saved, load } = fixture();
  const dom = new JSDOM("<div id='root'></div>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const root = createRoot(dom.window.document.getElementById("root"));
  const useBuilder = load("src/hooks/usePromptBuilder.ts").usePromptBuilder;
  let builder;
  function Observer() {
    builder = useBuilder();
    return null;
  }
  try {
    store.getState().loadPrompt(saved);
    await React.act(async () => root.render(React.createElement(Observer)));
    await React.act(async () =>
      store.getState().updateGuidance("tone", "Professional"),
    );
    assert.equal(builder.prompt, "Original document");
    assert.equal(builder.data.tone, "");
    assert.equal(builder.guidance.tone, "Professional");
    const payload = load("src/hooks/useSavePrompt.ts").buildPayload(builder);
    assert.equal(payload.data.tone, "");
    assert.equal(payload.data.task, "Original document");
    await React.act(async () =>
      store.getState().setIdea("Unsubmitted replacement source"),
    );
    assert.equal(
      load("src/hooks/useSavePrompt.ts").buildPayload(builder).idea,
      "Original source",
    );
    // A field edit is a document edit, not consumption of next-request guidance.
    await React.act(async () =>
      store.getState().editPromptField("tone", "Friendly"),
    );
    assert.equal(builder.guidance.tone, "Professional");
    assert.match(builder.prompt, /Tone: Friendly/);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});

test("whole-document edits round-trip as raw SavedPrompt-compatible data", () => {
  const { store, saved, load } = fixture();
  store
    .getState()
    .loadPrompt({ ...saved, data: { ...saved.data, tone: "Friendly" } });
  const revision = store.getState().documentRevision;
  assert.equal(typeof store.getState().editDocument, "function");
  store.getState().editDocument("# Edited\n\nKeep {{name}} as a placeholder.");
  const edited = store.getState().result.data;
  assert.equal(edited.raw, true);
  assert.equal(edited.tone, "");
  assert.equal(store.getState().documentRevision, revision + 1);
  assert.equal(store.getState().documentEdited, true);
  assert.equal(
    load("src/lib/prompt/format.ts").buildPrompt(edited),
    "# Edited\n\nKeep {{name}} as a placeholder.",
  );
  store
    .getState()
    .loadPrompt({ ...saved, data: JSON.parse(JSON.stringify(edited)) });
  assert.equal(
    load("src/lib/prompt/format.ts").buildPrompt(store.getState().result.data),
    "# Edited\n\nKeep {{name}} as a placeholder.",
  );
});

for (const [label, change] of [
  ["source", (s) => s.setIdea("A different input")],
  ["research mode", (s) => s.setResearchMode("off")],
  ["reference URL", (s) => s.setReferenceUrl("https://docs.example.com/v2")],
  ["guidance", (s) => s.updateGuidance("tone", "Professional")],
]) {
  test(`changing ${label} invalidates in-flight generation without deleting output`, async () => {
    const { store, saved, requests } = fixture();
    store.getState().loadPrompt(saved);
    const result = store.getState().result;
    const { pending } = await start(store);
    change(store.getState());
    assert.equal(store.getState().busy, false);
    requests[0].resolve({
      provider: "test",
      data: { ...saved.data, task: "Stale response" },
    });
    await pending;
    assert.equal(store.getState().result, result);
    assert.equal(store.getState().ready, true);
  });
}

test("an old request cannot clear a new account's generation or replace its result", async () => {
  const { store, requests, saved, load } = fixture();
  const { bindBuilderAccount } = load("src/stores/prompt-builder-account.ts");
  await bindBuilderAccount("account-a");
  store.getState().setIdea("First account source");
  const first = await start(store);
  await bindBuilderAccount("account-b");
  store.getState().setIdea("Second account source");
  const second = await start(store);
  assert.equal(requests.length, 2);
  requests[0].resolve({
    provider: "test",
    data: { ...saved.data, task: "Old account secret" },
  });
  await first.pending;
  assert.equal(store.getState().busy, true);
  assert.equal(store.getState().result, null);
  requests[1].resolve({
    provider: "test",
    data: { ...saved.data, task: "New account prompt" },
  });
  await second.pending;
  assert.equal(store.getState().result.data.task, "New account prompt");
  assert.equal(store.getState().documentSource, "Second account source");
  assert.equal(store.getState().busy, false);
});

test("failed generation preserves the last successful document", async () => {
  const { store, requests, saved } = fixture();
  store.getState().loadPrompt(saved);
  store.getState().setIdea("Refine a new source");
  const { pending } = await start(store);
  requests[0].reject(new Error("Provider unavailable"));
  await pending;
  assert.equal(store.getState().result?.data.task, "Original document");
  assert.equal(store.getState().ready, true);
  assert.match(store.getState().status, /Provider unavailable/);
});

test("source-preserved fallback is labeled honestly and never replaces a usable prior result", async () => {
  const { store, requests, saved } = fixture();
  store.getState().setIdea("Original source");
  const first = await start(store);
  requests[0].resolve({ provider: "source-preserved", data: saved.data });
  await first.pending;
  assert.match(store.getState().status, /preserv/i);
  assert.doesNotMatch(store.getState().status, /prompt ready/i);
  store.getState().loadPrompt(saved);
  const result = store.getState().result;
  store.getState().setIdea("Replacement source");
  const second = await start(store);
  requests[1].resolve({
    provider: "source-preserved",
    data: { ...saved.data, task: "Replacement source" },
  });
  await second.pending;
  assert.equal(store.getState().result, result);
  assert.match(store.getState().status, /previous|kept/i);
});

test("clear and loading a template intentionally reset the document", () => {
  const { store, saved } = fixture();
  for (const reset of [
    () => store.getState().clear(),
    () =>
      store
        .getState()
        .loadTemplate({ name: "Test", idea: "Template idea", guidance: {} }),
  ]) {
    store.getState().loadPrompt(saved);
    const revision = store.getState().documentRevision;
    reset();
    assert.equal(store.getState().result, null);
    assert.equal(store.getState().ready, false);
    assert.equal(store.getState().documentSource, "");
    assert.equal(store.getState().documentRevision, revision + 1);
  }
});

test("old account drafts restore with a source snapshot without restoring request identity", async () => {
  const { store, saved, storage } = fixture();
  storage.setItem(
    "promptdock.react-draft.v1",
    JSON.stringify({
      version: 0,
      state: {
        idea: saved.idea,
        result: { provider: "library", data: saved.data },
        ready: true,
        sourcePrompt: saved,
      },
    }),
  );
  const revision = store.getState().revision;
  await store.persist.rehydrate();
  assert.equal(store.getState().documentSource, "Original source");
  assert.equal(store.getState().documentEdited, false);
  assert.equal(store.getState().revision, revision);
  assert.equal(store.getState().busy, false);
});
