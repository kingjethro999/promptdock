const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { JSDOM } = require("jsdom");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function loadCard(fetchImpl) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/components/community/CommunityPromptCard.tsx"),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    fetch: fetchImpl,
    require(id) {
      if (id === "react") return React;
      if (id === "react/jsx-runtime") return require("react/jsx-runtime");
      if (id === "next/link") {
        return {
          __esModule: true,
          default: ({ href, children, ...props }) =>
            React.createElement("a", { href, ...props }, children),
        };
      }
      if (id === "@/components/ui") {
        const Button = ({ children, leadingIcon: icon, ...props }) =>
          React.createElement(
            "button",
            { type: "button", ...props },
            icon ? React.createElement("span", { "aria-hidden": true }) : null,
            children,
          );
        return {
          Button,
          LinkButton: ({ children, href, leadingIcon: icon, ...props }) =>
            React.createElement(
              "a",
              { href, ...props },
              icon
                ? React.createElement("span", { "aria-hidden": true })
                : null,
              children,
            ),
        };
      }
      if (id === "@/lib/community/username")
        return { avatarFallback: () => ({ letter: "C", tone: 0 }) };
      if (id === "@/lib/community/copy")
        return { copyPromptText: async () => true };
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return exports.default;
}

async function renderCard(fetchImpl) {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "https://promptdock.test/community",
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  const Component = loadCard(fetchImpl);
  const card = {
    publicId: "prompt-123",
    title: "A useful prompt",
    excerpt: "Prompt excerpt",
    tags: [],
    listedAt: "2026-10-21T00:00:00Z",
    creator: {
      username: "creator",
      displayName: "Creator",
      avatarUrl: null,
    },
  };
  await React.act(async () => {
    root.render(React.createElement(Component, { card }));
  });
  return { dom, container, root };
}

async function clickSave(dom, container) {
  const button = container.querySelector(
    'button[aria-label="Save prompt to your library"]',
  );
  assert.ok(button);
  await React.act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
}

test("Community save explains a rejected save and allows retry", async () => {
  const { dom, container, root } = await renderCard(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: "not_found" }),
  }));
  try {
    await clickSave(dom, container);
    assert.match(
      container.querySelector('[role="alert"]').textContent,
      /no longer available/i,
    );
    assert.equal(
      container.querySelector(
        'button[aria-label="Save prompt to your library"]',
      ).textContent,
      "Save",
    );
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});

test("Community save explains a network failure", async () => {
  const { dom, container, root } = await renderCard(async () => {
    throw new Error("offline");
  });
  try {
    await clickSave(dom, container);
    assert.match(
      container.querySelector('[role="alert"]').textContent,
      /connection|try again/i,
    );
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});

test("successful Community save clears errors and announces completion", async () => {
  const { dom, container, root } = await renderCard(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: "saved-456", alreadySaved: false }),
  }));
  try {
    await clickSave(dom, container);
    assert.equal(
      container.querySelector(
        'button[aria-label="Save prompt to your library"]',
      ).textContent,
      "Saved",
    );
    assert.match(
      container.querySelector('[role="status"]').textContent,
      /saved to your library/i,
    );
    assert.equal(container.querySelector('[role="alert"]'), null);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});
