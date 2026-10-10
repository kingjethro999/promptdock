import type { Metadata } from "next";
import BootScreen from "@/components/ui/BootScreen";
import TopLoader from "@/components/ui/TopLoader";
import "../styles/shared/styles.css";
import "../styles/shared/landing.css";
import "../styles/shared/auth.css";
import "../styles/shared/share.css";
import "../styles/shared/updates.css";
import "../styles/shared/legal.css";
import "../styles/shared/admin.css";
import "./globals.css";
import "../styles/next/ui.css";
import "../styles/next/builder.css";
import "../styles/next/auth.css";
import "../styles/next/shell.css";
import "../styles/next/landing.css";
import "../styles/next/library.css";
import "../styles/next/settings.css";
import "../styles/next/updates.css";
import "../styles/next/invite.css";
import "../styles/next/admin.css";
import "../styles/next/liquid.css";
import "../styles/next/motion.css";
import "../styles/next/responsive.css";

import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — your prompt workspace`,
    template: `%s — ${SITE_NAME}`,
  },
  description: "Write, organize and share your best prompts.",
  applicationName: "PromptDock",
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "/",
    title: `${SITE_NAME} — your prompt workspace`,
    description: "Write, organize and share your best prompts.",
    images: [
      {
        url: "/api/og/default",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — your prompt workspace`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — your prompt workspace`,
    description: "Write, organize and share your best prompts.",
    images: ["/api/og/default"],
  },
};

import { MotionProvider } from "@/components/motion/env";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="booting">
      <head>
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html:
                "[data-reveal],[data-reveal-item],.reveal-mask__inner{opacity:1!important;transform:none!important;clip-path:none!important}",
            }}
          />
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'setTimeout(function () { if (!document.documentElement.hasAttribute("data-motion")) document.documentElement.classList.add("motion-failsafe"); }, 3500);',
          }}
        />
      </head>
      <body className="booting">
        <MotionProvider>
          <BootScreen />
          <TopLoader />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
