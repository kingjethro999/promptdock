const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { nextVersion } = require("../scripts/bump-version");

test("version milestones follow the project convention", () => {
  assert.equal(nextVersion("0.0.1"), "0.0.2");
  assert.equal(nextVersion("0.0.9"), "0.1.0");
  assert.equal(nextVersion("0.1.0"), "0.1.1");
  assert.equal(nextVersion("0.1.8"), "0.1.9");
  assert.equal(nextVersion("0.1.9"), "0.2.0");
  assert.equal(nextVersion("0.598.9"), "0.599.0");
  assert.equal(nextVersion("0.599.0"), "0.599.1");
  assert.equal(nextVersion("0.599.8"), "0.599.9");
  assert.equal(nextVersion("0.599.9"), "1.0.0");
  assert.equal(nextVersion("1.0.0"), "1.0.1");
  assert.throws(() => nextVersion("0.600.0"), /outside pre-1.0 range/);
});

test("README and package.json agree on the Node floor", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
  );
  const readme = fs.readFileSync(
    path.join(__dirname, "..", "README.md"),
    "utf8",
  );
  const engines = /^>=?(\d+)\.(\d+)/.exec(pkg.engines.node);
  assert.ok(engines, `unexpected engines field: ${pkg.engines.node}`);
  const documented = /Requires Node\.js (\d+)\.(\d+)\+/.exec(readme);
  assert.ok(documented, "README must document a Node.js floor");
  assert.equal(
    `${documented[1]}.${documented[2]}`,
    `${engines[1]}.${engines[2]}`,
    "README and engines must describe the same Node version",
  );
});
