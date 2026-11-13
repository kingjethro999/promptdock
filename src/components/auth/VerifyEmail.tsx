"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError, json } from "@/lib/client/api";
import { Button, LinkButton, TextField } from "@/components/ui";
import AuthShell from "./AuthShell";
import { useResendVerification } from "./useResendVerification";

type State =
  "checking" | "verified" | "used" | "expired" | "invalid" | "failed";

const copy: Record<State, { title: string; lead: string }> = {
  checking: {
    title: "Verifying your email",
    lead: "One moment while we check your link.",
  },
  verified: {
    title: "Email verified",
    lead: "You are signed in. Opening your workspace…",
  },
  used: {
    title: "Already verified",
    lead: "This link has already been used. Your email is verified, so you can sign in.",
  },
  expired: {
    title: "This link has expired",
    lead: "Verification links last 24 hours. Send yourself a new one and it will work straight away.",
  },
  invalid: {
    title: "This link is not valid",
    lead: "It may be incomplete or replaced by a newer email. Enter your email address to get a fresh link.",
  },
  failed: {
    title: "We could not verify your email",
    lead: "Something went wrong on our side. Your link has not been used, so you can try again.",
  },
};

/**
 * Verifies an emailed link. The token is submitted by this page with a POST,
 * never spent by the GET that loads it, so mail scanners that prefetch links
 * cannot use it up. It is removed from the address bar before the request.
 */
export default function VerifyEmail() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const [state, setState] = useState<State>("checking");
  const [detail, setDetail] = useState("");
  const [email, setEmail] = useState("");
  const resend = useResendVerification();

  async function verify() {
    if (!token.current) return setState("invalid");
    setState("checking");
    setDetail("");
    try {
      await json("/api/auth/verify", "POST", { token: token.current });
      setState("verified");
      setTimeout(() => {
        router.replace("/workspace");
        router.refresh();
      }, 1400);
    } catch (issue) {
      const code = issue instanceof ApiError ? issue.code : undefined;
      if (code === "token_used") setState("used");
      else if (code === "token_expired") setState("expired");
      else if (code === "token_invalid") setState("invalid");
      else {
        setState("failed");
        setDetail(
          issue instanceof ApiError && issue.status === 429
            ? "Too many attempts. Wait a few minutes, then try again."
            : "",
        );
      }
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    token.current = params.get("token");
    if (token.current)
      window.history.replaceState(null, "", window.location.pathname);
    void verify();
    // Runs once: the token is read from the URL a single time, then removed.
  }, []);

  const { title, lead } = copy[state];
  return (
    <AuthShell title={title} lead={lead}>
      <p
        className={
          state === "verified" || state === "used"
            ? "auth-success"
            : "auth-error"
        }
        role="status"
        aria-live="polite"
      >
        {state === "checking" ? "Checking your link…" : detail}
      </p>
      {state === "invalid" && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (email.trim()) void resend.resend({ email: email.trim() });
          }}
        >
          <div className="auth-form-field">
            <TextField
              id="verifyEmail"
              label="Email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="auth-page-actions">
            <LinkButton variant="secondary" href="/auth?mode=login">
              Sign in
            </LinkButton>
            <Button
              variant="primary"
              type="submit"
              disabled={resend.sending || resend.wait > 0 || !email.trim()}
            >
              {resend.label}
            </Button>
          </div>
        </form>
      )}
      {state === "expired" && (
        <div className="auth-page-actions">
          <LinkButton variant="secondary" href="/auth?mode=login">
            Sign in
          </LinkButton>
          <Button
            variant="primary"
            disabled={resend.sending || resend.wait > 0}
            onClick={() =>
              token.current && resend.resend({ token: token.current })
            }
          >
            {resend.label}
          </Button>
        </div>
      )}
      {state === "failed" && (
        <div className="auth-page-actions">
          <LinkButton variant="secondary" href="/auth?mode=login">
            Sign in
          </LinkButton>
          <Button variant="primary" onClick={() => void verify()}>
            Try again
          </Button>
        </div>
      )}
      {state === "used" && (
        <LinkButton variant="primary" href="/auth?mode=login&verified=1">
          Sign in
        </LinkButton>
      )}
      {state === "verified" && (
        <LinkButton variant="primary" href="/workspace">
          Open workspace
        </LinkButton>
      )}
      {resend.message && (
        <p
          className={resend.failed ? "auth-error" : "auth-success"}
          role="status"
        >
          {resend.message}
        </p>
      )}
    </AuthShell>
  );
}
