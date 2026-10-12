import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const EMOJI = /\p{Emoji_Presentation}|\uFE0F/u;
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? ["node_modules", ".next"].includes(e.name)
          ? []
          : walk(path.join(d, e.name))
        : /\.(tsx?|jsx?|css|md)$/.test(e.name)
          ? [path.join(d, e.name)]
          : [],
    );

test("no emoji in product source", () => {
  const hits = walk("src").flatMap((f) =>
    fs
      .readFileSync(f, "utf8")
      .split("\n")
      .map((line, i) =>
        EMOJI.test(line) ? `${f}:${i + 1}: ${line.trim()}` : null,
      )
      .filter(Boolean),
  );
  assert.deepEqual(hits, []);
});
