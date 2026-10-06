import Link from "next/link";

type Props = { compact?: boolean; className?: string };

export default function BrandMark({ compact = false, className = "" }: Props) {
  return (
    <Link
      className={`brand ${className}`.trim()}
      href={compact ? "/workspace" : "/"}
      aria-label="PromptDock home"
    >
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path d="M5 7h17a6 6 0 0 1 0 12h-8v7L5 19V7Z" fill="currentColor" />
          <circle cx="14" cy="13" r="1.6" fill="#182824" />
          <circle cx="21" cy="13" r="1.6" fill="#182824" />
        </svg>
      </span>
      <span>
        prompt<span className="brand-accent">dock</span>
        {compact && <small>YOUR AI WORKSPACE</small>}
      </span>
    </Link>
  );
}
