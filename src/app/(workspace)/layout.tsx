import { redirect } from "next/navigation";
import { session } from "@/lib/server/session";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await session();
  if (!account) redirect("/auth?mode=login");
  return (
    <WorkspaceShell user={account.user} admin={account.admin}>
      {children}
    </WorkspaceShell>
  );
}
