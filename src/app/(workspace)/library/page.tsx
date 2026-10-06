import type { Metadata } from "next";
import LibraryWorkspace from "@/components/library/LibraryWorkspace";
import { session } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Library",
  alternates: { canonical: "/library" },
  robots: { index: false },
};

export default async function LibraryPage() {
  const account = await session();
  return <LibraryWorkspace username={account?.user.username || null} />;
}
