const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { once } = require("node:events");
const handleRequest = require("../src/server");
const { renderInviteHtml, renderSharedHtml } = handleRequest;
const { siteUrl, build } = require("../scripts/build-frontend");

const source = path.join(__dirname, "..", "src");
const dist = path.join(source, "dist");
const origin = siteUrl();
const indexable = {
  "index.html": "/",
  "privacy.html": "/privacy",
  "terms.html": "/terms",
  "copyright.html": "/copyright",
  "updates.html": "/updates",
};

function read(dir, file) {
  return fs.readFileSync(path.join(dir, file), "utf8");
}

function count(html, pattern) {
  return (html.match(pattern) || []).length;
}

function structuredData(html) {
  const blocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ];
  return blocks.map((match) => JSON.parse(match[1]));
}

test("every indexable page declares one canonical and a full social preview", () => {
  for (const [file, route] of Object.entries(indexable)) {
    const html = read(source, file).split("{{SITE_URL}}").join(origin);
    assert.match(html, /<html lang="en">/, file);
    assert.equal(count(html, /<title>/g), 1, file);
    assert.ok(html.includes('name="description"'), file);
    assert.equal(count(html, /rel="canonical"/g), 1, file);
    assert.ok(
      html.includes(`<link rel="canonical" href="${origin}${route}" />`),
      `${file} canonical`,
    );
    for (const tag of [
      "og:type",
      "og:site_name",
      "og:title",
      "og:description",
      "og:url",
      "og:image",
    ])
      assert.ok(html.includes(`property="${tag}"`), `${file} missing ${tag}`);
    for (const tag of [
      "twitter:card",
      "twitter:title",
      "twitter:description",
      "twitter:image",
    ])
      assert.ok(html.includes(`name="${tag}"`), `${file} missing ${tag}`);
    assert.ok(
      html.includes(
        `content="${origin}/${file === "index.html" ? "social-card-v2.png" : "social-card.png"}"`,
      ),
      `${file} social image`,
    );
    const data = structuredData(html);
    assert.ok(data.length >= 1, `${file} structured data`);
    assert.ok(
      JSON.stringify(data).includes(`${origin}${route}`),
      `${file} structured data url`,
    );
  }
});

test("auth, admin, and the empty shared page stay out of search results", () => {
  for (const file of ["auth.html", "admin.html", "share.html", "404.html"]) {
    const html = read(source, file);
    assert.match(html, /<meta name="robots" content="noindex[^"]*"/, file);
    assert.equal(count(html, /<title>/g), 1, file);
  }
  for (const file of ["auth.html", "admin.html", "share.html", "404.html"])
    assert.doesNotMatch(read(source, file), /rel="canonical"/, file);
  for (const file of ["share.html", "404.html"])
    assert.doesNotMatch(read(source, file), /og:title/, file);
});

test("the build publishes crawl files with every site URL token resolved", () => {
  build();
  const robots = read(dist, "robots.txt");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Disallow: \/admin$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${origin}/sitemap.xml$`, "m"));
  const sitemap = read(dist, "sitemap.xml");
  const llms = read(dist, "llms.txt");
  assert.ok(llms.includes(`Official site: ${origin}/`));
  assert.ok(fs.statSync(path.join(dist, "social-card-v2.png")).size > 100000);
  for (const route of Object.values(indexable))
    assert.ok(
      sitemap.includes(`<loc>${origin}${route}</loc>`),
      `sitemap ${route}`,
    );
  assert.doesNotMatch(sitemap, /\/auth|\/admin/);
  for (const file of [
    ...Object.keys(indexable),
    "auth.html",
    "share.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    "llms.txt",
  ])
    assert.doesNotMatch(read(dist, file), /\{\{[A-Z_]+\}\}/, file);
  assert.match(read(dist, "404.html"), /<meta name="robots" content="noindex"/);
});

test("the server serves crawl files, redirects duplicate .html URLs, and returns an HTML 404", async () => {
  build();
  const server = http.createServer(handleRequest);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const robots = await fetch(`${base}/robots.txt`);
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get("content-type"), /text\/plain/);
    assert.match(await robots.text(), new RegExp(`Sitemap: ${origin}`));
    const sitemap = await fetch(`${base}/sitemap.xml`);
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get("content-type"), /application\/xml/);
    const llms = await fetch(`${base}/llms.txt`);
    assert.equal(llms.status, 200);
    assert.match(llms.headers.get("content-type"), /text\/plain/);
    const social = await fetch(`${base}/social-card-v2.png`);
    assert.equal(social.status, 200);
    assert.match(social.headers.get("content-type"), /image\/png/);

    for (const [from, to] of Object.entries({
      "/index.html": "/",
      "/privacy.html": "/privacy",
      "/terms.html": "/terms",
      "/copyright.html": "/copyright",
      "/auth.html": "/auth",
      "/updates.html": "/updates",
    })) {
      const response = await fetch(`${base}${from}`, { redirect: "manual" });
      assert.equal(response.status, 308, from);
      assert.equal(response.headers.get("location"), to, from);
    }

    const page = await fetch(`${base}/privacy`);
    assert.equal(page.status, 200);
    assert.ok(
      (await page.text()).includes(
        `<link rel="canonical" href="${origin}/privacy" />`,
      ),
    );
    const missing = await fetch(`${base}/definitely-not-a-page`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type"), /text\/html/);
    assert.match(await missing.text(), /Page not found/);
    const api = await fetch(`${base}/api/definitely-not-a-route`);
    assert.equal(api.status, 404);
    assert.match(api.headers.get("content-type"), /application\/json/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("invite and shared pages swap the static SEO block for their own", () => {
  const invite = renderInviteHtml(
    read(source, "index.html"),
    { username: "Jethro", email: "private@example.com" },
    "AbCdEf123_-x",
    `${origin}/invite/AbCdEf123_-x`,
    `${origin}/social-card.png`,
  );
  assert.doesNotMatch(invite, /<!--SEO_START-->|\{\{SITE_URL\}\}/);
  assert.match(invite, /<meta name="robots" content="noindex,follow">/);
  assert.equal(count(invite, /property="og:title"/g), 1);
  assert.equal(count(invite, /rel="canonical"/g), 1);
  assert.ok(
    invite.includes(
      `<link rel="canonical" href="${origin}/invite/AbCdEf123_-x">`,
    ),
  );

  const shared = renderSharedHtml(
    read(source, "share.html"),
    {
      name: "Weekly ideas",
      ownerUsername: "KingJethro",
      data: { task: "Write ideas" },
    },
    `${origin}/p/example`,
    `${origin}/social-card.png`,
  );
  assert.doesNotMatch(shared, /<!--SEO_START-->|\{\{SITE_URL\}\}/);
  assert.doesNotMatch(shared, /noindex/);
  assert.equal(count(shared, /property="og:title"/g), 1);
  assert.equal(count(shared, /rel="canonical"/g), 1);
  assert.ok(
    shared.includes(`<link rel="canonical" href="${origin}/p/example">`),
  );
});
