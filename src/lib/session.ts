import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import type { Area, Company, Member, Profile } from "@/lib/types";

/** Utilizatorul curent, profilul lui și firmele la care are acces. O singură citire per cerere. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ data: profile }, { data: companies }, { data: memberships }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
    supabase.from("companies").select("*").order("name"),
    supabase.from("company_members").select("*").eq("user_id", auth.user.id),
    supabase.from("staff_assignments").select("company_id").eq("user_id", auth.user.id),
  ]);
  if (!profile || !profile.is_active) redirect("/login?eroare=cont");

  return {
    supabase,
    profile: profile as Profile,
    companies: ((companies ?? []) as Company[]).filter((c) => !c.is_archived || profile.internal_role === "super_admin"),
    memberships: (memberships ?? []) as Member[],
    assignedCompanyIds: (assignments ?? []).map((a) => a.company_id as string),
    isStaff: profile.internal_role !== null,
    isSuperAdmin: profile.internal_role === "super_admin",
  };
});

export type CompanyAccess = {
  /** personal Gana cu drept de lucru pe zonă */
  staff: Record<Area, boolean>;
  isStaff: boolean;
  isSuperAdmin: boolean;
  /** poate intra în modul */
  area: Record<Area, boolean>;
  /** vede date sensibile ale zonei (financiare / salariale) */
  sensitive: Record<Area, boolean>;
  viewPii: boolean;
  manageUsers: boolean;
};

type Session = Awaited<ReturnType<typeof getSession>>;

/** Drepturile utilizatorului pe o firmă. Oglindește regulile RLS, ca interfața să arate doar ce are voie. */
export function accessFor(session: Pick<Session, "profile" | "assignedCompanyIds" | "memberships">, companyId: string): CompanyAccess {
  const role = session.profile.internal_role;
  const assigned = session.assignedCompanyIds.includes(companyId);
  const m = session.memberships.find((x) => x.company_id === companyId);
  const staff = {
    accounting: role === "super_admin" || (role === "contabil" && assigned),
    hr: role === "super_admin" || (role === "specialist_hr" && assigned),
  };
  return {
    staff,
    isStaff: role !== null,
    isSuperAdmin: role === "super_admin",
    area: { accounting: staff.accounting || !!m?.perm_accounting, hr: staff.hr || !!m?.perm_hr },
    sensitive: {
      accounting: staff.accounting || (!!m?.perm_accounting && !!m?.perm_view_financials),
      hr: staff.hr || (!!m?.perm_hr && !!m?.perm_view_salaries),
    },
    viewPii: staff.hr || (!!m?.perm_hr && !!m?.perm_view_employee_pii),
    manageUsers: role === "super_admin" || !!m?.perm_manage_users,
  };
}

/** Contextul firmei active. */
export const getCompanyContext = cache(async (companyId: string) => {
  if (!isUuid(companyId)) notFound();
  const session = await getSession();
  const company = session.companies.find((c) => c.id === companyId);
  if (!company) notFound();
  return { ...session, company, access: accessFor(session, companyId) };
});

/** Oprește pagina dacă utilizatorul nu are acces la modul. */
export async function requireArea(companyId: string, area: Area) {
  const ctx = await getCompanyContext(companyId);
  if (!ctx.access.area[area]) notFound();
  return ctx;
}
