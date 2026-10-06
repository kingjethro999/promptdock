import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

const authTitles: Record<string, string> = {
  login: "Sign in",
  register: "Create your workspace",
  forgot: "Reset your password",
  reset: "Choose a new password",
  verify: "Verifying your email",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}): Promise<Metadata> {
  const { mode = "login" } = await searchParams;
  return {
    title: authTitles[mode] || authTitles.login,
    description: "Sign in or create your PromptDock workspace.",
    alternates: { canonical: "/auth" },
    robots: { index: false, follow: true },
  };
}

export default function AuthPage() {
  return (
    <Suspense fallback={<p>Loading account…</p>}>
      <AuthForm />
    </Suspense>
  );
}
