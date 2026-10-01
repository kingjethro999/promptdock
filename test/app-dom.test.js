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
  if (options.inviteCode)
    window.document.body.dataset.inviteCode = options.inviteCode;
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
    if (pathname === "/api/idea-to-prompt" && method === "POST")
      return jsonResponse(
        200,
        options.ideaResponse || {
          provider: "test",
          data: {
            task: `Create a useful answer for: ${body.idea}`,
            focus: "The requested result first",
            depth: "Balanced",
          },
          interpretation: {
            goal: "Create the requested result",
            focusAreas: ["The requested result first"],
            missingDetails: [],
          },
        },
      );
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
    if (/^\/api\/prompts\/[^/]+\/public$/.test(pathname) && method === "PATCH")
      return jsonResponse(200, {
        prompt: {
          id: pathname.split("/")[3],
          name: "Shared prompt",
          data: { task: "Write a useful answer" },
          publicId: body.published ? randomUUID() : null,
        },
      });
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
    if (pathname === "/api/referrals")
      return jsonResponse(
        200,
        options.referrals || {
          code: "AbCdEf123_-x",
          url: "https://thepromptdock.vercel.app/invite/AbCdEf123_-x",
          total: 2,
          verified: 1,
          rewardLevel: 1,
          maxRewards: 5,
        },
      );
    if (pathname === "/api/feedback" && method === "POST")
      return jsonResponse(201, { ok: true, id: randomUUID() });
    return jsonResponse(404, { error: "Not found." });
  };
  const dialogProto = window.HTMLDialogElement.prototype;
  dialogProto.showModal = function () {
    this.setAttribute("open", "");
  };
  dialogProto.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new window.Event("close"));
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

test("publishing uses a branded confirmation before creating a link", async (t) => {
  const { window, requests } = await createWorkspace([], {
    user: { id: "u1", email: "hello@example.com", username: "KingJethro" },
  });
  t.after(() => window.close());
  let nativeConfirmCalls = 0;
  window.confirm = () => {
    nativeConfirmCalls++;
    return true;
  };
  const doc = window.document;
  const item = {
    id: "99999999-9999-4999-8999-999999999999",
    name: "Trading bot",
    data: { task: "Build a trading bot" },
    publicId: null,
  };

  const cancelled = window.eval(`openShare(${JSON.stringify(item)})`);
  await waitFor(() => doc.getElementById("confirmDialog").open);
  assert.equal(
    doc.getElementById("confirmTitle").textContent,
    "Make this prompt public?",
  );
  doc.getElementById("confirmCancel").click();
  await cancelled;
  assert.equal(
    requests.some((request) => request.pathname.endsWith("/public")),
    false,
  );

  const accepted = window.eval(`openShare(${JSON.stringify(item)})`);
  await waitFor(() => doc.getElementById("confirmDialog").open);
  doc.getElementById("confirmAccept").click();
  await accepted;
  assert.equal(doc.getElementById("shareDialog").open, true);
  assert.equal(
    requests.filter((request) => request.pathname.endsWith("/public")).length,
    1,
  );
  assert.equal(nativeConfirmCalls, 0);
});

test("deleting a library prompt requires a branded destructive confirmation", async (t) => {
  const { window } = await createWorkspace(SEED);
  t.after(() => window.close());
  const doc = window.document;
  let nativeConfirmCalls = 0;
  window.confirm = () => {
    nativeConfirmCalls++;
    return true;
  };
  doc.querySelector('.nav-item[data-view="library"]').click();
  const firstDelete = doc.querySelector(".library-card .card-menu");
  firstDelete.click();
  await waitFor(() => doc.getElementById("confirmDialog").open);
  assert.equal(
    doc.getElementById("confirmDialog").classList.contains("is-danger"),
    true,
  );
  doc.getElementById("confirmCancel").click();
  assert.equal(cardNames(window).length, 3);

  firstDelete.click();
  await waitFor(() => doc.getElementById("confirmDialog").open);
  doc.getElementById("confirmAccept").click();
  await waitFor(() => cardNames(window).length === 2);
  assert.equal(nativeConfirmCalls, 0);
});

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

