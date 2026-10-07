#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const vercel = JSON.parse(
  fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
);
assert.equal(vercel.framework, "nextjs");
assert.equal(
  vercel.outputDirectory,
  ".next",
  "Vercel must use the Next.js output instead of the old src/dist dashboard setting",
);
for (const key of [
  "buildCommand",
  "rewrites",
  "routes",
  "headers",
  "functions",
])
  assert.ok(!(key in vercel), `Legacy Vercel setting remains: ${key}`);

const proxy = fs.readFileSync(path.join(root, "src/proxy.ts"), "utf8");
for (const header of [
  "Content-Security-Policy",
  "Referrer-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Permissions-Policy",
  "Strict-Transport-Security",
])
  assert.ok(proxy.includes(header), `Next proxy is missing ${header}`);
assert.ok(proxy.includes("nonce-"), "Next pages need a nonce-based CSP");
assert.ok(
  proxy.includes("'unsafe-eval'"),
  "React development needs its CSP exception",
);
for (const route of [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/api/[...path]/route.ts",
  "src/app/sitemap.ts",
  "src/app/robots.ts",
  "src/app/feed.xml/route.ts",
])
  assert.ok(
    fs.existsSync(path.join(root, route)),
    `Missing App Router file: ${route}`,
  );
console.log("Next.js deployment config and security headers are present.");
