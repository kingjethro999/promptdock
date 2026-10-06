import LegalDocument from "@/components/legal/LegalDocument";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = publicMetadata(
  "Copyright and independence",
  "PromptDock copyright, open source license, and independent brand statement.",
  "/copyright",
);
export default function CopyrightPage() {
  return <LegalDocument page="copyright" />;
}
