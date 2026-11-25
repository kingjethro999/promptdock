"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { avatarFallback } from "@/lib/community/username";
import type { PromptGate } from "@/lib/community/queries";

/**
 * Shown instead of a bare 404 when a prompt is for followers: says whose it
 * is and offers the one action that opens it. Signed-out visitors are taken
 * through sign-up and land on the creator's profile with the prompt picked
 * out, having followed on the way.
 */
export default function FollowGate({
  gate,
  signedIn,
}: {
  gate: PromptGate;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fallback = avatarFallback(gate.username);
  const profile = `/${gate.username}?intent=follow&highlight=${gate.publicId}`;

  async function follow() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${gate.username}/follow`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Couldn't follow right now. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <main className="nf-page">
      <Link className="nf-brand" href="/" aria-label="PromptDock home">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="18" fill="#182824" />
          <path d="M16 20h25a9 9 0 0 1 0 18H29v10l-13-10V20Z" fill="#c7f464" />
          <circle cx="29" cy="29" r="3" fill="#182824" />
          <circle cx="40" cy="29" r="3" fill="#182824" />
        </svg>
        <span>
          prompt<em>dock</em>
        </span>
      </Link>
      <section className="nf-card">
        <span className="nf-code">Followers only</span>
        <h1>{gate.title}</h1>
        <Link className="nf-creator" href={`/${gate.username}`}>
          {gate.avatarUrl ? (
            <img src={gate.avatarUrl} alt="" />
          ) : (
            <span data-tone={fallback.tone} aria-hidden="true">
              {fallback.letter}
            </span>
          )}
          <span>
            <strong>{gate.displayName}</strong>
            <small>@{gate.username}</small>
          </span>
        </Link>
        <div className="nf-body">
          <p>
            {gate.displayName} shares this prompt with people who follow them.
            {signedIn
              ? " Follow to read it, copy it and remix it."
              : " Create a free account to follow and open it. You'll land on their profile with this prompt waiting."}
          </p>
        </div>
        <div className="nf-actions">
          {signedIn ? (
            <Button
              variant="primary"
              onClick={follow}
              loading={busy}
              loadingText="Following…"
            >
              Follow @{gate.username} to view
            </Button>
          ) : (
            <>
              <Link
                className="nf-primary"
                href={`/auth?mode=register&next=${encodeURIComponent(profile)}`}
              >
                Create account and follow
              </Link>
              <Link
                className="nf-quiet"
                href={`/auth?mode=login&next=${encodeURIComponent(profile)}`}
              >
                I have an account
              </Link>
            </>
          )}
        </div>
        {error && (
          <p className="nf-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
