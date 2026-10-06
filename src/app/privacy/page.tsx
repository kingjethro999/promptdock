import LegalDocument from "@/components/legal/LegalDocument";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = publicMetadata(
  "Privacy Policy",
  "How PromptDock handles accounts, prompts, AI requests, and shared links.",
  "/privacy",
);
export default function PrivacyPage() {
  return <LegalDocument page="privacy" />;
}
