const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const handleRequest = require("../src/server");
const securityHeaders = require("../src/security");
const vercel = require("../vercel.json");

test("Vercel static and local API responses use the same security headers", async () => {
  const configured = Object.fromEntries(
    vercel.headers[0].headers.map(({ key, value }) => [key, value]),
  );
  assert.deepEqual(configured, securityHeaders);
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
