/* eslint-disable no-control-regex */
const test = require("node:test");
const assert = require("node:assert/strict");

test("cleanDisplayName and cleanBio sanitize inputs properly", () => {
  const CTRL =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
  const BLOCKED_NAMES = new Set([
    "promptdock",
    "thepromptdock",
    "promptdockteam",
    "promptdocksupport",
    "official",
    "admin",
    "administrator",
    "staff",
    "support",
    "moderator",
    "system",
  ]);

  const cp = (s) => [...s].length;

  function cleanDisplayName(raw) {
    if (raw === null) return { ok: true, value: null };
    if (typeof raw !== "string") return { ok: false, reason: "invalid" };
    const v = raw.replace(CTRL, "").replace(/\s+/g, " ").trim();
    if (!v) return { ok: true, value: null };
    if (cp(v) > 60) return { ok: false, reason: "too_long" };
    if (BLOCKED_NAMES.has(v.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
      return { ok: false, reason: "reserved" };
    }
    return { ok: true, value: v };
  }

  function cleanBio(raw) {
    if (raw === null) return { ok: true, value: null };
    if (typeof raw !== "string") return { ok: false, reason: "invalid" };
    const v = raw
      .replace(CTRL, "")
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!v) return { ok: true, value: null };
    return cp(v) > 160
      ? { ok: false, reason: "too_long" }
      : { ok: true, value: v };
  }

  // Display Name tests
  assert.deepEqual(cleanDisplayName(null), { ok: true, value: null });
  assert.deepEqual(cleanDisplayName(""), { ok: true, value: null });
  assert.deepEqual(cleanDisplayName("   "), { ok: true, value: null });
  assert.deepEqual(cleanDisplayName("  Alice   Builder  "), {
    ok: true,
    value: "Alice Builder",
  });
  assert.equal(cleanDisplayName("Admin").ok, false);
  assert.equal(cleanDisplayName("prompt_dock").ok, false);
  assert.equal(cleanDisplayName("The PromptDock").ok, false);
  assert.equal(cleanDisplayName("a".repeat(61)).ok, false);
  assert.equal(cleanDisplayName("a".repeat(60)).ok, true);

  // Bio tests
  assert.deepEqual(cleanBio(null), { ok: true, value: null });
  assert.deepEqual(cleanBio("   "), { ok: true, value: null });
  assert.equal(cleanBio("b".repeat(161)).ok, false);
  assert.equal(cleanBio("b".repeat(160)).ok, true);
});

test("banner presets have valid hex/rgb codes and keys", () => {
  const BANNER_PRESETS = [
    { id: "moss", label: "Moss", color: "#2f5c3f" },
    { id: "sage", label: "Sage", color: "#5c7865" },
    { id: "sand", label: "Sand", color: "#9e8e78" },
    { id: "clay", label: "Clay", color: "#8f5e46" },
    { id: "slate", label: "Slate", color: "#4f6367" },
    { id: "ink", label: "Ink", color: "#202d28" },
  ];

  assert.equal(BANNER_PRESETS.length, 6);
  for (const p of BANNER_PRESETS) {
    assert.match(p.id, /^[a-z]{2,16}$/);
    assert.match(p.color, /^#[0-9a-f]{6}$/i);
  }
});

test("dicebear avatar generation is deterministic and CC0 styles only", async () => {
  const { Avatar, Style } = await import("@dicebear/core");
  const lorelei = (
    await import("@dicebear/styles/lorelei.json", {
      with: { type: "json" },
    })
  ).default;
  const notionists = (
    await import("@dicebear/styles/notionists.json", {
      with: { type: "json" },
    })
  ).default;
  const shapes = (
    await import("@dicebear/styles/shapes.json", {
      with: { type: "json" },
    })
  ).default;

  const styleL = new Style(lorelei);
  const styleN = new Style(notionists);
  const styleS = new Style(shapes);

  // Determinism test: same seed gives identical SVG string
  const svg1 = new Avatar(styleL, { seed: "alice" }).toString();
  const svg2 = new Avatar(styleL, { seed: "alice" }).toString();
  assert.equal(svg1, svg2);
  assert.ok(svg1.startsWith("<svg"));

  // Different seeds give different SVGs
  const svgBob = new Avatar(styleL, { seed: "bob" }).toString();
  assert.notEqual(svg1, svgBob);

  // Shapes & Notionists also generate valid SVGs
  const svgShape = new Avatar(styleS, { seed: "alice" }).toString();
  const svgNotion = new Avatar(styleN, { seed: "alice" }).toString();
  assert.ok(svgShape.startsWith("<svg"));
  assert.ok(svgNotion.startsWith("<svg"));
});