test("long dropdowns open a searchable list that drives the select", async (t) => {
  const idGroq = "33333333-3333-4333-8333-333333333333";
  const idLocal = "44444444-4444-4444-8444-444444444444";
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
  const { window, state } = await createWorkspace([], {
    user: { id: "u1", email: "hello@example.com" },
    settings,
  });
  t.after(() => window.close());
  const doc = window.document;
  await waitFor(() =>
    doc.getElementById("byokState").textContent.includes("Work Groq"),
  );

  const select = doc.getElementById("byokActive");
  const wrap = select.nextElementSibling;
  assert.ok(wrap.classList.contains("search-select"));
  assert.equal(select.hidden, true);
  const trigger = wrap.querySelector(".search-select-trigger");
  const label = wrap.querySelector(".search-select-value");
  const input = wrap.querySelector(".search-select-input");
  const panel = wrap.querySelector(".search-select-panel");
  const empty = wrap.querySelector(".search-select-empty");
  assert.equal(label.textContent, "Work Groq · Groq");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(select.tabIndex, -1);
  assert.equal(select.getAttribute("aria-hidden"), "true");
  assert.equal(
    doc.querySelector('label[for="byokActive-trigger"]').textContent.trim(),
    "Active provider",
  );

  trigger.click();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(panel.classList.contains("hidden"), false);
  assert.equal(doc.activeElement, input);
  assert.deepEqual(
    [...wrap.querySelectorAll(".search-select-option")].map(
      (item) => item.textContent,
    ),
    [
      "PromptDock default",
      "Work Groq · Groq",
      "Local Ollama · OpenAI-compatible",
    ],
  );

  input.value = "ollama";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const matches = [...wrap.querySelectorAll(".search-select-option")];
  assert.deepEqual(
    matches.map((item) => item.textContent),
    ["Local Ollama · OpenAI-compatible"],
  );
  input.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  );
  assert.equal(input.getAttribute("aria-activedescendant"), matches[0].id);
  input.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );

  assert.equal(select.value, idLocal);
  assert.equal(panel.classList.contains("hidden"), true);
  await waitFor(() => state.settings.activeProviderId === idLocal);
  await waitFor(() => label.textContent === "Local Ollama · OpenAI-compatible");

  trigger.click();
  input.value = "nothing here";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(wrap.querySelectorAll(".search-select-option").length, 0);
  assert.equal(empty.classList.contains("hidden"), false);
});

test("every workspace select has one visible custom control", async (t) => {
  const { window } = await createWorkspace(SEED);
  t.after(() => window.close());
  const doc = window.document;
  const selects = [...doc.querySelectorAll("select")];
  assert.deepEqual(selects.map((select) => select.id).sort(), [
    "byokActive",
    "byokType",
    "librarySort",
  ]);
  for (const select of selects) {
    assert.equal(select.hidden, true, `${select.id} native control is hidden`);
    assert.equal(select.tabIndex, -1);
    assert.equal(
      select.nextElementSibling.classList.contains("search-select"),
      true,
    );
  }

  doc.querySelector('.nav-item[data-view="library"]').click();
  const sort = doc.getElementById("librarySort");
  const wrap = sort.nextElementSibling;
  const trigger = wrap.querySelector(".search-select-trigger");
  trigger.click();
  assert.equal(
    wrap.querySelector(".search-select-input").classList.contains("hidden"),
    true,
  );
  const nameOption = [...wrap.querySelectorAll(".search-select-option")].find(
    (option) => option.textContent === "Name A–Z",
  );
  nameOption.dispatchEvent(
    new window.MouseEvent("mousemove", { bubbles: true }),
  );
  assert.equal(
    nameOption.isConnected,
    true,
    "hover does not replace the clicked option",
  );
  nameOption.click();
  assert.equal(sort.value, "name");
  assert.deepEqual(cardNames(window), [
    "Blog outline",
    "Launch email",
    "Support reply",
  ]);
});

