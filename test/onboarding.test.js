const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Registry definition for node test runner
function getRegistry() {
  return [
    {
      id: "welcome-v1",
      type: "welcome",
      priority: 100,
      publishedAt: "2026-10-12T00:00:00Z",
      title: "Welcome to PromptDock",
      summary: "A quick look around your workspace.",
      audience: { createdAfter: "2026-10-12T00:00:00Z" },
      steps: [
        {
          id: "hello",
          kind: "modal",
          title: "Welcome to PromptDock",
          body: "Start with a rough idea. PromptDock turns it into a clear prompt you can use in any AI tool. Here is a quick look around.",
        },
        {
          id: "composer",
          kind: "spotlight",
          target: "composer",
          placement: "bottom",
          title: "Start here",
          body: "Type or dictate a rough thought. PromptDock finds the goal and the priorities for you.",
        },
        {
          id: "library",
          kind: "spotlight",
          target: "nav-library",
          placement: "right",
          title: "Your library",
          body: "Prompts you save live here. They stay private unless you choose to share them.",
        },
        {
          id: "community",
          kind: "spotlight",
          target: "nav-community",
          placement: "right",
          title: "Community",
          body: "Browse prompts other people chose to share. Copy one, save it, or remix it into your own.",
        },
        {
          id: "keys",
          kind: "spotlight",
          target: "nav-settings",
          placement: "right",
          title: "Use your own AI key",
          body: "Add a provider key in Settings to run prompts here. Keys are encrypted and never shown again.",
        },
      ],
    },
    {
      id: "release-2026-10-community",
      type: "release",
      priority: 50,
      publishedAt: "2026-10-12T00:00:00Z",
      title: "Community is here",
      summary:
        "Discover prompts other people share, and follow the people behind them.",
      steps: [
        {
          id: "intro",
          kind: "modal",
          title: "Community is here",
          body: "Discover prompts other people chose to share, save the ones you like, and follow their creators. Nothing of yours is public unless you decide.",
        },
        {
          id: "sidebar",
          kind: "spotlight",
          target: "nav-community",
          placement: "right",
          title: "Find it in the sidebar",
          body: "Search by tag, copy a prompt, or remix it into something of your own.",
        },
        {
          id: "profile",
          kind: "modal",
          title: "You have a public profile",
          body: "Your address is {{username}}. Change it, add a photo or banner, and choose who can see your prompts.",
        },
      ],
    },
  ];
}

function readAllSource(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") {
        results.push(...readAllSource(fullPath));
      }
    } else if (/\.(tsx?|jsx?|html)$/.test(entry.name)) {
      results.push(fs.readFileSync(fullPath, "utf8"));
    }
  }
  return results;
}

test("onboarding registry is valid and adheres to limits", () => {
  const experiences = getRegistry();
  const ids = experiences.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "Experience IDs must be unique");

  const sources = readAllSource(path.join(__dirname, "../src"));
  const targets = new Set(
    sources.flatMap((s) =>
      [...s.matchAll(/data-tour=["'{]+\s*["']?([\w-]+)/g)].map((m) => m[1]),
    ),
  );

  for (const e of experiences) {
    assert.ok(
      e.steps.length <= (e.type === "welcome" ? 5 : 3),
      `Too many steps in ${e.id}`,
    );
    for (const s of e.steps) {
      assert.ok(
        s.title.length <= 48,
        `Title too long in ${e.id}/${s.id}: ${s.title.length} chars`,
      );
      assert.ok(
        s.body.length <= 160,
        `Body too long in ${e.id}/${s.id}: ${s.body.length} chars`,
      );
      if (s.kind === "spotlight") {
        assert.ok(
          targets.has(s.target),
          `${e.id}/${s.id}: missing data-tour="${s.target}" in codebase`,
        );
      }
      assert.equal(
        /\p{Extended_Pictographic}/u.test(s.title + s.body),
        false,
        `No emoji allowed in tour copy: ${s.title}`,
      );
    }
  }
});

test("onboarding eligibility picks welcome for fresh users and release for returning users", () => {
  const experiences = getRegistry();
  const COOLDOWN_MS = 24 * 3600_000;

  function pick(user, rows, now = new Date("2026-10-13T12:00:00Z")) {
    const seen = new Set(rows.map((r) => r.experience_id));
    const userCreated = new Date(user.createdAt);
    const lastShown = rows.reduce(
      (m, r) => Math.max(m, +new Date(r.first_shown_at)),
      0,
    );

    const ok = experiences.filter((e) => {
      if (seen.has(e.id) || new Date(e.publishedAt) > now) return false;
      const a = e.audience;
      if (a?.createdAfter && !(userCreated >= new Date(a.createdAfter)))
        return false;
      if (a?.createdBefore && !(userCreated < new Date(a.createdBefore)))
        return false;
      if (e.type === "release" && !(userCreated < new Date(e.publishedAt)))
        return false;
      return true;
    });

    const welcome = ok.find((e) => e.type === "welcome");
    if (welcome) return welcome;
    if (lastShown && +now - lastShown < COOLDOWN_MS) return null;

    return (
      ok
        .filter((e) => e.type === "release")
        .sort(
          (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
        )[0] ?? null
    );
  }

  const oldUser = { createdAt: "2026-01-01T00:00:00Z" };
  const freshUser = { createdAt: "2026-10-13T00:00:00Z" };

  // Fresh user with no history gets welcome-v1
  const freshPick = pick(freshUser, []);
  assert.equal(freshPick?.id, "welcome-v1");

  // Old user with no history gets release-2026-10-community
  const oldPick = pick(oldUser, []);
  assert.equal(oldPick?.id, "release-2026-10-community");

  // Skipped welcome-v1 means done; fresh user does not get release meant for pre-existing users
  const skippedPick = pick(freshUser, [
    {
      experience_id: "welcome-v1",
      status: "skipped",
      first_shown_at: "2026-10-13T00:05:00Z",
    },
  ]);
  assert.equal(skippedPick, null);

  // Shown release counts as impression and suppresses repeat
  const shownOld = pick(oldUser, [
    {
      experience_id: "release-2026-10-community",
      status: "shown",
      first_shown_at: "2026-10-13T01:00:00Z",
    },
  ]);
  assert.equal(shownOld, null);
});
