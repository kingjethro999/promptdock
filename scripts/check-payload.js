#!/usr/bin/env node
/*
 * Refuses commits that look like the November 2026 repository injection:
 * obfuscated JavaScript hidden after long runs of whitespace, a root-level
 * `init` loader, package.json scripts that run it, editor tasks that execute
 * on folder open, and a .gitignore that stops ignoring .env.
 *
 * Runs in the pre-commit hook and in `npm run ci:verify`. It only reads files.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const problems = [];

function trackedFiles() {
  try {
    // Staged + tracked, so a file added in this commit is checked too.
    const out = execFileSync("git", ["ls-files", "-z", "--cached"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\0").filter(Boolean);
  } catch {
    return walk(root);
  }
}

function walk(dir, base = "") {
  const skip = new Set([".git", "node_modules", ".next", "oldui", "public"]);
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const rel = path.join(base, entry.name);
    if (entry.isDirectory())
      files.push(...walk(path.join(dir, entry.name), rel));
    else files.push(rel);
  }
  return files;
}

const CODE =
  /\.(c|m)?(j|t)sx?$|\.json$|\.css$|\.html$|\.ya?ml$|\.sh$|\.bat$|\.cmd$/i;
const IGNORE =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|model-benchmark\.json)$/;
const OBFUSCATED = /\b_0x[0-9a-f]{4,}\b/i;
const HIDDEN_TAIL = /[ \t]{80,}\S/; // code pushed off-screen by whitespace
const MAX_LINE = 5000;

const files = trackedFiles();

for (const rel of files) {
  if (rel === "init" || /^init\.(c|m)?js$/.test(rel))
    problems.push(`${rel}: root-level loader file is not allowed`);
  if (/(^|\/)config\.bat$/i.test(rel))
    problems.push(`${rel}: unexpected batch file`);
  if (!CODE.test(rel) || IGNORE.test(rel)) continue;
  const full = path.join(root, rel);
  let text;
  try {
    text = fs.readFileSync(full, "utf8");
  } catch {
    continue; // deleted in this commit
  }
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    const where = `${rel}:${index + 1}`;
    if (line.length > MAX_LINE)
      problems.push(`${where}: line is ${line.length} characters long`);
    if (HIDDEN_TAIL.test(line))
      problems.push(`${where}: code hidden after a long run of whitespace`);
    if (OBFUSCATED.test(line) && rel !== "scripts/check-payload.js")
      problems.push(`${where}: obfuscated _0x identifier`);
  });
  if (/(^|\/)\.vscode\/tasks\.json$/.test(rel) && /folderOpen/.test(text))
    problems.push(`${rel}: task runs automatically when the folder opens`);
}

try {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  for (const [name, script] of Object.entries(pkg.scripts || {})) {
    if (/\bnode\s+(\.\/)?init\b/.test(script))
      problems.push(`package.json scripts.${name}: runs the root init loader`);
  }
  for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
    const script = pkg.scripts?.[hook];
    if (script && !/^git config core\.hooksPath/.test(script))
      problems.push(
        `package.json scripts.${hook}: install-time script needs review (${script})`,
      );
  }
} catch (error) {
  problems.push(`package.json: could not be read (${error.message})`);
}

try {
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  if (!/^\.env$/m.test(ignore))
    problems.push(".gitignore: `.env` is no longer ignored");
} catch {
  problems.push(".gitignore: missing");
}

if (problems.length) {
  console.error(
    "\nPayload check failed. This commit looks like an injection:\n",
  );
  for (const problem of problems.slice(0, 40)) console.error(`  - ${problem}`);
  if (problems.length > 40)
    console.error(`  …and ${problems.length - 40} more`);
  console.error(
    "\nIf you did not make these changes, do not commit. See CONTRIBUTING.md.\n",
  );
  process.exit(1);
}
console.log(`Payload check passed (${files.length} files).`);
