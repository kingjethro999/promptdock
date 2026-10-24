const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { JSDOM } = require("jsdom");
const { createClientLoader } = require("./helpers/load-client-module.cjs");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderPreview(initial = {}) {
  const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // React checks browser input-event support when react-dom is first loaded.
  const { createRoot } = require("react-dom/client");
  const requests = [];
  const copies = [];
  const load = createClientLoader({
    document: dom.window.document,
    navigator: { clipboard: { writeText: async (text) => copies.push(text) } },
    fetch: (_url, options) =>
      new Promise((resolve, reject) =>
        requests.push({
          body: JSON.parse(options.body),
          reject,
          resolve: (body) =>
            resolve({
              ok: true,
              headers: new Headers({ "content-type": "application/json" }),
              json: async () => body,
            }),
        }),
      ),
  });
  const Preview = load("src/components/builder/PromptPreview.tsx").default;
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  let props = {
    prompt: "Current prompt",
    ready: true,
    documentRevision: 1,
    provider: "test",
    ...initial,
  };
  async function render(update = {}) {
    props = { ...props, ...update };
    await React.act(async () =>
      root.render(React.createElement(Preview, props)),
    );
  }
  async function click(text) {
    const button = [...container.querySelectorAll("button")].find((b) =>
      b.textContent.trim().includes(text),
    );
    assert.ok(button, `Missing button: ${text}`);
    await React.act(async () =>
      button.dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }),
      ),
    );
  }
  await render();
  return {
    container,
    requests,
    copies,
    render,
    click,
    async close() {
      await React.act(async () => root.unmount());
      dom.window.close();
      delete globalThis.window;
      delete globalThis.document;
    },
  };
}

test("preview respects readiness even when source-like data is present", async () => {
  const f = await renderPreview({
    prompt: "",
    ready: false,
    data: { task: "Unsubmitted source", raw: true },
  });
  try {
    assert.doesNotMatch(f.container.textContent, /Unsubmitted source/);
    assert.match(f.container.querySelector("h2").textContent, /will appear/i);
    assert.equal(
      [...f.container.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Copy prompt"),
      ).disabled,
      true,
    );
  } finally {
    await f.close();
  }
});

test("source-preserved fallback never claims to be a finished AI prompt", async () => {
  const f = await renderPreview({ provider: "source-preserved" });
  try {
    assert.doesNotMatch(
      f.container.querySelector("h2").textContent,
      /finished|refined/i,
    );
    assert.match(f.container.textContent, /not AI.refined|not verified/i);
  } finally {
    await f.close();
  }
});

for (const action of ["Run", "Compare"]) {
  test(`${action} discards a late response after switching document identity with identical text`, async () => {
    const f = await renderPreview();
    try {
      await f.click(action);
      assert.equal(f.requests.length, 1);
      await f.render({ documentRevision: 2 });
      await React.act(async () =>
        f.requests[0].resolve(
          action === "Run"
            ? { text: "Old account output", provider: "Old model" }
            : {
                results: [
                  {
                    provider: "Old model",
                    text: "Old account output",
                    success: true,
                  },
                ],
              },
        ),
      );
      assert.doesNotMatch(
        f.container.textContent,
        /Old account output|Old model/,
      );
      await f.click(action);
      assert.equal(f.requests.length, 2);
    } finally {
      await f.close();
    }
  });
}

test("changing the exported text clears completed Run output and stale error messages", async () => {
  const f = await renderPreview();
  try {
    await f.click("Run");
    await React.act(async () =>
      f.requests[0].resolve({ text: "Old result", provider: "Test model" }),
    );
    assert.match(f.container.textContent, /Old result/);
    await f.render({ prompt: "Changed prompt" });
    assert.doesNotMatch(f.container.textContent, /Old result|Tested with/);
    await f.click("Run");
    await f.render({ prompt: "Third prompt" });
    await React.act(async () =>
      f.requests[1].reject(new Error("Old request failed")),
    );
    assert.doesNotMatch(f.container.textContent, /Old request failed/);
  } finally {
    await f.close();
  }
});

test("switching export profile invalidates an in-flight Run", async () => {
  const f = await renderPreview({
    data: { task: "Write a report", tone: "Friendly" },
  });
  try {
    await f.click("Run");
    assert.equal(
      f.requests[0].body.prompt,
      "Task: Write a report\n\nTone: Friendly",
    );
    await f.click("Claude (XML)");
    await React.act(async () =>
      f.requests[0].resolve({ text: "Old syntax result", provider: "Model" }),
    );
    assert.doesNotMatch(f.container.textContent, /Old syntax result/);
    await f.click("Run");
    assert.match(f.requests[1].body.prompt, /<task>/);
  } finally {
    await f.close();
  }
});

test("direct document editor is labeled and starts with canonical text, not a platform wrapper", async () => {
  const f = await renderPreview({ prompt: "Canonical document", onEdit() {} });
  try {
    await f.click("Edit prompt");
    const editor = f.container.querySelector(
      'textarea[aria-label="Edit current prompt"]',
    );
    assert.ok(editor);
    assert.equal(editor.value, "Canonical document");
  } finally {
    await f.close();
  }
});
