"use client";

import { useEffect, useRef, useState } from "react";
import { readFlag, SUPPORT_LINKS, writeFlag } from "@/lib/client/support";
import WorkspacePopover from "./WorkspacePopover";

const DISMISSED_KEY = "promptdock.support.dismissed";

/**
 * A slim accent bar across the top of the workspace that opens the ways to
 * fund PromptDock. It opens on hover, keyboard focus, or tap, and stays gone
 * once dismissed (the same links remain under Help in the sidebar).
 */
export default function SupportStrip() {
  // null until the remembered choice is read, so the bar never flashes for
  // someone who already dismissed it.
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where along the strip the popover points: the hover or tap position, or
  // the middle when opened from the keyboard.
  const [place, setPlace] = useState<{
    left: number;
    width: number;
    caret: number;
  } | null>(null);

  function aimAt(clientX: number | null) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const gutter = 12;
    const width = Math.min(360, box.width - gutter * 2);
    const x = clientX === null ? box.width / 2 : clientX - box.left;
    const left = Math.min(
      Math.max(x - width / 2, gutter),
      box.width - width - gutter,
    );
    // The caret is 12px wide; keep it clear of the rounded corners.
    const caret = Math.min(Math.max(x - left - 6, 16), width - 28);
    setPlace({ left, width, caret });
  }

  useEffect(() => setDismissed(readFlag(DISMISSED_KEY)), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(
    () => () => {
      if (closing.current) clearTimeout(closing.current);
    },
    [],
  );

  if (dismissed !== false) return null;

  const show = (clientX: number | null = null) => {
    if (closing.current) clearTimeout(closing.current);
    aimAt(clientX);
    setOpen(true);
  };
  // The pointer crosses a small gap between the bar and the panel.
  const hideSoon = () => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = setTimeout(() => setOpen(false), 250);
  };

  return (
    <div
      ref={wrap}
      className="support-strip-wrap"
      onMouseLeave={hideSoon}
      onBlur={(event) => {
        if (!wrap.current?.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="support-strip"
        aria-label="Support PromptDock"
        aria-haspopup="dialog"
        aria-expanded={open}
        // A keyboard "click" has no position (detail 0): aim at the middle.
        onClick={(event) => show(event.detail === 0 ? null : event.clientX)}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") show(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" && open) aimAt(event.clientX);
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) show();
        }}
      />
      {open && (
        <WorkspacePopover
          label="Support PromptDock"
          className="support-popover"
          style={
            place
              ? ({
                  left: place.left,
                  width: place.width,
                  "--updates-pointer-left": `${place.caret}px`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <p>Enjoying PromptDock? Help keep it free and improving.</p>
          <div className="support-popover-links">
            {SUPPORT_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
          <button
            type="button"
            className="support-popover-dismiss"
            onClick={() => {
              writeFlag(DISMISSED_KEY, true);
              setDismissed(true);
            }}
          >
            Don’t show this again
          </button>
        </WorkspacePopover>
      )}
    </div>
  );
}
