const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const script = fs.readFileSync(
  path.join(__dirname, "..", "src", "updates-page.js"),
  "utf8",
);
const update = {
  id: "release-one",
  version: "v0.7.4",
  date: "Today",
  title: "A new release",
  summary: "Something changed.",
  body: "The full update.",
};

async function render(canMarkRead) {
  const dom = new JSDOM(
    '<title>Updates</title><section id="updatesList"></section>',
    {
      url: "https://promptdock.test/updates",
      runScripts: "outside-only",
    },
  );
  dom.window.PROMPTDOCK_UPDATES = [update];
  dom.window.fetch = async () => ({
    ok: true,
    async json() {
      return { updates: [update], readIds: [], canMarkRead };
    },
  });
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return dom;
}

test("guests can read public updates without an account-only read button", async () => {
  const dom = await render(false);
  try {
    const document = dom.window.document;
    assert.match(
      document.querySelector("#updatesList").textContent,
      /A new release/,
    );
    assert.equal(document.querySelector("[data-read]"), null);
    assert.ok(document.querySelector('a[href="/updates/release-one"]'));
  } finally {
    dom.window.close();
  }
});

test("signed-in readers can mark a public update as read", async () => {
  const dom = await render(true);
  try {
    assert.equal(dom.window.document.querySelectorAll("[data-read]").length, 1);
  } finally {
    dom.window.close();
  }
});
