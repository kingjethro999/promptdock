const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const hookPath = path.join(__dirname, "..", ".githooks", "pre-commit");

function hookWorkspace(t, ciVerify) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "promptdock-hook-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ name: "hook-fixture", version: "0.0.1", scripts: { "ci:verify": ciVerify } }, null, 2)}\n`,
  );
  return dir;
}

function runHook(dir) {
  return spawnSync("sh", [hookPath], { cwd: dir, encoding: "utf8" });
}

test("the pre-commit hook runs the shared CI verification command", () => {
  const hook = fs.readFileSync(hookPath, "utf8");
  assert.ok(hook.startsWith("#!/bin/sh"), "hook must stay a shell script");
  assert.match(hook, /npm run ci:verify/);
  assert.doesNotMatch(hook, /bump-version\.js/);
});

test("the pre-commit hook blocks a commit when a CI check fails", (t) => {
  const dir = hookWorkspace(
    t,
    `node -e "console.error('verification failed'); process.exit(1)"`,
  );
  const result = runHook(dir);
  assert.notEqual(result.status, 0, "failing checks must fail the hook");
  assert.ok(result.stderr.includes("verification failed"));
});

test("the pre-commit hook succeeds when the shared checks pass", (t) => {
  const dir = hookWorkspace(t, `node -e "console.log('verification passed')"`);
  const result = runHook(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("verification passed"));
});
