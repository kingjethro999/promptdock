import React from "react";
import { OG_THEMES, type OgTheme } from "./themes";

// Satori rules: flexbox only (no CSS grid), every <div> with more than one
// child needs display:flex, no CSS variables, no external stylesheets.

export type CardProps = {
  eyebrow: string; // who or what this is ("Shared by Ada", "@ada")
  title: string;
  body?: string;
  footer?: string; // "promptdock.app/p/ab12" style line
  avatar?: string | null; // data URI
  avatarFallback?: string; // single character
  theme?: OgTheme;
  sticker?: string; // tilted badge line, e.g. "Steal this prompt"
};

export function Card({
  eyebrow,
  title,
  body,
  footer,
  avatar,
  avatarFallback,
  theme = OG_THEMES[0],
  sticker,
}: CardProps) {
  const t = theme;
  const titleSize = title.length > 70 ? 50 : title.length > 40 ? 60 : 72;
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: t.bg,
        ...(t.bgImage ? { backgroundImage: t.bgImage } : {}),
        color: t.fg,
        fontFamily: "Inter",
      }}
    >
      {t.shapes.map((s, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.radius ?? s.size,
            ...(s.rotate ? { transform: `rotate(${s.rotate}deg)` } : {}),
            ...(s.ring
              ? {
                  border: `${Math.max(6, Math.round(s.size / 14))}px solid ${s.color}`,
                }
              : { background: s.color }),
          }}
        />
      ))}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        {/* top row: brand mark and sticker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg
              width="52"
              height="52"
              viewBox="0 0 64 64"
              style={{ display: "flex" }}
            >
              <rect width="64" height="64" rx="18" fill={t.markBg} />
              <path
                d="M16 20h25a9 9 0 0 1 0 18H29v10l-13-10V20Z"
                fill={t.markFg}
              />
              <circle cx="29" cy="29" r="3" fill={t.markBg} />
              <circle cx="40" cy="29" r="3" fill={t.markBg} />
            </svg>
            <div
              style={{
                display: "flex",
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: -0.8,
                color: t.fg,
              }}
            >
              promptdock
            </div>
          </div>
          {sticker ? (
            <div
              style={{
                display: "flex",
                padding: "14px 26px",
                borderRadius: 999,
                background: t.accent,
                color: t.onAccent,
                fontSize: 26,
                fontWeight: 600,
                transform: "rotate(-4deg)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
              }}
            >
              {sticker}
            </div>
          ) : null}
        </div>

        {/* middle: who, title, body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 780,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: t.muted,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: -1.6,
              maxHeight: 240,
              overflow: "hidden",
              color: t.fg,
            }}
          >
            {title}
          </div>
          {body ? (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                lineHeight: 1.4,
                color: t.muted,
                maxHeight: 118,
                overflow: "hidden",
              }}
            >
              {body}
            </div>
          ) : null}
        </div>

        {/* bottom row: avatar and link */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            borderTop: `2px solid ${t.rule}`,
            paddingTop: 26,
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              width={58}
              height={58}
              style={{ borderRadius: 29 }}
              alt=""
            />
          ) : avatarFallback ? (
            <div
              style={{
                display: "flex",
                width: 58,
                height: 58,
                borderRadius: 29,
                background: t.accent,
                color: t.onAccent,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {avatarFallback}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: t.muted,
              fontWeight: 500,
            }}
          >
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
