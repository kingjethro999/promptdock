(function attachPromptDockDiff(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PromptDockDiff = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAX_CELL_OPS = 250000;
  const DEFAULT_MAX_LINES = 400;

  function splitLines(value) {
    const text = value === undefined || value === null ? "" : String(value);
    return text === "" ? [] : text.split("\n");
  }

  function diffLines(before, after) {
    const a = splitLines(before);
    const b = splitLines(after);
    if (a.length && b.length && a.length * b.length > MAX_CELL_OPS)
      return [
        ...a.map((text) => ({ type: "del", text })),
        ...b.map((text) => ({ type: "add", text })),
      ];
    const table = Array.from(
      { length: a.length + 1 },
      () => new Int32Array(b.length + 1),
    );
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        table[i][j] =
          a[i] === b[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1]);
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        ops.push({ type: "same", text: a[i] });
        i++;
        j++;
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        ops.push({ type: "del", text: a[i] });
        i++;
      } else {
        ops.push({ type: "add", text: b[j] });
        j++;
      }
    }
    while (i < a.length) ops.push({ type: "del", text: a[i++] });
    while (j < b.length) ops.push({ type: "add", text: b[j++] });
    return ops;
  }

  function compact(ops, maxLines = DEFAULT_MAX_LINES) {
    if (ops.length <= maxLines) return { ops, truncated: false };
    const withoutContext = ops.filter((op) => op.type !== "same");
    const kept = withoutContext.slice(0, maxLines);
    return { ops: kept, truncated: kept.length < withoutContext.length };
  }

  function titleCase(key) {
    const label = String(key).replace(/[_-]+/g, " ").trim();
    return label ? label[0].toUpperCase() + label.slice(1) : label;
  }

  function text(value) {
    return value === undefined || value === null ? "" : String(value);
  }

  function diffPrompt(current, revision) {
    const changes = [];
    const now = current || {};
    const past = revision || {};
    const addText = (label, before, after) => {
      if (text(before) === text(after)) return;
      changes.push({ label, type: "text", ops: diffLines(before, after) });
    };
    addText("Name", now.name, past.name);
    addText("Idea", now.idea, past.idea);
    addText("Analysis", now.analysis, past.analysis);
    const nowData = now.data || {};
    const pastData = past.data || {};
    const keys = new Set([...Object.keys(nowData), ...Object.keys(pastData)]);
    for (const key of [...keys].sort())
      addText(titleCase(key), nowData[key], pastData[key]);
    const nowTags = Array.isArray(now.tags) ? now.tags : [];
    const pastTags = Array.isArray(past.tags) ? past.tags : [];
    const added = pastTags.filter((tag) => !nowTags.includes(tag));
    const removed = nowTags.filter((tag) => !pastTags.includes(tag));
    if (added.length || removed.length)
      changes.push({ label: "Tags", type: "tags", added, removed });
    return changes;
  }

  return { diffLines, diffPrompt, compact, titleCase };
});