test("pasting a prompt gives the library a named, tagged entry", async (t) => {
  const { window } = await createWorkspace([]);
  t.after(() => window.close());
  const doc = window.document;
  await waitFor(() => cardNames(window).length >= 0);

  doc.querySelector('.nav-item[data-view="library"]').click();
  doc.getElementById("pastePromptButton").click();
  const dialog = doc.getElementById("pasteDialog");
  assert.equal(dialog.open, true);
  assert.equal(doc.activeElement, doc.getElementById("pasteText"));

  doc
    .getElementById("pasteForm")
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  assert.equal(
    doc.getElementById("pasteError").textContent,
    "Give your prompt a title.",
  );

  doc.getElementById("pasteName").value = "Trading bot prompt";
  doc.getElementById("pasteText").value = "You are a trading bot.\nBe careful.";
  doc.getElementById("pasteTags").value = "Trading, bots, trading";
  doc
    .getElementById("pasteForm")
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );

  await waitFor(() => cardNames(window).includes("Trading bot prompt"));
  assert.equal(dialog.open, false);
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  assert.equal(saved[0].name, "Trading bot prompt");
  assert.equal(saved[0].data.task, "You are a trading bot.\nBe careful.");
  assert.equal(saved[0].data.raw, true);
  assert.equal(
    window.PromptDockBuildPrompt(saved[0].data),
    "You are a trading bot.\nBe careful.",
  );
  assert.deepEqual(saved[0].tags, ["trading", "bots"]);
  assert.equal(window.document.getElementById("libraryCount").textContent, "1");
  doc.querySelector(".library-card-footer button").click();
  assert.equal(
    doc.getElementById("promptOutput").textContent,
    "You are a trading bot.\nBe careful.",
  );
  const role = doc.getElementById("role");
  role.value = "a trading coach";
  role.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.match(
    doc.getElementById("promptOutput").textContent,
    /Act as a trading coach\.\n\nTask: You are a trading bot\./,
  );
});

test("long builder dropdowns filter as you type", async (t) => {
  const { window } = await createWorkspace([]);
  t.after(() => window.close());
  const doc = window.document;

  const wrapper = doc.querySelector('[data-select="format"]');
  const trigger = wrapper.querySelector(".select-trigger");
  trigger.click();
  assert.equal(wrapper.classList.contains("open"), true);
  const search = wrapper.querySelector(".select-search");
  assert.ok(search, "format list is long enough to search");
  assert.equal(doc.activeElement, search);

  search.value = "table";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  const visible = [...wrapper.querySelectorAll(".select-option")].filter(
    (option) => !option.classList.contains("hidden"),
  );
  assert.deepEqual(
    visible.map((option) => option.dataset.value),
    ["Table"],
  );
  visible[0].click();
  assert.equal(doc.getElementById("format").value, "Table");
  assert.equal(wrapper.classList.contains("open"), false);
  assert.equal(trigger.firstElementChild.textContent, "Table");

  const depth = doc.querySelector('[data-select="depth"]');
  depth.querySelector(".select-trigger").click();
  assert.equal(
    depth.querySelector(".select-search"),
    null,
    "short lists keep a plain menu",
  );
});

test("passwords can be shown and hidden on every form", async (t) => {
  const { window } = await createWorkspace([]);
  t.after(() => window.close());
  const doc = window.document;
  await waitFor(() => cardNames(window).length >= 0);

  const inputs = [...doc.querySelectorAll('input[type="password"]')];
  assert.ok(inputs.length >= 6, "expected every password field to be found");
  for (const input of inputs) {
    const host = input.closest(".password-field");
    assert.ok(host, `${input.id} lost its field wrapper`);
    assert.ok(
      host.querySelector(".password-toggle"),
      `${input.id} has no show/hide button`,
    );
  }

  const password = doc.getElementById("authPassword");
  const toggle = password
    .closest(".password-field")
    .querySelector(".password-toggle");
  password.value = "correct horse battery";
  toggle.click();
  assert.equal(password.type, "text");
  assert.equal(toggle.textContent, "Hide");
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  assert.equal(password.value, "correct horse battery");

  toggle.click();
  assert.equal(password.type, "password");
  assert.equal(toggle.textContent, "Show");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
});

