import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";

const authTitles: Record<string, string> = {
  login: "Sign in",
  register: "Create your workspace",
  forgot: "Reset your password",
  reset: "Choose a new password",
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
    referrer: "no-referrer",
  };
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; token?: string }>;
}) {
  const { mode, token } = await searchParams;
  if (mode === "verify")
    redirect(
      token && /^[a-f0-9]{64}$/.test(token)
        ? `/auth/verify?token=${token}`
        : "/auth/verify",
    );
  return (
    <Suspense fallback={<p>Loading account…</p>}>
      <AuthForm />
    </Suspense>
  );
}
