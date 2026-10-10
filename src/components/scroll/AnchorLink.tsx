"use client";

import type { ComponentProps } from "react";
import { useScrollApi } from "./ScrollProvider";

export function AnchorLink({
  href = "",
  onClick,
  children,
  ...rest
}: ComponentProps<"a">) {
  const { lenis, scrollTo } = useScrollApi();
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented || !lenis || !href.startsWith("#")) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const el = document.getElementById(href.slice(1));
        if (!el) return;
        e.preventDefault();
        scrollTo(el);
        history.pushState(null, "", href);
      }}
    >
      {children}
    </a>
  );
}
