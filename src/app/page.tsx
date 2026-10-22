import LandingPage from "@/components/landing/LandingPage";
import { session } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { homeStructuredData } from "@/lib/seo/structured-data";
import { SITE_URL } from "@/lib/site";

export default async function HomePage() {
  if (await session()) redirect("/workspace");
  const origin = SITE_URL;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeStructuredData(origin)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <LandingPage />
    </>
  );
}
