const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, webcrypto } = require("node:crypto");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, "src", name), "utf8");
const html = read("index.html");
const sources = ["prompt-format.js", "diff.js", "app.js"].map(read);
const STORAGE_KEY = "promptdock.prompts.v1";

const SEED = [
  {
    id: "2f4d9f60-1f3b-4a5f-9d21-8f6a2b5c7e01",
    name: "Launch email",
    data: { task: "Write a launch email", tone: "Warm" },
    idea: "Ship day announcement",
    analysis: null,
    tags: ["email", "marketing"],
    updatedAt: "2026-01-05T10:00:00.000Z",
  },
  {
    id: "3a5e8c71-2c4d-4b6e-8f32-9a7b3c6d8f02",
    name: "Support reply",
    data: { task: "Answer an angry customer", tone: "Calm" },
    idea: "Late delivery complaint",
    analysis: null,
    tags: ["support"],
    updatedAt: "2026-01-06T11:30:00.000Z",
  },
  {
    id: "4b6f9d82-3d5e-4c7f-9a43-1b8c4d7e9a03",
    name: "Blog outline",
    data: { task: "Outline a blog post", tone: "Neutral" },
    idea: "Prompt engineering basics",
    analysis: null,
    tags: ["marketing"],
    updatedAt: "2026-01-07T09:15:00.000Z",
  },
];

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type"
          ? "application/json"
          : null;
      },
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

async function waitFor(check, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline)
      throw new Error("Timed out waiting for the page.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function emptySettings() {
  return {
    available: true,
    providers: [],
    activeProviderId: null,
    provider: null,
    model: "",
    hasKey: false,
    updatedAt: null,
  };
}

function activate(settings, providerId) {
  settings.activeProviderId = providerId;
  for (const entry of settings.providers)
    entry.active = entry.providerId === providerId;
  const active =
    settings.providers.find((entry) => entry.providerId === providerId) || null;
  settings.provider = active ? active.provider : null;
  settings.model = active ? active.model : "";
  settings.hasKey = Boolean(active);
  settings.updatedAt = active ? active.updatedAt : null;
}

