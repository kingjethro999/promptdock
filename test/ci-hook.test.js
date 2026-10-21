const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const workflow = fs.readFileSync(
  path.join(root, ".github/workflows/ci.yml"),
  "utf8",
);
const hook = fs.readFileSync(path.join(root, ".githooks/pre-commit"), "utf8");

test("pre-commit and GitHub Actions share the complete CI verification command", () => {
  const verification = packageJson.scripts["ci:verify"];
  assert.ok(verification, "package.json must define ci:verify");

  const checks = [
    "npm run lint",
    "npm run format:check",
    "npm run headers:check",
    "npm test",
    "npm run typecheck",
    "npm run build:frontend",
    "npm run build",
  ];
  assert.deepEqual(verification.split(" && "), checks);

  assert.match(workflow, /npm run ci:verify/);
  assert.match(hook, /npm run ci:verify/);
  assert.doesNotMatch(hook, /bump-version\.js/);
});
