const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { once } = require("node:events");
const handleRequest = require("../src/server");
const vercel = require("../vercel.json");

test("legal pages and their stylesheet are public on local and Vercel routes", async () => {
  execFileSync(process.execPath, [
    path.join(__dirname, "../scripts/build-frontend.js"),
  ]);
  const server = http.createServer(handleRequest);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const name of ["privacy", "terms", "copyright"]) {
      const page = await fetch(`${base}/${name}`);
      assert.equal(page.status, 200, name);
      assert.match(page.headers.get("content-type"), /text\/html/);
      const html = await page.text();
      assert.match(html, /King Jethro/);
      assert.match(html, new RegExp(`href="/${name}" aria-current="page"`));
      assert.ok(
        vercel.rewrites.some(
          (rewrite) =>
            rewrite.source === `/${name}` &&
            rewrite.destination === `/${name}.html`,
        ),
      );
    }
    const stylesheet = await fetch(`${base}/legal.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /text\/css/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