test("creating an account asks for a username and sends it", async (t) => {
  const signedOut = await createWorkspace([]);
  t.after(() => signedOut.window.close());
  const doc = signedOut.window.document;
  await waitFor(() => cardNames(signedOut.window).length >= 0);

  const usernameWrap = doc.getElementById("authUsernameWrap");
  assert.equal(usernameWrap.classList.contains("hidden"), true);

  doc.querySelector('[data-auth-mode="register"]').click();
  assert.equal(doc.getElementById("authDialog").open, true);
  assert.equal(usernameWrap.classList.contains("hidden"), false);
  assert.equal(doc.getElementById("authUsername").required, true);

  doc.getElementById("authEmail").value = "new@example.com";
  doc.getElementById("authUsername").value = "kingjethro";
  doc.getElementById("authPassword").value = "long-enough-password";
  doc.getElementById("authConfirm").value = "long-enough-password";
  doc.getElementById("authForm").dispatchEvent(
    new signedOut.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );
  await waitFor(() =>
    signedOut.requests.some(
      (request) => request.pathname === "/api/auth/register",
    ),
  );
  const register = signedOut.requests.find(
    (request) => request.pathname === "/api/auth/register",
  );
  assert.equal(register.body.username, "kingjethro");

  const signedIn = await createWorkspace([], {
    user: { id: "4e1d", email: "king@example.com", username: "KingJethro" },
  });
  t.after(() => signedIn.window.close());
  await waitFor(
    () =>
      signedIn.window.document.getElementById("settingsUsername").value !== "",
  );
  assert.equal(
    signedIn.window.document.getElementById("settingsUsername").value,
    "KingJethro",
  );
});

test("header favors usernames, while legacy accounts still show email", async (t) => {
  const named = await createWorkspace([], {
    user: { id: "u1", email: "named@example.com", username: "Jethro" },
  });
  const legacy = await createWorkspace([], {
    user: { id: "u2", email: "legacy@example.com", username: null },
  });
  t.after(() => {
    named.window.close();
    legacy.window.close();
  });
  await waitFor(
    () =>
      named.window.document.getElementById("accountButton").textContent ===
      "Jethro",
  );
  await waitFor(
    () =>
      legacy.window.document.getElementById("accountButton").textContent ===
      "legacy@example.com",
  );
});

