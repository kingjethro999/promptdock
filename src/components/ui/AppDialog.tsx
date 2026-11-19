"use client";

import { useEffect, useRef, type ReactNode } from "react";

const SHEET_QUERY = "(max-width: 640px)";

export default function AppDialog({
  className = "",
  label,
  close,
  children,
}: {
  className?: string;
  label: string;
  close(): void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);

  // On phones the dialog is a bottom sheet: drag it down from the top edge
  // (or anywhere while its content is scrolled to the top) to dismiss it.
  // The sheet follows the finger 1:1 and settles back if not pulled far.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let tracking = false;
    let dragging = false;

    const scrolledToTop = (target: EventTarget | null) => {
      let node = target as HTMLElement | null;
      while (node && node !== element) {
        if (node.scrollHeight > node.clientHeight && node.scrollTop > 0)
          return false;
        node = node.parentElement;
      }
      return element.scrollTop <= 0;
    };

    const start = (event: TouchEvent) => {
      if (!window.matchMedia(SHEET_QUERY).matches || event.touches.length > 1)
        return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const y = event.touches[0].clientY;
      const fromEdge = y - element.getBoundingClientRect().top < 56;
      tracking = fromEdge || scrolledToTop(target);
      dragging = false;
      startY = lastY = y;
      lastTime = event.timeStamp;
      velocity = 0;
    };

    const move = (event: TouchEvent) => {
      if (!tracking) return;
      const y = event.touches[0].clientY;
      const offset = y - startY;
      if (!dragging) {
        // Upward first: this is a scroll, leave it to the browser.
        if (offset < -4) {
          tracking = false;
          return;
        }
        if (offset < 6) return;
        dragging = true;
        element.classList.add("is-dragging");
        element.classList.remove("is-settling");
      }
      event.preventDefault();
      const dt = Math.max(1, event.timeStamp - lastTime);
      velocity = (y - lastY) / dt;
      lastY = y;
      lastTime = event.timeStamp;
      element.style.transform = `translateY(${Math.max(0, offset)}px)`;
    };

    const end = () => {
      tracking = false;
      if (!dragging) return;
      dragging = false;
      element.classList.remove("is-dragging");
      element.classList.add("is-settling");
      const offset = lastY - startY;
      const dismiss =
        offset > element.offsetHeight * 0.3 || (velocity > 0.6 && offset > 40);
      if (dismiss) {
        element.style.transform = `translateY(${element.offsetHeight}px)`;
        window.setTimeout(() => closeRef.current(), 220);
      } else {
        element.style.transform = "";
      }
    };

    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", end);
    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`app-dialog ${className}`.trim()}
      aria-label={label}
      onClose={close}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      {children}
    </dialog>
  );
}