async function createWorkspace(seed = SEED, options = {}) {
  const dom = new JSDOM(html, {
    url: "http://localhost:3000/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.PROMPTDOCK_CONFIG = { version: "0.0.0-test" };
  window.scrollTo = () => {};
  window.confirm = () => true;
  Object.defineProperty(window, "crypto", {
    configurable: true,
    value: {
      getRandomValues: (array) => webcrypto.getRandomValues(array),
      randomUUID: () => randomUUID(),
    },
  });
  const calls = [];
  const requests = [];
  const state = { settings: options.settings || emptySettings() };
  window.fetch = async (url, init = {}) => {
    const pathname = String(url);
    const method = (init.method || "GET").toUpperCase();
    calls.push(pathname);
    let body = null;
    if (init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = null;
      }
    }
    requests.push({ pathname, method, body });
    if (pathname.startsWith("/api/auth/me"))
      return options.user
        ? jsonResponse(200, { user: options.user })
        : jsonResponse(401, { error: "Sign in first." });
    if (pathname.startsWith("/api/status"))
      return jsonResponse(200, {
        aiAvailable: true,
        voiceAvailable: true,
        databaseAvailable: Boolean(options.user),
      });
    if (pathname === "/api/settings") return jsonResponse(200, state.settings);
    if (pathname === "/api/settings/active" && method === "POST") {
      activate(state.settings, body ? body.providerId : null);
      return jsonResponse(200, state.settings);
    }
    if (pathname === "/api/settings/providers" && method === "POST") {
      const entry = {
        providerId: randomUUID(),
        name: body.name,
        provider: body.provider,
        model: body.model,
        baseUrl: body.baseUrl || "",
        active: true,
        updatedAt: new Date().toISOString(),
      };
      state.settings.providers.push(entry);
      activate(state.settings, entry.providerId);
      return jsonResponse(200, state.settings);
    }
    if (pathname.startsWith("/api/settings/providers/") && method === "PUT") {
      const providerId = pathname.slice("/api/settings/providers/".length);
      const entry = state.settings.providers.find(
        (item) => item.providerId === providerId,
      );
      if (!entry) return jsonResponse(404, { error: "Provider not found." });
      entry.name = body.name;
      entry.provider = body.provider;
      entry.model = body.model;
      entry.baseUrl = body.baseUrl || "";
      entry.updatedAt = new Date().toISOString();
      activate(state.settings, providerId);
      return jsonResponse(200, state.settings);
    }
    if (
      pathname.startsWith("/api/settings/providers/") &&
      method === "DELETE"
    ) {
      const providerId = pathname.slice("/api/settings/providers/".length);
      state.settings.providers = state.settings.providers.filter(
        (item) => item.providerId !== providerId,
      );
      if (state.settings.activeProviderId === providerId)
        activate(state.settings, null);
      return jsonResponse(200, state.settings);
    }
    if (pathname.startsWith("/api/prompts/tags"))
      return jsonResponse(200, { tags: [] });
    if (pathname.startsWith("/api/prompts/export"))
      return jsonResponse(200, { prompts: [] });
    if (pathname.startsWith("/api/prompts"))
      return jsonResponse(200, { prompts: [], total: 0 });
    if (pathname.startsWith("/api/auth/sessions"))
      return jsonResponse(200, { sessions: [] });
    if (pathname.startsWith("/api/usage"))
      return jsonResponse(200, { usage: [] });
    return jsonResponse(404, { error: "Not found." });
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  for (const source of sources) window.eval(source);
  await waitFor(() => calls.some((pathname) => pathname === "/api/status"));
  await new Promise((resolve) => setTimeout(resolve, 25));
  return { window, calls, requests, state };
}

function cardNames(window) {
  return [
    ...window.document.querySelectorAll("#libraryGrid .library-card h3"),
  ].map((element) => element.textContent);
}

function summary(window) {
  return window.document.getElementById("librarySummary").textContent;
}

async function importBackup(window, backup) {
  const text = JSON.stringify(backup);
  const file = {
    name: "backup.json",
    size: Buffer.byteLength(text),
    text: async () => text,
  };
  const input = window.document.getElementById("backupFile");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  await waitFor(
    () =>
      window.document
        .getElementById("toast")
        .textContent.startsWith("Imported") ||
      window.document.getElementById("toast").textContent.includes("backup"),
  );
}

test("typing in search filters the visible library cards", async (t) => {
  const { window } = await createWorkspace();
  t.after(() => window.close());
  const doc = window.document;
  assert.deepEqual(cardNames(window), [
    "Launch email",
    "Support reply",
    "Blog outline",
  ]);
  assert.equal(summary(window), "3 saved prompts");

  const input = doc.getElementById("librarySearch");
  input.value = "support";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.deepEqual(cardNames(window), ["Support reply"]);
  assert.equal(summary(window), "1 matching prompt");

  input.value = "marketing";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.deepEqual(cardNames(window), ["Launch email", "Blog outline"]);
  assert.equal(summary(window), "2 matching prompts");

  input.value = "nothing here";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.deepEqual(cardNames(window), []);
  assert.equal(summary(window), "0 matching prompts");
  assert.ok(doc.querySelector("#libraryGrid .empty-state"));

  input.value = "";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.deepEqual(cardNames(window), [
    "Launch email",
    "Support reply",
    "Blog outline",
  ]);

  input.value = "marketing";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const supportChip = [...doc.querySelectorAll("#tagChips .tag-chip")].find(
    (chip) => chip.textContent.startsWith("support"),
  );
  supportChip.click();
  assert.deepEqual(cardNames(window), []);
  assert.equal(summary(window), "0 matching prompts");
});

test("tag chips narrow the library and toggle themselves off", async (t) => {
  const { window } = await createWorkspace();
  t.after(() => window.close());
  const doc = window.document;
  const chips = () => [...doc.querySelectorAll("#tagChips .tag-chip")];
  const labels = () => chips().map((chip) => chip.textContent);

  assert.deepEqual(labels(), ["marketing · 2", "email · 1", "support · 1"]);

  chips()[0].click();
  assert.equal(chips()[0].classList.contains("is-active"), true);
  assert.equal(chips()[0].getAttribute("aria-pressed"), "true");
  assert.deepEqual(cardNames(window), ["Launch email", "Blog outline"]);
  assert.equal(summary(window), "2 matching prompts");

  chips()[2].click();
  assert.deepEqual(cardNames(window), ["Support reply"]);
  assert.equal(summary(window), "1 matching prompt");

  chips()[0].click();
  assert.deepEqual(cardNames(window), ["Launch email", "Blog outline"]);
  assert.equal(summary(window), "2 matching prompts");

  chips()[0].click();
  assert.deepEqual(cardNames(window), [
    "Launch email",
    "Support reply",
    "Blog outline",
  ]);
  assert.equal(summary(window), "3 saved prompts");
  assert.equal(
    chips().some((chip) => chip.classList.contains("is-active")),
    false,
  );
});

test("importing a backup adds its prompts with ids, dates, and tags", async (t) => {
  const { window } = await createWorkspace();
  t.after(() => window.close());
  const doc = window.document;
  const importedId = "5c7a0e93-4e6f-4d8a-8b54-2c9d5e8f0b04";

  await importBackup(window, {
    app: "PromptDock",
    version: 1,
    prompts: [
      {
        id: importedId,
        name: "Imported roadmap",
        data: { task: "Craft a roadmap", tone: "Neutral" },
        idea: "Q3 roadmap",
        analysis: null,
        tags: ["planning"],
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        name: "Imported changelog",
        data: { task: "Draft a changelog" },
        idea: "release notes",
      },
    ],
  });

  assert.deepEqual(cardNames(window), [
    "Imported roadmap",
    "Imported changelog",
    "Launch email",
    "Support reply",
    "Blog outline",
  ]);
  assert.equal(
    doc.getElementById("toast").textContent,
    "Imported 2 private prompts.",
  );

  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(stored.length, 5);
  assert.equal(stored[0].id, importedId);
  assert.deepEqual(stored[0].tags, ["planning"]);
  assert.equal(stored[0].updatedAt, "2026-02-01T00:00:00.000Z");
  assert.notEqual(stored[1].id, importedId);
  assert.deepEqual(stored[1].tags, []);

  const chips = [...doc.querySelectorAll("#tagChips .tag-chip")].map(
    (chip) => chip.textContent,
  );
  assert.ok(chips.includes("planning · 1"));
});

test("importing a backup refuses duplicate ids and bad files", async (t) => {
  const { window } = await createWorkspace();
  t.after(() => window.close());
  const doc = window.document;

  await importBackup(window, {
    app: "PromptDock",
    version: 1,
    prompts: [
      { ...SEED[0], name: "Launch email (reimported)" },
      { ...SEED[1], name: "Support reply (reimported)" },
    ],
  });
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  const ids = stored.map((prompt) => prompt.id);
  assert.equal(new Set(ids).size, ids.length, "ids must stay unique");
  assert.equal(ids.filter((id) => id === SEED[0].id).length, 1);
  assert.equal(stored[2].name, "Launch email");
  assert.equal(stored[0].name, "Launch email (reimported)");
  assert.deepEqual(cardNames(window).slice(0, 2), [
    "Launch email (reimported)",
    "Support reply (reimported)",
  ]);
  assert.equal(
    doc.getElementById("toast").textContent,
    "Imported 2 private prompts.",
  );

  await importBackup(window, { app: "Other", version: 1, prompts: [] });
  assert.equal(
    doc.getElementById("toast").textContent,
    "Choose a PromptDock JSON backup with 1–10,000 prompts.",
  );
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).length, 5);
});

