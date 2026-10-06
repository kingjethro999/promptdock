import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { session } from "@/lib/server/session";
import AdminConsole from "@/components/admin/AdminConsole";

export const metadata: Metadata = {
  title: "Admin console",
  alternates: { canonical: "/admin" },
  robots: { index: false },
};
export default async function AdminPage() {
  const account = await session();
  if (!account) redirect("/auth?mode=login");
  if (!account.admin) notFound();
  return <AdminConsole />;
}
