const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "oldui");
const output = path.join(source, "dist");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function")
  process.loadEnvFile(envPath);

const SITE_TOKEN = "{{SITE_URL}}";
const pages = [
  "index.html",
  "share.html",
  "privacy.html",
  "terms.html",
  "copyright.html",
  "auth.html",
  "updates.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
];
const assets = [
  "share.js",
  "prompt-format.js",
  "diff.js",
  "favicon.svg",
  "social-card.png",
  "social-card-v2.png",
  "auth-page.js",
  "updates-data.js",
  "updates-page.js",
];
const sharedStyles = [
  "styles.css",
  "landing.css",
  "share.css",
  "legal.css",
  "auth.css",
  "updates.css",
];

function siteUrl(env = process.env) {
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  const value =
    env.APP_URL ||
    (vercelHost
      ? `https://${vercelHost}`
      : `http://localhost:${env.PORT || 3000}`);
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("APP_URL must use HTTP or HTTPS.");
  if (env.VERCEL && url.protocol !== "https:")
    throw new Error("APP_URL must use HTTPS in production.");
  return url.origin;
}

function copyPage(file, origin) {
  const page = fs.readFileSync(path.join(source, file), "utf8");
  const resolved = page.split(SITE_TOKEN).join(origin);
  if (/\{\{[A-Z_]+\}\}/.test(resolved))
    throw new Error(`Unknown template token in ${file}.`);
  fs.writeFileSync(path.join(output, file), resolved);
}

function build() {
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(path.join(output, "assets", "brands"), { recursive: true });
  const origin = siteUrl();
  for (const file of pages) copyPage(file, origin);
  for (const file of assets)
    fs.copyFileSync(path.join(source, file), path.join(output, file));
  fs.copyFileSync(path.join(source, "app.js"), path.join(output, "app.js"));
  for (const file of sharedStyles)
    fs.copyFileSync(path.join(source, "styles", file), path.join(output, file));
  for (const file of [
    "openai.png",
    "anthropic.png",
    "gemini.png",
    "github.png",
  ])
    fs.copyFileSync(
      path.join(source, "assets", "brands", file),
      path.join(output, "assets", "brands", file),
    );
  const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  fs.writeFileSync(
    path.join(output, "config.js"),
    `window.PROMPTDOCK_CONFIG = ${JSON.stringify({ version })};\n`,
  );
  console.log(`Built frontend ${version}`);
}

if (require.main === module) build();

module.exports = { SITE_TOKEN, siteUrl, build };
