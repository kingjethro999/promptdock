import LegalDocument from "@/components/legal/LegalDocument";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = publicMetadata(
  "Terms of Use",
  "Terms for using the PromptDock open source prompt workspace.",
  "/terms",
);
export default function TermsPage() {
  return <LegalDocument page="terms" />;
}
