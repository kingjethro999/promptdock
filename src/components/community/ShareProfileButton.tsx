"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Shares a profile link: the system share sheet where there is one (phones,
 * some desktops), otherwise copies the link and says so.
 */
export default function ShareProfileButton({
  username,
  displayName,
  variant = "secondary",
  iconOnly = false,
}: {
  username: string;
  displayName?: string;
  variant?: "secondary" | "quiet";
  iconOnly?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function share() {
    const url = `${window.location.origin}/${username}`;
    const name = displayName || `@${username}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `${name} on PromptDock`,
          text: `${name} invited you to follow them on PromptDock`,
          url,
        });
        return;
      }
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }

  const label =
    state === "copied"
      ? "Link copied"
      : state === "failed"
        ? "Copy the address bar"
        : "Share";
  return (
    <>
      <Button
        variant={variant}
        leadingIcon={state === "copied" ? "check" : "share"}
        onClick={share}
        aria-label={iconOnly ? "Share profile link" : undefined}
        title="Share profile link"
        className="profile-share"
      >
        {iconOnly ? null : label}
      </Button>
      <span className="sr-only" role="status">
        {state === "copied"
          ? "Profile link copied to clipboard"
          : state === "failed"
            ? "Could not copy the link"
            : ""}
      </span>
    </>
  );
}
