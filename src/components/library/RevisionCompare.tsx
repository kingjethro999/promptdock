import type { SavedPrompt } from "@/lib/prompt/types";
import type { Revision } from "@/hooks/useLibrary";

type DiffOp = { type: "same" | "add" | "del"; text: string };
type TextChange = { label: string; type: "text"; ops: DiffOp[] };
type TagChange = {
  label: string;
  type: "tags";
  added: string[];
  removed: string[];
};
const diff = require("../../diff") as {
  diffPrompt(
    current: SavedPrompt,
    revision: Revision,
  ): (TextChange | TagChange)[];
  compact(ops: DiffOp[]): { ops: DiffOp[]; truncated: boolean };
};

export default function RevisionCompare({
  current,
  previous,
}: {
  current: SavedPrompt;
  previous: Revision;
}) {
  const changes = diff.diffPrompt(current, previous);
  if (!changes.length)
    return (
      <div className="history-diff">
        <p className="history-diff-empty">Identical to your current version.</p>
      </div>
    );

  return (
    <div className="history-diff">
      <p className="history-diff-legend">
        Restoring this version changes these parts:{" "}
        <span className="is-del">− lost</span> goes away,{" "}
        <span className="is-add">+ restored</span> comes back.
      </p>
      {changes.map((change) => (
        <div className="history-diff-field" key={change.label}>
          <div className="history-diff-label">{change.label}</div>
          {change.type === "tags" ? (
            <>
              {change.added.map((tag) => (
                <div className="history-diff-line is-add" key={`add-${tag}`}>
                  + {tag}
                </div>
              ))}
              {change.removed.map((tag) => (
                <div className="history-diff-line is-del" key={`del-${tag}`}>
                  − {tag}
                </div>
              ))}
            </>
          ) : (
            <TextDiff ops={change.ops} />
          )}
        </div>
      ))}
    </div>
  );
}

function TextDiff({ ops }: { ops: DiffOp[] }) {
  const compacted = diff.compact(ops);
  return (
    <>
      {compacted.ops.map((op, index) => (
        <div className={`history-diff-line is-${op.type}`} key={index}>
          {op.type === "del" ? "− " : op.type === "add" ? "+ " : "  "}
          {op.text}
        </div>
      ))}
      {compacted.truncated && (
        <div className="history-diff-truncated">
          … long difference shortened
        </div>
      )}
    </>
  );
}
