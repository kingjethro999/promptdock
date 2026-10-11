import { AdaptiveShell } from "@/components/community/AdaptiveShell";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdaptiveShell>{children}</AdaptiveShell>;
}
