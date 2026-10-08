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
  const previousPathname = useRef(pathname);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);

  const start = () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    setVisible(true);
    fallbackTimer.current = setTimeout(() => setVisible(false), 10000);
  };

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (!visible) return;

    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    finishTimer.current = setTimeout(() => setVisible(false), 180);
  }, [pathname, visible]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (
        anchor instanceof HTMLAnchorElement &&
        isInternalNavigation(anchor, event)
      ) {
        start();
      }
    };

    const handlePopState = () => start();
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      if (finishTimer.current) clearTimeout(finishTimer.current);
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
