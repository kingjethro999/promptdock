const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Execute the real handlers/component with explicit dependency doubles; no DB
// connections, Next runtime, or repository executable configuration is loaded.
function loadSource(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(
    source.replaceAll("import.meta.url", '"file:///collections-test.ts"'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } },
  );
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    Response,
    URL,
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

const collection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Examples",
  description: "Old description",
  visibility: "private",
  listed: false,
  publicId: null,
};

function loadRoute(file, query) {
  return loadSource(file, {
    "node:crypto": { randomUUID: () => collection.id },
    "node:module": {
      createRequire: () => () => ({ ensureSchema: async () => {}, pool: { query } }),
    },
    "next/cache": { revalidatePath() {} },
    "@/lib/community/viewer": {
      requireViewer: async () => ({ id: collection.id, username: "owner" }),
      assertSameOrigin() {},
    },
    "@/lib/community/ratelimit": { rateLimit: async () => {} },
    "@/lib/community/save": { HttpError: Error },
    "@/lib/community/collections": { errorResponse: (err) => { throw err; } },
  });
}

test("collection creation returns the envelope consumed by both creation UIs", async () => {
  const route = loadRoute("src/app/api/collections/route.ts", async (sql) => {
    if (sql.includes("count(*)")) return { rows: [{ total: 0 }] };
    if (sql.includes("SELECT id")) return { rows: [], rowCount: 0 };
    assert.ok(sql.includes("INSERT INTO collections"));
    return { rows: [collection] };
  });
  const response = await route.POST({ json: async () => ({ name: collection.name }) });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { collection });
});

for (const [label, body, expected] of [
  ["empty description clears the stored value", { description: "" }, null],
  ["omitted description preserves the stored value", {}, collection.description],
]) {
  test(`collection update: ${label}`, async () => {
    const route = loadRoute("src/app/api/collections/[id]/route.ts", async (sql, values) => {
      if (sql.includes("SELECT id")) return { rows: [collection], rowCount: 1 };
      assert.ok(sql.includes("UPDATE collections"));
      assert.equal(values[2], expected);
      return { rows: [{ ...collection, description: values[2] }] };
    });
    const response = await route.PATCH(
      { json: async () => body },
      { params: Promise.resolve({ id: collection.id }) },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      collection: { ...collection, description: expected },
    });
  });
}

test("editing a collection submits an explicitly empty description", async () => {
  const states = [collection.name, "   ", "private", false, false, null];
  let stateIndex = 0;
  let submitted;
  let saved;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useEffect() {},
    useState: () => [states[stateIndex++], () => {}],
  };
  const { default: CollectionDialog } = loadSource(
    "src/components/library/CollectionDialog.tsx",
    {
      react: { ...React, default: React },
      "@/components/ui/Button": { default: "button" },
      "@/components/ui/Icon": { Icon: "span" },
      "@/lib/client/api": {
        json: async (url, method, body) => {
          submitted = { url, method, body: JSON.parse(JSON.stringify(body)) };
          return { collection: { ...collection, description: null } };
        },
      },
    },
  );
  const tree = CollectionDialog({
    open: true, collection, onClose() {}, onSaved: (value) => { saved = value; },
  });
  function findForm(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "form") return node;
    return (node.children || []).map(findForm).find(Boolean);
  }
  await findForm(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(submitted.method, "PATCH");
  assert.equal(submitted.body.description, "");
  assert.equal(saved.id, collection.id);
  assert.equal(saved.description, null);
});
