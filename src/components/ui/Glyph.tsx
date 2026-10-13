import React from "react";

export type GlyphName = "spark" | "star" | "arrow-up-right" | "arrow-right" | "check" | "command" | "gear" | "pencil" | "grid";

export interface GlyphProps extends React.SVGProps<SVGSVGElement> {
  name?: GlyphName;
  glyph?: string;
  size?: number;
  className?: string;
}

/**
 * Brand glyph renderer with pixel-accurate SVG geometry.
 *
 * User Invariant: Glyphs are not emojis. On devices such as iOS and Android,
 * Unicode text glyphs like ✳ (U+2733) or ↗ (U+2197) are often hijacked by system
 * emoji fonts into colored cartoon images. The Glyph component guarantees a sharp,
 * monochromatic rendering matching currentColor with identical visual weight.
 */
export function Glyph({
  name,
  glyph,
  size = 14,
  className = "",
  ...rest
}: GlyphProps) {
  // Map raw Unicode characters to their canonical vector shape if provided
  let resolvedName = name;
  if (!resolvedName && glyph) {
    switch (glyph.trim()) {
      case "✳":
        resolvedName = "spark";
        break;
      case "✦":
        resolvedName = "star";
        break;
      case "↗":
        resolvedName = "arrow-up-right";
        break;
      case "→":
        resolvedName = "arrow-right";
        break;
      case "✓":
        resolvedName = "check";
        break;
      case "⌘":
        resolvedName = "command";
        break;
      case "⚙":
        resolvedName = "gear";
        break;
      case "✎":
        resolvedName = "pencil";
        break;
      case "▦":
      case "▤":
        resolvedName = "grid";
        break;
      default:
        resolvedName = "spark";
    }
  }

  resolvedName = resolvedName || "spark";

  switch (resolvedName) {
    case "spark":
      // Eight-spoke asterisk matching the PromptDock brand mark
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          {...rest}
        >
          <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" />
        </svg>
      );

    case "star":
      // Four-point star
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="currentColor"
          {...rest}
        >
          <path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" />
        </svg>
      );

    case "arrow-up-right":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...rest}
        >
          <path d="M7 17L17 7M7 7h10v10" />
        </svg>
      );

    case "arrow-right":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...rest}
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      );

    case "check":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...rest}
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );

    case "command":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...rest}
        >
          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
        </svg>
      );

    case "gear":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...rest}
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );

    case "pencil":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...rest}
        >
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      );

    case "grid":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={`ui-glyph ${className}`.trim()}
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...rest}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      );

    default:
      return null;
  }
}