test("settings switches saved providers and custom endpoints", async (t) => {
  const idGroq = "11111111-1111-4111-8111-111111111111";
  const idLocal = "22222222-2222-4222-8222-222222222222";
  const settings = {
    available: true,
    providers: [
      {
        providerId: idGroq,
        name: "Work Groq",
        provider: "groq",
        model: "openai/gpt-oss-120b",
        baseUrl: "",
        active: true,
        updatedAt: "2026-09-30T00:00:00Z",
      },
      {
        providerId: idLocal,
        name: "Local Ollama",
        provider: "openai",
        model: "llama3",
        baseUrl: "http://localhost:11434/v1",
        active: false,
        updatedAt: "2026-09-29T00:00:00Z",
      },
    ],
    activeProviderId: idGroq,
    provider: "groq",
    model: "openai/gpt-oss-120b",
    hasKey: true,
    updatedAt: "2026-09-30T00:00:00Z",
  };
  const { window, requests, state } = await createWorkspace([], {
    user: { id: "u1", email: "hello@example.com" },
    settings,
  });
  t.after(() => window.close());
  const doc = window.document;
  await waitFor(() =>
    doc.getElementById("byokState").textContent.includes("Work Groq"),
  );

  doc.querySelector('.nav-item[data-view="settings"]').click();
  const select = doc.getElementById("byokActive");
  const nameInput = doc.getElementById("byokName");
  const typeInput = doc.getElementById("byokType");
  assert.deepEqual(
    [...select.options].map((option) => option.textContent),
    [
      "PromptDock default",
      "Work Groq · Groq",
      "Local Ollama · OpenAI-compatible",
    ],
  );
  assert.equal(select.value, idGroq);
  assert.equal(nameInput.value, "Work Groq");
  assert.equal(typeInput.value, "groq");
  assert.equal(
    doc.getElementById("byokBaseUrlRow").classList.contains("hidden"),
    true,
  );
  assert.equal(
    doc.getElementById("byokDelete").classList.contains("hidden"),
    false,
  );

  typeInput.value = "anthropic";
  typeInput.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(
    doc.getElementById("byokBaseUrlRow").classList.contains("hidden"),
    false,
  );
  assert.equal(doc.getElementById("byokBaseUrl").required, true);
  typeInput.value = "groq";
  typeInput.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(doc.getElementById("byokBaseUrl").required, false);

  select.value = idLocal;
  select.dispatchEvent(new window.Event("change", { bubbles: true }));
  await waitFor(() =>
    requests.some(
      (request) =>
        request.pathname === "/api/settings/active" &&
        request.body?.providerId === idLocal,
    ),
  );
  await waitFor(() => nameInput.value === "Local Ollama");
  assert.equal(select.value, idLocal);
  assert.equal(state.settings.activeProviderId, idLocal);
  assert.equal(
    doc.getElementById("byokBaseUrl").value,
    "http://localhost:11434/v1",
  );
  assert.ok(
    doc.getElementById("byokState").textContent.includes("Local Ollama"),
  );

  doc.getElementById("byokNew").click();
  assert.equal(nameInput.value, "");
  assert.equal(
    doc.getElementById("byokDelete").classList.contains("hidden"),
    true,
  );
  nameInput.value = "OpenRouter";
  typeInput.value = "openai";
  typeInput.dispatchEvent(new window.Event("change", { bubbles: true }));
  doc.getElementById("byokBaseUrl").value = "https://openrouter.ai/api/v1";
  doc.getElementById("byokModel").value = "llama-3.3-70b-instruct";
  doc.getElementById("byokKey").value = "personal-key";
  doc
    .getElementById("byokForm")
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await waitFor(() =>
    requests.some(
      (request) =>
        request.pathname === "/api/settings/providers" &&
        request.method === "POST" &&
        request.body?.name === "OpenRouter" &&
        request.body?.baseUrl === "https://openrouter.ai/api/v1" &&
        request.body?.apiKey === "personal-key",
    ),
  );
  await waitFor(() => state.settings.providers.length === 3);
  await waitFor(() => select.value === state.settings.activeProviderId);
  assert.equal(
    state.settings.activeProviderId,
    state.settings.providers[2].providerId,
  );
  assert.equal(select.value, state.settings.providers[2].providerId);
  assert.ok(
    doc
      .getElementById("byokFeedback")
      .textContent.includes("added and activated"),
  );

  doc.getElementById("removeByok").click();
  await waitFor(() => state.settings.activeProviderId === null);
  await waitFor(() => select.value === "__default__");
  assert.equal(state.settings.providers.length, 3);
  assert.equal(nameInput.value, "");
  assert.equal(
    doc.getElementById("byokDelete").classList.contains("hidden"),
    true,
  );
  assert.equal(
    doc.getElementById("byokKeyHint").classList.contains("hidden"),
    false,
  );
});
