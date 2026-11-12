import { AppShell, type ShellCompany } from "@/components/app-shell";
import { accessFor, getSession } from "@/lib/session";
import { INTERNAL_ROLE_LABEL } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const { count } = await session.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  const companies: ShellCompany[] = session.companies.map((c) => {
    const a = accessFor(session, c.id);
    return {
      id: c.id,
      name: c.name,
      accounting: a.area.accounting,
      hr: a.area.hr,
      financials: a.sensitive.accounting,
      users: a.manageUsers || a.isStaff,
      settings: a.isStaff,
    };
  });

  return (
    <AppShell
      companies={companies}
      user={{
        name: session.profile.full_name || session.profile.email,
        role: session.profile.internal_role ? INTERNAL_ROLE_LABEL[session.profile.internal_role] : "Client",
        isStaff: session.isStaff,
        isSuperAdmin: session.isSuperAdmin,
      }}
      unread={count ?? 0}
    >
      {children}
    </AppShell>
  );
}
