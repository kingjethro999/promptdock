import { Suspense } from "react";
import type { Metadata } from "next";
import VerifyEmail from "@/components/auth/VerifyEmail";

// The link in the URL is a credential until it is used: keep it out of the
// Referer header (proxy.ts sends the matching response header) and out of
// search indexes.
export const metadata: Metadata = {
  title: "Verify your email",
  description: "Confirm your email address to open your PromptDock workspace.",
  alternates: { canonical: "/auth/verify" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p>Checking your link…</p>}>
      <VerifyEmail />
    </Suspense>
  );
}
