import type { PromptData } from "@/lib/prompt/types";

export default function PromptCheck({ data }: { data?: PromptData | null }) {
  const checks = [
    Boolean(data?.task),
    Boolean(data?.role || data?.audience),
    Boolean(data?.context),
    Boolean(data?.format || data?.tone),
    Boolean(data?.constraints || data?.focus),
  ];
  const score = checks.filter(Boolean).length;
  const [title, tip] = !data?.task
    ? ["A good start", "Add an idea or prompt to get started."]
    : !data.context
      ? [
          "Add some context",
          "A little background helps AI make a more useful answer.",
        ]
      : !data.format && !data.tone
        ? [
            "Shape the result",
            "Choose a format or tone to make the answer easier to use.",
          ]
        : !data.constraints && !data.focus
          ? [
              "Almost there",
              "Add priorities or must-have details for a more focused result.",
            ]
          : [
              "Looking strong",
              "Your prompt gives AI a clear direction to follow.",
            ];
  return (
    <section className="quality-card" aria-label="Prompt check">
      <div className="quality-header">
        <div>
          <div className="section-kicker">PROMPT CHECK</div>
          <h3>{title}</h3>
        </div>
        <div className="quality-score">
          <strong>{score}</strong>
          <span>/5</span>
        </div>
      </div>
      <div className="score-bars" aria-hidden="true">
        {checks.map((filled, index) => (
          <i className={filled ? "filled" : ""} key={index} />
        ))}
      </div>
      <p>{tip}</p>
    </section>
  );
}
