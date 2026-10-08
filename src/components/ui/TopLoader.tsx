"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function isInternalNavigation(anchor: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return false;
  }

  try {
    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin) return false;
    return (
      destination.pathname !== window.location.pathname ||
      destination.search !== window.location.search
    );
  } catch {
    return false;
  }
}

export default function TopLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;

    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishTimer.current = setTimeout(() => setVisible(false), 180);

    return () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
  }, [pathname, visible]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (isInternalNavigation(anchor, event)) setVisible(true);
    };

    const handlePopState = () => setVisible(true);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <div
      className="top-loader"
      data-visible={visible ? "true" : "false"}
      aria-hidden="true"
    >
      <span />
    </div>
  );
}
