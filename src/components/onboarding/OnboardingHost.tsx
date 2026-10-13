"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ClientExperience } from "@/lib/onboarding/types";
import { Tour } from "./Tour";

async function isQuiet(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible") return false;

  // Check for any active modals, popovers, or busy states
  if (
    document.querySelector(
      '[role="dialog"][aria-modal="true"], [data-ui-layer], [aria-busy="true"], .updates-popover, .app-dialog',
    )
  ) {
    return false;
  }

  // Check URL parameters for explicit intent
  if (typeof location !== "undefined") {
    const q = new URLSearchParams(location.search);
    if (q.has("remix") || q.has("intent")) return false;
  }

  return true;
}

export function OnboardingHost({
  pending,
}: {
  pending: ClientExperience | null;
}) {
  const [active, setActive] = useState<ClientExperience | null>(null);
  const started = useRef(false);
  const pathname = usePathname();
  const id = pending?.id ?? null;

  useEffect(() => {
    if (!pending || started.current) return;
    if (pending.routes && !pending.routes.some((r) => pathname.startsWith(r))) {
      return;
    }

    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const attempt = async () => {
      if (started.current) return;
      if (await isQuiet()) {
        started.current = true;
        setActive(pending);
        return;
      }
      if (++tries < 3) {
        timer = setTimeout(attempt, 2000);
      }
    };

    timer = setTimeout(attempt, 1200);
    return () => clearTimeout(timer);
  }, [id, pathname, pending]);

  if (!active) return null;

  return <Tour exp={active} onClose={() => setActive(null)} />;
}

export default OnboardingHost;