test("invite link shows earned limits and follows the registration request", async (t) => {
  const account = await createWorkspace([], {
    user: { id: "u1", email: "owner@example.com", username: "Owner" },
  });
  t.after(() => account.window.close());
  const doc = account.window.document;
  doc.getElementById("inviteFriends").click();
  await waitFor(() => doc.getElementById("inviteLink").value !== "");
  assert.equal(doc.getElementById("inviteBonus").textContent, "+2");
  assert.equal(doc.getElementById("inviteVoiceBonus").textContent, "+1");
  assert.match(
    doc.getElementById("invitePending").textContent,
    /waiting to verify/,
  );
  assert.equal(doc.getElementById("inviteDialog").open, true);

  const guest = await createWorkspace([], { inviteCode: "AbCdEf123_-x" });
  t.after(() => guest.window.close());
  guest.window.document.querySelector('[data-auth-mode="register"]').click();
  guest.window.document.getElementById("authEmail").value =
    "friend@example.com";
  guest.window.document.getElementById("authUsername").value = "Friend";
  guest.window.document.getElementById("authPassword").value =
    "long-enough-password";
  guest.window.document.getElementById("authConfirm").value =
    "long-enough-password";
  guest.window.document
    .getElementById("authForm")
    .dispatchEvent(
      new guest.window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await waitFor(() =>
    guest.requests.some((request) => request.pathname === "/api/auth/register"),
  );
  assert.equal(
    guest.requests.find((request) => request.pathname === "/api/auth/register")
      .body.referralCode,
    "AbCdEf123_-x",
  );
});

test("help opens on the current area and guides people to the next action", async (t) => {
  const { window } = await createWorkspace([], {
    user: { id: "u1", email: "owner@example.com", username: "Owner" },
  });
  t.after(() => window.close());
  const doc = window.document;
  doc.querySelector('[data-view="library"]').click();
  doc.getElementById("helpButton").click();
  assert.equal(
    doc.getElementById("helpTabLibrary").getAttribute("aria-selected"),
    "true",
  );
  doc.getElementById("helpTabShare").click();
  assert.equal(doc.getElementById("helpPanelShare").hidden, false);
  doc.getElementById("helpOpenInvite").click();
  await waitFor(() => doc.getElementById("inviteDialog").open);
  assert.equal(doc.getElementById("helpDialog").open, false);
});

test("guest feedback opens from the landing page and shows a saved confirmation", async (t) => {
  const { window, requests } = await createWorkspace([]);
  t.after(() => window.close());
  const doc = window.document;
  doc.querySelector(".landing-footer [data-open-feedback]").click();
  assert.equal(doc.getElementById("feedbackDialog").open, true);
  doc.getElementById("feedbackMessage").value =
    "The save button is hard to find";
  doc.getElementById("feedbackEmail").value = "visitor@example.com";
  doc
    .getElementById("feedbackForm")
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await waitFor(() =>
    doc.getElementById("feedbackResponse").textContent.includes("received"),
  );
  const report = requests.find((item) => item.pathname === "/api/feedback");
  assert.equal(report.method, "POST");
  assert.deepEqual(report.body, {
    kind: "bug",
    message: "The save button is hard to find",
    contactEmail: "visitor@example.com",
  });
});

test("one idea box previews raw text and sends optional guidance with generation", async (t) => {
  const { window, requests } = await createWorkspace([]);
  t.after(() => window.close());
  const doc = window.document;
  const idea = doc.getElementById("ideaInput");
  idea.value = "Build a small browser game";
  idea.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(
    doc.getElementById("promptOutput").textContent,
    "Build a small browser game",
  );
  assert.equal(doc.getElementById("previewHeading").textContent, "Your draft");
  assert.equal(doc.getElementById("saveButton").disabled, false);
  assert.equal(
    doc.querySelectorAll("textarea#task").length,
    0,
    "fine-tune must not have another source box",
  );
  doc.getElementById("toggleComposer").click();
  doc.getElementById("role").value = "Game developer";
  doc
    .getElementById("role")
    .dispatchEvent(new window.Event("input", { bubbles: true }));
  doc.getElementById("audience").value = "New players";
  doc
    .getElementById("audience")
    .dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.match(
    doc.getElementById("promptOutput").textContent,
    /Act as Game developer/,
  );
  doc.getElementById("ideaGenerateButton").click();
  await waitFor(() =>
    doc.getElementById("ideaStatus").textContent.includes("Prompt ready"),
  );
  assert.equal(
    doc.getElementById("previewHeading").textContent,
    "Your finished prompt",
  );
  const sent = requests.find((item) => item.pathname === "/api/idea-to-prompt");
  assert.deepEqual(sent.body, {
    idea: "Build a small browser game",
    guidance: { role: "Game developer", audience: "New players" },
  });
  assert.match(
    doc.getElementById("promptOutput").textContent,
    /Create a useful answer/,
  );
  doc.getElementById("ideaGenerateButton").click();
  await waitFor(
    () =>
      requests.filter((item) => item.pathname === "/api/idea-to-prompt")
        .length === 2,
  );
  const second = requests.filter(
    (item) => item.pathname === "/api/idea-to-prompt",
  )[1];
  assert.deepEqual(second.body.guidance, {
    role: "Game developer",
    audience: "New players",
  });
  await waitFor(() =>
    doc.getElementById("ideaStatus").textContent.includes("Prompt ready"),
  );
  doc.getElementById("role").value = "Technical designer";
  doc
    .getElementById("role")
    .dispatchEvent(new window.Event("input", { bubbles: true }));
  idea.value = "Explain this code";
  idea.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(doc.getElementById("task").value, "");
  assert.equal(doc.getElementById("role").value, "Technical designer");
  assert.equal(doc.getElementById("audience").value, "New players");
  assert.match(
    doc.getElementById("promptOutput").textContent,
    /Explain this code/,
  );
  assert.doesNotMatch(
    doc.getElementById("promptOutput").textContent,
    /Build a small browser game/,
  );
});

test("an idea with collapsed guidance sends no fine-tune details", async (t) => {
  const { window, requests } = await createWorkspace([]);
  t.after(() => window.close());
  const doc = window.document;
  doc.getElementById("ideaInput").value = "Write a launch note";
  doc
    .getElementById("ideaInput")
    .dispatchEvent(new window.Event("input", { bubbles: true }));
  doc.getElementById("ideaGenerateButton").click();
  await waitFor(() =>
    requests.some((item) => item.pathname === "/api/idea-to-prompt"),
  );
  const sent = requests.find((item) => item.pathname === "/api/idea-to-prompt");
  assert.deepEqual(sent.body, { idea: "Write a launch note", guidance: {} });
  await waitFor(() =>
    doc.getElementById("ideaStatus").textContent.includes("Prompt ready"),
  );
  doc.getElementById("ideaGenerateButton").click();
  await waitFor(
    () =>
      requests.filter((item) => item.pathname === "/api/idea-to-prompt")
        .length === 2,
  );
  const again = requests.filter(
    (item) => item.pathname === "/api/idea-to-prompt",
  )[1];
  assert.deepEqual(again.body.guidance, {});
});
