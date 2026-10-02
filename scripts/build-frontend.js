const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "src");
const output = path.join(source, "dist");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(output, "assets", "brands"), { recursive: true });
for (const file of [
  "index.html",
  "share.html",
  "privacy.html",
  "terms.html",
  "copyright.html",
  "auth.html",
  "app.js",
  "share.js",
  "prompt-format.js",
  "diff.js",
  "styles.css",
  "landing.css",
  "share.css",
  "legal.css",
  "favicon.svg",
  "social-card.png",
])
  fs.copyFileSync(path.join(source, file), path.join(output, file));
for (const file of ["openai.png", "anthropic.png", "gemini.png", "github.png"])
  fs.copyFileSync(
    path.join(source, "assets", "brands", file),
    path.join(output, "assets", "brands", file),
  );
fs.copyFileSync(path.join(source, "auth.css"), path.join(output, "auth.css"));
fs.copyFileSync(
  path.join(source, "auth-page.js"),
  path.join(output, "auth-page.js"),
);
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
fs.writeFileSync(
  path.join(output, "config.js"),
  `window.PROMPTDOCK_CONFIG = ${JSON.stringify({ version })};\n`,
);
console.log(`Built frontend ${version}`);
