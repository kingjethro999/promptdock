"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Registers the service worker and tells people when their connection drops
 * or comes back. AI requests need the network, so being honest about it
 * beats a spinner that never ends.
 */
export default function PwaRuntime() {
  const [state, setState] = useState<"online" | "offline" | "back">("online");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // The site works without it; installs and the offline page just wait.
      });
    }
  }, []);

  useEffect(() => {
    if (!navigator.onLine) setState("offline");
    const offline = () => {
      if (timer.current) clearTimeout(timer.current);
      setState("offline");
    };
    const online = () => {
      setState("back");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("online"), 3200);
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute(
      "data-offline",
      state === "offline",
    );
  }, [state]);

  return (
    <div className="net-status-region" role="status" aria-live="polite">
      {state !== "online" && (
        <div className={`net-status is-${state}`}>
          <Icon
            name={state === "offline" ? "alert" : "check-circle"}
            size={16}
          />
          <span>
            {state === "offline"
              ? "You're offline. You can keep reading and editing; shaping, saving and sharing wait for the connection."
              : "Back online."}
          </span>
        </div>
      )}
    </div>
  );
}
