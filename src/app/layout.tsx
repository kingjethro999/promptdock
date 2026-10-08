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
import "../styles/next/responsive.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL || "https://thepromptdock.vercel.app",
  ),
  title: {
    default: "PromptDock — Your AI prompt workspace",
    template: "%s — PromptDock",
  },
  description:
    "Turn rough or spoken ideas and image references into structured prompts you can save, reuse, and share with any AI tool.",
  applicationName: "PromptDock",
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "PromptDock",
    locale: "en_US",
    url: "/",
    title: "PromptDock — Your AI prompt workspace",
    description:
      "Turn rough or spoken ideas and image references into structured prompts you can save, reuse, and share with any AI tool.",
    images: [
      {
        url: "/social-card-v2.png",
        width: 1730,
        height: 909,
        alt: "PromptDock — Turn rough ideas into better prompts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PromptDock — Your AI prompt workspace",
    description: "Turn rough ideas into better prompts you can use anywhere.",
    images: [
      {
        url: "/social-card-v2.png",
        alt: "PromptDock turns rough ideas into better prompts",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="booting">
      <body className="booting">
        <BootScreen />
        <TopLoader />
        {children}
      </body>
    </html>
  );
}
