const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { renderSharedHtml } = require("../oldui/server");

test("shared prompt HTML has crawlable metadata and escapes prompt text", () => {
  const template = fs.readFileSync(
    path.join(__dirname, "../oldui/share.html"),
    "utf8",
  );
  const html = renderSharedHtml(
    template,
    {
      name: "<script>alert(1)</script> & game",
      data: { task: 'Build "a game" & test it' },
    },
    "https://thepromptdock.vercel.app/p/example",
    "https://thepromptdock.vercel.app/social-card.png",
  );
  assert.match(
    html,
    /<meta property="og:title" content="&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; game — PromptDock">/,
  );
  assert.match(
    html,
    /<meta property="og:description" content="Build &quot;a game&quot; &amp; test it">/,
  );
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/thepromptdock\.vercel\.app\/social-card\.png">/,
  );
  assert.match(
    html,
    /<meta name="twitter:card" content="summary_large_image">/,
  );
  assert.ok(!html.includes("<script>alert(1)</script>"));
});

test("shared links say who shared them", () => {
  const template = fs.readFileSync(
    path.join(__dirname, "../oldui/share.html"),
    "utf8",
  );
  const html = renderSharedHtml(
    template,
    {
      name: "Weekly content ideas",
      ownerUsername: "KingJethro",
      data: { task: "Write five weekly content ideas" },
    },
    "https://thepromptdock.vercel.app/p/example",
    "https://thepromptdock.vercel.app/social-card.png",
  );
  assert.match(
    html,
    /<title>KingJethro wants to share a prompt with you<\/title>/,
  );
  assert.match(
    html,
    /<meta property="og:title" content="KingJethro wants to share a prompt with you">/,
  );
  assert.ok(html.includes("KingJethro shared a prompt with you."));
  assert.ok(!html.includes("<!--SHARED_INTRO-->"));

  const escaped = renderSharedHtml(
    template,
    {
      name: "Weekly content ideas",
      ownerUsername: "<script>alert(1)</script>",
      data: { task: "Write five weekly content ideas" },
    },
    "https://thepromptdock.vercel.app/p/example",
    "https://thepromptdock.vercel.app/social-card.png",
  );
  assert.ok(!escaped.includes("<script>alert(1)</script>"));
  assert.ok(escaped.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
});
