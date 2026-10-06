const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(
  path.join(__dirname, "../oldui/styles/styles.css"),
  "utf8",
);

function ruleBody(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing ${selector} rule`);
  const open = css.indexOf("{", start);
  const end = css.indexOf("}", open);
  return css.slice(open + 1, end);
}

test("the sidebar scrolls to its version line instead of clipping", () => {
  const sidebar = ruleBody(".sidebar");
  assert.match(sidebar, /height:\s*100dvh/);
  assert.match(sidebar, /overflow-y:\s*auto/);
  assert.match(sidebar, /overscroll-behavior:\s*contain/);
  assert.match(css, /\.sidebar\s*>\s*\*\s*{\s*flex:\s*none;/);
});

test("an open mobile sidebar locks the page behind it", () => {
  const start = css.indexOf("@media (max-width: 760px)");
  assert.notEqual(start, -1);
  const media = css.slice(start, css.indexOf("@media (max-width: 520px)"));
  assert.match(media, /body\.nav-open\s*{\s*overflow:\s*hidden;/);
  assert.match(ruleBody(".library-intro"), /flex-wrap:\s*wrap/);
});
