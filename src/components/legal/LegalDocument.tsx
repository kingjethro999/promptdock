import Link from "next/link";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Page = "privacy" | "terms" | "copyright";

export default async function LegalDocument({ page }: { page: Page }) {
  const html = await readFile(
    join(process.cwd(), "src", `${page}.html`),
    "utf8",
  );
  const main = html.match(/<main class="legal-main">([\s\S]*?)<\/main>/)?.[1];
  if (!main) throw new Error(`Missing ${page} legal content.`);
  return (
    <div className="legal-page-body">
      <header className="legal-header">
        <Link className="legal-brand" href="/">
          <span aria-hidden="true">✳</span> prompt<em>dock</em>
        </Link>
        <nav aria-label="Legal pages">
          <Link
            href="/privacy"
            aria-current={page === "privacy" ? "page" : undefined}
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            aria-current={page === "terms" ? "page" : undefined}
          >
            Terms
          </Link>
          <Link
            href="/copyright"
            aria-current={page === "copyright" ? "page" : undefined}
          >
            Copyright
          </Link>
        </nav>
      </header>
      <main className="legal-main" dangerouslySetInnerHTML={{ __html: main }} />
    </div>
  );
}
