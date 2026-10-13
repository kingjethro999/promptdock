import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { session } from "@/lib/server/session";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { ONBOARDING_EPOCH, PROFILE_FLOW_ID } from "@/lib/onboarding/registry";
import { pickPending, toClient } from "@/lib/onboarding/eligibility";

const db = require("../../database");

const OnboardingHost = dynamic(
  () => import("@/components/onboarding/OnboardingHost"),
);

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await session();
  if (!account) redirect("/auth?mode=login");

  await db.ensureSchema();

  const [userRes, expRes] = await Promise.all([
    db.pool.query(`SELECT created_at FROM users WHERE id = $1::uuid`, [
      account.user.id,
    ]),
    db.pool.query(
      `SELECT experience_id, status, first_shown_at FROM user_experiences WHERE user_id = $1::uuid`,
      [account.user.id],
    ),
  ]);

  const userRow = userRes.rows[0];
  const rows = expRes.rows;

  const isNewAccount =
    userRow && new Date(userRow.created_at) >= new Date(ONBOARDING_EPOCH);

  // Safety net: redirect brand-new accounts without any profile-setup row to /welcome
  if (
    isNewAccount &&
    !rows.some(
      (r: { experience_id: string }) => r.experience_id === PROFILE_FLOW_ID,
    )
  ) {
    redirect("/welcome");
  }

  const pending = userRow
    ? pickPending({ createdAt: userRow.created_at }, rows)
    : null;

  const clientPending =
    pending && account.user.username
      ? toClient(pending, { username: account.user.username })
      : pending
        ? toClient(pending, { username: "user" })
        : null;

  return (
    <WorkspaceShell user={account.user} admin={account.admin}>
      {children}
      {clientPending && <OnboardingHost pending={clientPending} />}
    </WorkspaceShell>
  );
}
