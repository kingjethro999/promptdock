const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { once } = require("node:events");
const { JSDOM } = require("jsdom");
const handleRequest = require("../src/server");
const { renderFeedXml } = require("../src/feed");
const updates = require("../src/updates");
const database = require("../src/database");
const vercel = require("../vercel.json");

const source = path.join(__dirname, "..", "src");
const unitOrigin = "https://feed.test";
const siteOrigin = process.env.APP_URL
  ? new URL(process.env.APP_URL).origin
  : "http://feed.test";

function parse(xml) {
  return new JSDOM(xml, { contentType: "application/xml" }).window.document;
}

async function withServer(stubs, run) {
  const originals = [];
  for (const [target, name, replacement] of stubs) {
    originals.push([target, name, target[name]]);
    target[name] = replacement;
  }
  const server = http.createServer(handleRequest);
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [target, name, original] of originals) target[name] = original;
  }
}

test("the feed is valid RSS with one item per update", () => {
  const now = new Date("2026-10-03T09:30:00Z");
  const doc = parse(renderFeedXml(updates, unitOrigin, now));
  const channel = doc.querySelector("channel");
  assert.equal(
    channel.querySelector("title").textContent,
    "PromptDock updates",
  );
  assert.equal(
    channel.querySelector("link").textContent,
    `${unitOrigin}/updates`,
  );
  assert.equal(
    channel.querySelector("description").textContent,
    "Release notes and product updates from PromptDock.",
  );
  assert.equal(
    channel.querySelector("lastBuildDate").textContent,
    now.toUTCString(),
  );
  assert.equal(
    channel.querySelector('[rel="self"]').getAttribute("href"),
    `${unitOrigin}/feed.xml`,
  );

  const items = [...doc.querySelectorAll("item")];
  assert.equal(items.length, updates.length);
  for (const [index, update] of updates.entries()) {
    const item = items[index];
    assert.equal(item.querySelector("title").textContent, update.title);
    assert.equal(
      item.querySelector("link").textContent,
      `${unitOrigin}/updates`,
    );
    assert.equal(
      item.querySelector("guid").textContent,
      `${unitOrigin}/updates#${update.id}`,
    );
    assert.equal(
      item.querySelector("guid").getAttribute("isPermaLink"),
      "false",
    );
    assert.equal(
      item.querySelector("description").textContent,
      `${update.summary}\n\n${update.body}`,
    );
    const pubDate = item.querySelector("pubDate");
    if (update.date === "Coming soon") {
      assert.equal(pubDate, null, update.title);
    } else {
      assert.equal(
        pubDate.textContent,
        new Date(Date.parse(update.date)).toUTCString(),
        update.title,
      );
    }
  }
  const guids = items.map((item) => item.querySelector("guid").textContent);
  assert.equal(new Set(guids).size, guids.length);
});

test("hostile text survives XML escaping byte for byte", () => {
  const item = {
    id: "odd & <release>",
    version: 'v1 <beta> & "more"',
    date: "Not a date at all",
    title: 'Script <script>alert("x")</script> & friends',
    summary: "It's 5 > 4 and 3 < 4",
    body: "Two lines\nwith 'quotes' & <tags>",
  };
  const doc = parse(
    renderFeedXml([item], unitOrigin, new Date("2026-10-03T00:00:00Z")),
  );
  const entry = doc.querySelector("item");
  assert.equal(entry.querySelector("title").textContent, item.title);
  assert.equal(
    entry.querySelector("description").textContent,
    `${item.summary}\n\n${item.body}`,
  );
  assert.equal(
    entry.querySelector("guid").textContent,
    `${unitOrigin}/updates#${item.id}`,
  );
  assert.equal(entry.querySelector("pubDate"), null);
});

test("the server serves the merged feed on both hosting paths", async () => {
  const stubs = [
    [database, "configured", true],
    [
      database,
      "listPublishedUpdates",
      async () => [
        {
          id: "fresh-release",
          version: "v9.9.9",
          date: "Today",
          title: "Fresh from the press",
          summary: "Published through the admin.",
          body: "Body from the database.",
          publishedAt: new Date("2026-10-01T12:00:00Z"),
        },
      ],
    ],
  ];
  await withServer(stubs, async (base) => {
    for (const route of ["/feed.xml", "/api/index?feed=1"]) {
      const response = await fetch(`${base}${route}`);
      assert.equal(response.status, 200, route);
      assert.match(
        response.headers.get("content-type"),
        /application\/rss\+xml/,
        route,
      );
      assert.match(
        response.headers.get("cache-control"),
        /public, max-age=300/,
      );
      const doc = parse(await response.text());
      const guids = [...doc.querySelectorAll("guid")].map(
        (guid) => guid.textContent,
      );
      assert.equal(guids.length, updates.length + 1, route);
      assert.ok(guids[0].endsWith("#fresh-release"), route);
      assert.equal(
        doc.querySelectorAll("item")[1].querySelector("title").textContent,
        updates[0].title,
        route,
      );
      assert.equal(
        doc.querySelector("item > pubDate").textContent,
        "Thu, 01 Oct 2026 12:00:00 GMT",
        route,
      );
      assert.equal(
        doc.querySelector('[rel="self"]').getAttribute("href"),
        `${siteOrigin}/feed.xml`,
        route,
      );
    }
  });
});

test("the feed still publishes static updates when the database is down", async () => {
  const stubs = [
    [database, "configured", true],
    [
      database,
      "listPublishedUpdates",
      async () => {
        throw new Error("database unavailable");
      },
    ],
  ];
  await withServer(stubs, async (base) => {
    const response = await fetch(`${base}/feed.xml`);
    assert.equal(response.status, 200);
    const doc = parse(await response.text());
    assert.equal(doc.querySelectorAll("item").length, updates.length);
  });
});

test("vercel routes the feed to the function and pages advertise it", () => {
  const rewrite = vercel.rewrites.find((entry) => entry.source === "/feed.xml");
  assert.equal(rewrite && rewrite.destination, "/api/index?feed=1");
  for (const file of ["index.html", "updates.html"]) {
    const html = fs.readFileSync(path.join(source, file), "utf8");
    assert.ok(html.includes('rel="alternate"'), file);
    assert.ok(html.includes('type="application/rss+xml"'), file);
    assert.ok(html.includes('href="{{SITE_URL}}/feed.xml"'), file);
  }
});
