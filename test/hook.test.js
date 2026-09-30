const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const hookPath = path.join(__dirname, "..", ".githooks", "pre-commit");

function hookWorkspace(t, { eslint }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "promptdock-hook-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ name: "hook-fixture", version: "0.0.1", scripts: { lint: "eslint ." } }, null, 2)}\n`,
  );
  if (eslint !== null) {
    const bin = path.join(dir, "node_modules", ".bin");
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, "eslint"), `#!/bin/sh\n${eslint}\n`, {
      mode: 0o755,
    });
  }
  return dir;
}

function runHook(dir) {
  return spawnSync("sh", [hookPath], { cwd: dir, encoding: "utf8" });
}

test("the pre-commit hook lints before bumping the version", () => {
  const hook = fs.readFileSync(hookPath, "utf8");
  const lintAt = hook.indexOf("npm run lint");
  const bumpAt = hook.indexOf("scripts/bump-version.js");
  assert.ok(lintAt > -1, "hook must run lint");
  assert.ok(bumpAt > lintAt, "lint must run before the version bump");
  assert.ok(hook.startsWith("#!/bin/sh"), "hook must stay a shell script");
});

test("the pre-commit hook blocks a commit that fails lint", (t) => {
  const dir = hookWorkspace(t, { eslint: "echo 'lint failed' >&2\nexit 1" });
  const result = runHook(dir);
  assert.notEqual(result.status, 0, "failing lint must fail the hook");
  assert.ok(!result.stdout.includes("Version bumped"));
  assert.equal(fs.existsSync(path.join(dir, "VERSION")), false);
});

test("the pre-commit hook warns and continues without eslint", (t) => {
  const dir = hookWorkspace(t, { eslint: null });
  const result = runHook(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stderr.includes("eslint is not installed"));
});
