#!/usr/bin/env node
// src/security.js is the single source of truth for HTTP security headers.
// Vercel applies its own copy from vercel.json before the function runs, so
// this script generates that copy instead of editing two files by hand.
const fs = require("node:fs");
const path = require("node:path");
const securityHeaders = require("../src/security");

const target = path.join(__dirname, "..", "vercel.json");
const vercel = JSON.parse(fs.readFileSync(target, "utf8"));
vercel.headers = [
  {
    source: "/(.*)",
    headers: Object.entries(securityHeaders).map(([key, value]) => ({
      key,
      value,
    })),
  },
];
const serialized = `${JSON.stringify(vercel, null, 2)}\n`;
const current = fs.readFileSync(target, "utf8");

if (process.argv.includes("--check")) {
  if (current !== serialized) {
    console.error(
      "vercel.json headers are out of sync with src/security.js. Run: npm run headers:sync",
    );
    process.exit(1);
  }
  console.log("vercel.json headers match src/security.js.");
} else if (current !== serialized) {
  fs.writeFileSync(target, serialized);
  console.log("Updated vercel.json headers from src/security.js.");
}
