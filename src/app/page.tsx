import LandingPage from "@/components/landing/LandingPage";
import { session } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { homeStructuredData } from "@/lib/seo/structured-data";
import { SITE_URL } from "@/lib/site";

const LINK_TOKEN = /^[a-f0-9]{64}$/;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; reset?: string }>;
}) {
  // Emails sent before the dedicated routes existed link to /?verify=<token>
  // and /?reset=<token>. Forward them; the destination page spends the token.
  const { verify, reset } = await searchParams;
  if (typeof verify === "string" && LINK_TOKEN.test(verify))
    redirect(`/auth/verify?token=${verify}`);
  if (typeof reset === "string" && LINK_TOKEN.test(reset))
    redirect(`/auth?mode=reset&token=${reset}`);
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
