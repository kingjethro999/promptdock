import type { PromptInterpretation } from "@/lib/prompt/types";

export default function InterpretationCard({
  interpretation,
}: {
  interpretation: PromptInterpretation;
}) {
  return (
    <section className="quality-card">
      <div className="section-kicker">HOW PROMPTDOCK READ YOUR IDEA</div>
      <h3>{interpretation.goal}</h3>
      <ul>
        {interpretation.focusAreas?.map((area) => (
          <li key={area}>{area}</li>
        ))}
      </ul>
    </section>
  );
}
