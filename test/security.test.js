const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const handleRequest = require("../src/server");
const securityHeaders = require("../src/security");
const vercel = require("../vercel.json");

test("deployed pages and API retain security headers while Next has a nonce policy", async () => {
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.headers, undefined);
  assert.equal(vercel.rewrites, undefined);
  const fs = require("node:fs");
  const proxy = fs.readFileSync(
    require("node:path").join(__dirname, "../src/proxy.ts"),
    "utf8",
  );
  assert.match(proxy, /nonce-/);
  assert.match(proxy, /img-src 'self' data: blob:/);
  assert.equal(
    securityHeaders["Strict-Transport-Security"],
    "max-age=31536000; includeSubDomains",
  );
  const server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/auth/me`,
    );
    assert.equal(response.status, 200);
    for (const [name, value] of Object.entries(securityHeaders))
      assert.equal(response.headers.get(name), value);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
