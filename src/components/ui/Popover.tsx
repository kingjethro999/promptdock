"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/components/motion/env";
import { usePopupPosition } from "./usePopupPosition";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  label: string;
  id?: string;
  align?: "start" | "end" | "match";
  children: React.ReactNode;
}

export function Popover({
  open,
  onClose,
  anchorRef,
  label,
  id,
  align = "end",
  children,
}: PopoverProps) {
  const compact = useMediaQuery("(max-width: 760px)");
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const pos = usePopupPosition(open && !compact, anchorRef, {
    align,
    width: 360,
    gap: 12,
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;

    const inside = (n: Node | null) =>
      !!n &&
      (panel.current?.contains(n) ||
        anchorRef.current?.contains(n) ||
        Boolean((n as Element).closest?.("[data-ui-layer]")));

    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };

    const down = (e: PointerEvent) => {
      if (!inside(e.target as Node)) {
        closeRef.current();
      }
    };

    const out = (e: FocusEvent) => {
      if (e.relatedTarget && !inside(e.relatedTarget as Node)) {
        closeRef.current();
      }
    };

    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", down, true);
    panel.current?.addEventListener("focusout", out);

    requestAnimationFrame(() => {
      panel.current
        ?.querySelector<HTMLElement>("input,button,[tabindex]")
        ?.focus({ preventScroll: true });
    });

    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", down, true);
      panel.current?.removeEventListener("focusout", out);
      opener?.focus?.({ preventScroll: true });
    };
  }, [open, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panel}
      id={id}
      role="dialog"
      aria-label={label}
      aria-modal="false"
      data-ui-layer="true"
      className="ui-popover"
      data-side={pos?.side ?? "bottom"}
      data-compact={compact || undefined}
      style={
        compact
          ? undefined
          : {
              left: pos?.left,
              top: pos?.top,
              bottom: pos?.bottom,
              maxHeight: pos?.maxH,
            }
      }
    >
      {children}
    </div>,
    document.body,
  );
}
