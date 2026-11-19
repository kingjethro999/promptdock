/**
 * Plain, measurable notes on each model's answer in the arena, so people can
 * see what each version gives them without reading all of them in full.
 * Everything here is counted from the text itself; nothing is judged by an AI,
 * and the UI says so.
 */

export type ArenaOutput = {
  provider: string;
  text?: string;
  error?: string;
  success: boolean;
};

export type ArenaInsight = {
  provider: string;
  words: number;
  /** Relative length against the other successful answers. */
  length: "shortest" | "longest" | "middle" | "only";
  structure: string[];
  /** Checks from the prompt this answer appears to address, by keyword. */
  checksMet: number;
  checksTotal: number;
  /** Terms only this answer uses (what it adds that the others do not). */
  distinct: string[];
  notes: string[];
  /** One-line "pick this one if…" summary. */
  pickIf: string;
};

const STOP = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how i if in into is it its " +
    "just may more most must no not of on or our out over should so some such than that the their them then there " +
    "these they this those to too up use used using very was we were what when where which while who why will with " +
    "would you your yes each any all also about only own same both make makes made one two three include includes " +
    "includes answer response output does it is there clear clearly every specific"
  ).split(" "),
);

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) ?? [];
}

function content(text: string): string[] {
  return words(text).filter((word) => !STOP.has(word));
}

function structureOf(text: string): string[] {
  const found: string[] = [];
  const lines = text.split("\n");
  const count = (re: RegExp) => lines.filter((line) => re.test(line)).length;
  const headings = count(/^\s*(#{1,6}\s|\*\*[^*]+\*\*\s*:?\s*$)/);
  const bullets = count(/^\s*[-*•]\s+/);
  const numbered = count(/^\s*\d+[.)]\s+/);
  const tables = count(/^\s*\|.*\|\s*$/);
  const code = (text.match(/```/g) ?? []).length / 2;
  if (headings >= 2) found.push(`${headings} headings`);
  if (numbered >= 2) found.push(`${numbered} numbered steps`);
  if (bullets >= 3) found.push(`${bullets} bullet points`);
  if (tables >= 2) found.push("a table");
  if (code >= 1)
    found.push(code >= 2 ? `${Math.floor(code)} code blocks` : "a code block");
  if (!found.length) found.push("plain paragraphs");
  return found;
}

/** A check counts as met when most of its key terms show up in the answer. */
function meets(check: string, answer: Set<string>): boolean {
  const terms = [...new Set(content(check))];
  if (!terms.length) return false;
  const hit = terms.filter(
    (term) =>
      answer.has(term) ||
      // Loose stem match: "deadlines" meets "deadline", "testing" meets "test".
      [...answer].some(
        (word) =>
          word.length > 4 &&
          term.length > 4 &&
          (word.startsWith(term.slice(0, -1)) ||
            term.startsWith(word.slice(0, -1))),
      ),
  ).length;
  return hit / terms.length >= 0.6;
}

export function arenaInsights(
  outputs: ArenaOutput[],
  checks: string[] = [],
): ArenaInsight[] {
  const ok = outputs.filter((item) => item.success && item.text?.trim());
  const counts = new Map(
    ok.map((item) => [
      item.provider,
      (item.text || "").trim().split(/\s+/).filter(Boolean).length,
    ]),
  );
  const lengths = [...counts.values()];
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const vocab = new Map(
    ok.map((item) => [item.provider, new Set(content(item.text || ""))]),
  );
  const met = new Map(
    ok.map((item) => [
      item.provider,
      checks.filter((check) => meets(check, vocab.get(item.provider)!)).length,
    ]),
  );
  const bestMet = Math.max(0, ...met.values());
  const leaders = [...met.values()].filter((n) => n === bestMet).length;

  return ok.map((item) => {
    const text = item.text || "";
    const others = ok.filter((other) => other.provider !== item.provider);
    const wordsHere = counts.get(item.provider) || 0;
    const length: ArenaInsight["length"] =
      ok.length < 2
        ? "only"
        : wordsHere === max && max !== min
          ? "longest"
          : wordsHere === min && max !== min
            ? "shortest"
            : "middle";

    // Distinct terms: frequent here, absent from every other answer.
    const frequency = new Map<string, number>();
    for (const word of content(text))
      frequency.set(word, (frequency.get(word) || 0) + 1);
    const distinct = [...frequency.entries()]
      .filter(
        ([word]) =>
          word.length > 4 &&
          others.every((other) => !vocab.get(other.provider)?.has(word)),
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([word]) => word);

    const checksMet = met.get(item.provider) || 0;
    const structure = structureOf(text);
    const notes: string[] = [];
    if (length === "longest" && min > 0)
      notes.push(
        `${Math.round(((wordsHere - min) / min) * 100)}% longer than the shortest answer`,
      );
    if (length === "shortest" && max > 0)
      notes.push(
        `${Math.round(((max - wordsHere) / max) * 100)}% shorter than the longest answer`,
      );
    if (checks.length)
      notes.push(`Appears to cover ${checksMet} of ${checks.length} checks`);
    if (distinct.length && others.length)
      notes.push(`Only answer to mention ${distinct.join(", ")}`);

    return {
      provider: item.provider,
      words: wordsHere,
      length,
      structure,
      checksMet,
      checksTotal: checks.length,
      distinct,
      notes,
      pickIf: pickIf(
        length,
        structure,
        bestMet > 0 && checksMet === bestMet && leaders === 1,
      ),
    };
  });
}

function pickIf(
  length: ArenaInsight["length"],
  structure: string[],
  leadsOnChecks: boolean,
): string {
  if (length === "only") return "The only answer that came back.";
  if (leadsOnChecks) return "Pick this if meeting your checks matters most.";
  if (length === "shortest") return "Pick this if you want the quickest read.";
  if (length === "longest") return "Pick this if you want the most detail.";
  if (structure[0] !== "plain paragraphs")
    return `Pick this if you want it organised (${structure[0]}).`;
  return "A middle ground between the others.";
}
