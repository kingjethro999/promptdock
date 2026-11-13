"use client";

import { useEffect, useState } from "react";
import { ApiError, json } from "@/lib/client/api";

const COOLDOWN_SECONDS = 60;

/**
 * Requests a fresh verification email, by address or by the expired link's
 * token. The server answers the same way whether or not an account matched,
 * and limits requests itself; the countdown here only keeps the button honest.
 */
export function useResendVerification() {
  const [wait, setWait] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend(target: { email: string } | { token: string }) {
    if (sending || wait > 0) return;
    setSending(true);
    setMessage("");
    setFailed(false);
    try {
      await json("/api/auth/resend", "POST", target);
      setMessage(
        "If that account still needs verifying, a new link is on its way. Check your inbox and spam folder.",
      );
      setWait(COOLDOWN_SECONDS);
    } catch (issue) {
      setFailed(true);
      setMessage(
        issue instanceof ApiError && issue.status === 429
          ? "Too many requests. Wait a few minutes, then try again."
          : issue instanceof Error
            ? issue.message
            : "Could not send the email. Try again shortly.",
      );
    } finally {
      setSending(false);
    }
  }

  return {
    resend,
    sending,
    wait,
    message,
    failed,
    label: sending
      ? "Sending…"
      : wait > 0
        ? `Resend available in ${wait}s`
        : "Resend verification email",
  };
}
