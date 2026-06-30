import { getAuthUser } from "@/lib/auth";
import { ModeProvider } from "@/lib/mode";
import { modeFromPreferences } from "@/lib/mode/types";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  const serverMode = modeFromPreferences(user?.preferences ?? null);

  return (
    <ModeProvider serverMode={serverMode}>
      <DashboardShell
        user={{
          name: user?.full_name ?? "Usuário",
          role: user?.role ?? "staff",
          email: user?.email ?? "",
          avatarUrl: user?.avatar_url ?? null,
        }}
      >
        {children}
      </DashboardShell>
    </ModeProvider>
  );
}
