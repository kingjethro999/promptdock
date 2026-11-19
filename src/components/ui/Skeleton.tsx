/**
 * Placeholder shapes shown while content loads. They take the size of what
 * will replace them, so the page does not jump when the data arrives.
 */
export function SkeletonBlock({
  width = "100%",
  height = 14,
  radius = 8,
  className = "",
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`skeleton pd-skel ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** A card-shaped placeholder: title, two lines, a footer row. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="pd-skel-card" aria-hidden="true">
      <SkeletonBlock width="38%" height={12} />
      <SkeletonBlock width="72%" height={18} />
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBlock
          key={index}
          width={index === lines - 1 ? "58%" : "92%"}
        />
      ))}
      <div className="pd-skel-row">
        <SkeletonBlock width={80} height={12} />
        <SkeletonBlock width={64} height={26} radius={999} />
      </div>
    </div>
  );
}

/** A grid of card placeholders with a live label for screen readers. */
export function SkeletonGrid({
  count = 6,
  label,
  className = "",
}: {
  count?: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={`pd-skel-grid ${className}`.trim()} role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} lines={index % 3 === 0 ? 3 : 2} />
      ))}
    </div>
  );
}

/** Page-level placeholder: heading, intro line, then a grid of cards. */
export function SkeletonPage({
  label,
  cards = 6,
  className = "",
}: {
  label: string;
  cards?: number;
  className?: string;
}) {
  return (
    <div className={`pd-skel-page ${className}`.trim()}>
      <div className="pd-skel-intro" aria-hidden="true">
        <SkeletonBlock width="min(420px, 70%)" height={34} radius={10} />
        <SkeletonBlock width="min(560px, 90%)" height={14} />
      </div>
      <SkeletonGrid count={cards} label={label} />
    </div>
  );
}
