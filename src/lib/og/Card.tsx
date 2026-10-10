import React from "react";

// Satori rules: flexbox only (no CSS grid), every <div> with more than one child needs display:flex,
// no CSS variables, no external stylesheets. Use literal hex values copied from PromptDock's tokens.
const C = {
  bg: "#0e1814",
  fg: "#f7f8f3",
  muted: "#95aba0",
  accent: "#d5f876",
  rule: "#23382e",
};

export type CardProps = {
  eyebrow: string; // small label above the title ("Invitation", "Shared prompt")
  title: string;
  body?: string;
  footer?: string; // "promptdock.app/p/ab12" style line
  avatar?: string | null; // data URI
  avatarFallback?: string; // single character
};

export function Card({
  eyebrow,
  title,
  body,
  footer,
  avatar,
  avatarFallback,
}: CardProps) {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: C.bg,
        color: C.fg,
        fontFamily: "Inter",
      }}
    >
      {/* top row: brand mark stays in the same place on every variant */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 64 64"
            style={{ display: "flex", borderRadius: 14 }}
          >
            <rect width="64" height="64" rx="18" fill="#182824" />
            <path
              d="M16 20h25a9 9 0 0 1 0 18H29v10l-13-10V20Z"
              fill="#c7f464"
            />
            <circle cx="29" cy="29" r="3" fill="#182824" />
            <circle cx="40" cy="29" r="3" fill="#182824" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: -0.5,
              color: C.fg,
            }}
          >
            prompt<span style={{ color: C.accent }}>dock</span>
          </div>
        </div>
      </div>

      {/* middle: eyebrow, title, body */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 600,
            color: C.accent,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 55 ? 52 : 64,
            fontWeight: 600,
            lineHeight: 1.15,
            maxHeight: 200,
            overflow: "hidden",
            color: C.fg,
          }}
        >
          {title}
        </div>
        {body ? (
          <div
            style={{
              display: "flex",
              fontSize: 30,
              lineHeight: 1.35,
              color: C.muted,
              maxHeight: 120,
              overflow: "hidden",
            }}
          >
            {body}
          </div>
        ) : null}
      </div>

      {/* bottom row: avatar and footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `2px solid ${C.rule}`,
          paddingTop: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {avatar ? (
            <img
              src={avatar}
              width={60}
              height={60}
              style={{ borderRadius: 30 }}
              alt=""
            />
          ) : avatarFallback ? (
            <div
              style={{
                display: "flex",
                width: 60,
                height: 60,
                borderRadius: 30,
                background: C.rule,
                color: C.fg,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {avatarFallback}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: C.muted,
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
