import type { getCompanyContext } from "@/lib/session";
import type { Area } from "@/lib/types";

type Ctx = Awaited<ReturnType<typeof getCompanyContext>>;

export type ChecklistRow = {
  id: string; area: Area; label: string; category_code: string | null; due_day: number | null;
  /** incarcat = există documente; bifat / nu_e_cazul = marcat manual; lipsa = nimic încă */
  state: "incarcat" | "bifat" | "nu_e_cazul" | "lipsa";
  docCount: number;
  /** termenul: ziua `due_day` din luna următoare perioadei */
  dueDate: string | null;
};

export async function loadChecklist(ctx: Ctx, year: number, month: number): Promise<ChecklistRow[]> {
  const { supabase, company, access } = ctx;
  const areas = (["accounting", "hr"] as Area[]).filter((a) => access.area[a]);
  if (!areas.length) return [];

  const [{ data: items }, { data: entries }, { data: docs }] = await Promise.all([
    supabase.from("checklist_items").select("*").eq("company_id", company.id).eq("is_active", true).in("area", areas).order("area").order("sort"),
    supabase.from("checklist_entries").select("item_id, state").eq("company_id", company.id).eq("period_year", year).eq("period_month", month),
    supabase.from("documents").select("category").eq("company_id", company.id).eq("direction", "de_la_client")
      .eq("period_year", year).eq("period_month", month).is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const d of docs ?? []) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  const marks = new Map((entries ?? []).map((e) => [e.item_id as string, e.state as "bifat" | "nu_e_cazul"]));

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();

  return (items ?? []).map((i) => {
    const docCount = i.category_code ? counts.get(i.category_code) ?? 0 : 0;
    const mark = marks.get(i.id);
    return {
      id: i.id, area: i.area, label: i.label, category_code: i.category_code, due_day: i.due_day, docCount,
      state: mark ?? (docCount > 0 ? "incarcat" : "lipsa"),
      dueDate: i.due_day
        ? `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(Math.min(i.due_day, lastDay)).padStart(2, "0")}`
        : null,
    };
  });
}
