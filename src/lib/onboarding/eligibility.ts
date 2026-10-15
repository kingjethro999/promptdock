import type { ClientExperience, Experience } from "./types";
import { EXPERIENCES } from "./registry";

export type ExperienceRow = {
  experience_id: string;
  status: string;
  first_shown_at: Date | string;
};

const COOLDOWN_MS = 24 * 3600_000;

export function pickPending(
  user: { createdAt: Date | string },
  rows: ExperienceRow[],
  now = new Date(),
): Experience | null {
  const seen = new Set(rows.map((r) => r.experience_id));
  const userCreated = new Date(user.createdAt);
  const lastShown = rows.reduce(
    (m, r) => Math.max(m, +new Date(r.first_shown_at)),
    0,
  );

  const ok = EXPERIENCES.filter((e) => {
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
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))[0] ??
    null
  );
}

export function toClient(
  e: Experience,
  user: { username: string },
): ClientExperience {
  const t = (s: string) => s.replaceAll("{{username}}", `@${user.username}`);
  return {
    ...e,
    steps: e.steps.map((s) => ({
      ...s,
      title: t(s.title),
      body: t(s.body),
    })),
  };
}
