import { session } from "@/lib/server/session";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import PublicShell from "@/components/community/PublicShell";

export async function AdaptiveShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await session();
  if (account) {
    return (
      <WorkspaceShell user={account.user} admin={account.admin}>
        {children}
      </WorkspaceShell>
    );
  }
  return <PublicShell>{children}</PublicShell>;
}
