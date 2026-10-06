import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
};

export default function ActionLink({
  href,
  children,
  className = "",
  external = false,
}: Props) {
  const classes = `action-link ${className}`.trim();
  if (external)
    return (
      <a
        className={classes}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  return (
    <Link className={classes} href={href}>
      {children}
    </Link>
  );
}
