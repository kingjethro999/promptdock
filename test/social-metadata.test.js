const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    ...globals,
    require(id) {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      if (id === "@/components/community/AdaptiveShell") {
        return { AdaptiveShell() {} };
      }
      if (id === "react/jsx-runtime") return { jsx() {} };
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return exports;
}

test("community metadata includes a complete large social preview", () => {
  const { metadata } = loadModule("src/app/community/layout.tsx");
  const openGraphImage = metadata.openGraph?.images?.[0];

  assert.equal(metadata.openGraph?.url, "/community");
  assert.equal(openGraphImage?.url, "/api/og/default");
  assert.equal(openGraphImage?.width, 1200);
  assert.equal(openGraphImage?.height, 630);
  assert.equal(metadata.twitter?.card, "summary_large_image");
  assert.equal(metadata.twitter?.images?.[0], openGraphImage.url);
});

test("the Next sitemap includes community and normalizes a trailing origin slash", async () => {
  const route = loadModule(
    "src/app/sitemap.ts",
    { "@/lib/server/public-data": { siteUpdates: async () => [] } },
    { process: { env: { APP_URL: "https://thepromptdock.vercel.app/" } } },
  );
  const urls = (await route.default()).map((entry) => entry.url);

  assert.ok(urls.includes("https://thepromptdock.vercel.app/community"));
  assert.ok(urls.includes("https://thepromptdock.vercel.app/"));
  assert.ok(urls.every((url) => !url.slice("https://".length).includes("//")));
});
