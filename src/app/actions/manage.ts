"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { PERMISSIONS, ROLE_PRESETS, type ActionState, type Area, type ClientRole, type InternalRole } from "@/lib/types";

const refresh = (companyId: string) => revalidatePath(`/f/${companyId}`, "layout");
const isArea = (v: unknown): v is Area => v === "accounting" || v === "hr";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);
const num = (v: string) => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

// ------------------------------------------------------------------ dashboard financiar
export async function saveSnapshot(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const year = Number(fd.get("year"));
  const month = Number(fd.get("month"));
  const revenue = num(str(fd, "revenue") || "0");
  const expenses = num(str(fd, "expenses") || "0");
  const taxes = num(str(fd, "taxes_due") || "0");
  const profitRaw = str(fd, "profit");
  const profit = profitRaw === "" ? revenue - expenses : num(profitRaw);
  if (!isUuid(companyId) || !year || !month) return { error: "Perioadă invalidă." };
  if ([revenue, expenses, taxes, profit].some(Number.isNaN)) return { error: "Introdu doar valori numerice." };

  const supabase = await createClient();
  const { error } = await supabase.from("financial_snapshots").upsert({
    company_id: companyId, period_year: year, period_month: month,
    revenue, expenses, profit, taxes_due: taxes, note: orNull(str(fd, "note")),
  });
  if (error) return { error: error.message };
  refresh(companyId);
  return { ok: true, message: "Situația lunii a fost salvată." };
}

// ------------------------------------------------------------------------ checklist
export async function setChecklistEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const itemId = str(fd, "item_id");
  const state = str(fd, "state");
  const year = Number(fd.get("year"));
  const month = Number(fd.get("month"));
  if (!isUuid(companyId) || !isUuid(itemId)) return { error: "Date invalide." };
  const supabase = await createClient();

  if (state === "sterge") {
    const { error } = await supabase.from("checklist_entries").delete()
      .eq("item_id", itemId).eq("period_year", year).eq("period_month", month);
    if (error) return { error: error.message };
  } else {
    const { data: item } = await supabase.from("checklist_items").select("area").eq("id", itemId).maybeSingle();
    if (!item) return { error: "Element inexistent." };
    const { error } = await supabase.from("checklist_entries").upsert({
      item_id: itemId, company_id: companyId, area: item.area, period_year: year, period_month: month,
      state: state === "nu_e_cazul" ? "nu_e_cazul" : "bifat",
    });
    if (error) return { error: error.message };
  }
  refresh(companyId);
  return { ok: true };
}

export async function saveChecklistItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const id = str(fd, "id");
  const area = fd.get("area");
  const label = str(fd, "label");
  const dueDay = str(fd, "due_day");
  if (!isUuid(companyId) || !isArea(area) || !label) return { error: "Completează denumirea." };
  const row = {
    company_id: companyId, area, label,
    category_code: orNull(str(fd, "category_code")),
    due_day: dueDay ? Math.min(31, Math.max(1, Number(dueDay))) : null,
    is_active: fd.get("is_active") !== "0",
  };
  const supabase = await createClient();
  const { error } = isUuid(id)
    ? await supabase.from("checklist_items").update(row).eq("id", id)
    : await supabase.from("checklist_items").insert(row);
  if (error) return { error: error.message };
  refresh(companyId);
  return { ok: true, message: "Checklist actualizat." };
}

export async function deleteChecklistItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", str(fd, "id"));
  if (error) return { error: error.message };
  refresh(companyId);
  return { ok: true, message: "Element eliminat." };
}

// ------------------------------------------------------------------------- angajați
const EMPLOYEE_STATUSES = ["activ", "suspendat", "incetat"];

export async function saveEmployee(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const id = str(fd, "id");
  if (!isUuid(companyId)) return { error: "Firmă invalidă." };
  if (!str(fd, "last_name") || !str(fd, "first_name")) return { error: "Numele și prenumele sunt obligatorii." };
  const cnp = str(fd, "cnp");
  if (cnp && !/^\d{13}$/.test(cnp)) return { error: "CNP-ul trebuie să aibă 13 cifre." };

  const row = {
    company_id: companyId,
    last_name: str(fd, "last_name"), first_name: str(fd, "first_name"),
    job_title: orNull(str(fd, "job_title")), department: orNull(str(fd, "department")),
    contract_no: orNull(str(fd, "contract_no")), contract_date: orNull(str(fd, "contract_date")),
    contract_type: orNull(str(fd, "contract_type")),
    work_hours: str(fd, "work_hours") ? num(str(fd, "work_hours")) : null,
    hire_date: orNull(str(fd, "hire_date")), end_date: orNull(str(fd, "end_date")),
    status: EMPLOYEE_STATUSES.includes(str(fd, "status")) ? str(fd, "status") : "activ",
    email: orNull(str(fd, "email")), phone: orNull(str(fd, "phone")),
  };
  const supabase = await createClient();
  let employeeId = id;
  if (isUuid(id)) {
    const { error } = await supabase.from("employees").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("employees").insert(row).select("id").single();
    if (error) return { error: error.message };
    employeeId = data.id;
  }
  const { error: privError } = await supabase.from("employee_private").upsert({
    employee_id: employeeId, company_id: companyId, cnp: orNull(cnp),
    id_series: orNull(str(fd, "id_series")), id_number: orNull(str(fd, "id_number")),
    id_issued_by: orNull(str(fd, "id_issued_by")), id_expiry: orNull(str(fd, "id_expiry")),
    birth_date: orNull(str(fd, "birth_date")), address: orNull(str(fd, "address")),
  });
  if (privError) return { error: privError.message };
  refresh(companyId);
  if (!isUuid(id)) redirect(`/f/${companyId}/hr/angajati/${employeeId}`);
  return { ok: true, message: "Datele angajatului au fost salvate." };
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v) return String(v.text).trim();
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    return "";
  }
  return String(v).trim();
}
function toIsoDate(v: string): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Import de angajați din șablonul Excel Gana. Rândurile cu CNP deja existent sunt actualizate. */
export async function importEmployees(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const file = fd.get("file");
  if (!isUuid(companyId) || !(file instanceof File) || !file.size) return { error: "Alege fișierul Excel completat." };
  if (file.size > 4 * 1024 * 1024) return { error: "Fișierul este prea mare (maximum 4 MB)." };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "Fișierul nu a putut fi citit. Folosește șablonul .xlsx descărcat din platformă." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { error: "Fișierul nu conține nicio foaie." };

  const col: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, i) => { col[norm(cellText(cell.value))] = i; });
  const get = (row: ExcelJS.Row, key: string) => (col[key] ? cellText(row.getCell(col[key]).value) : "");
  if (!col["nume"] || !col["prenume"]) return { error: "Capul de tabel nu corespunde șablonului (lipsesc coloanele Nume / Prenume)." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("employee_private").select("employee_id, cnp").eq("company_id", companyId);
  const byCnp = new Map((existing ?? []).filter((e) => e.cnp).map((e) => [e.cnp as string, e.employee_id as string]));

  let added = 0, updated = 0;
  const problems: string[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const last = get(row, "nume"), first = get(row, "prenume");
    if (!last && !first) continue;
    const cnp = get(row, "cnp").replace(/\D/g, "");
    if (!last || !first) { problems.push(`rândul ${r}: lipsește numele sau prenumele`); continue; }
    if (cnp && cnp.length !== 13) { problems.push(`rândul ${r}: CNP invalid`); continue; }

    const hours = num(get(row, "normaorezi") || "8");
    const emp = {
      company_id: companyId, last_name: last, first_name: first,
      job_title: orNull(get(row, "functie")), department: orNull(get(row, "departament")),
      contract_no: orNull(get(row, "nrcontract")), contract_date: toIsoDate(get(row, "datacontract")),
      contract_type: orNull(get(row, "tipcontract")), work_hours: Number.isNaN(hours) ? 8 : hours,
      hire_date: toIsoDate(get(row, "dataangajarii")), email: orNull(get(row, "email")), phone: orNull(get(row, "telefon")),
    };
    let employeeId = cnp ? byCnp.get(cnp) : undefined;
    if (employeeId) {
      const { error } = await supabase.from("employees").update(emp).eq("id", employeeId);
      if (error) { problems.push(`rândul ${r}: ${error.message}`); continue; }
      updated++;
    } else {
      const { data, error } = await supabase.from("employees").insert(emp).select("id").single();
      if (error) { problems.push(`rândul ${r}: ${error.message}`); continue; }
      employeeId = data.id as string;
      if (cnp) byCnp.set(cnp, employeeId);
      added++;
    }
    await supabase.from("employee_private").upsert({
      employee_id: employeeId, company_id: companyId, cnp: orNull(cnp),
      id_series: orNull(get(row, "serieci")), id_number: orNull(get(row, "numarci")), address: orNull(get(row, "adresa")),
    });
  }
  refresh(companyId);
  if (!added && !updated) return { error: problems.length ? `Niciun angajat importat: ${problems.slice(0, 3).join("; ")}.` : "Fișierul nu conține angajați." };
  return {
    ok: true,
    message: `${added} angajați adăugați, ${updated} actualizați.${problems.length ? ` ${problems.length} rânduri ignorate (${problems.slice(0, 2).join("; ")}).` : ""}`,
  };
}

// ---------------------------------------------------------------- utilizatori client
function permsFromForm(fd: FormData) {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.key, fd.get(p.key) === "on"]));
}

export async function inviteClientUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role") as ClientRole;
  if (!isUuid(companyId) || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Introdu o adresă de email validă." };
  if (!(role in ROLE_PRESETS)) return { error: "Alege rolul." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesiune expirată." };
  const { data, error } = await supabase
    .from("invitations")
    .insert({ kind: "client", company_id: companyId, email, full_name: str(fd, "full_name"), role, invited_by: auth.user.id, ...permsFromForm(fd) })
    .select("id")
    .single();
  if (error) return { error: error.message };
  refresh(companyId);
  return { ok: true, data: { link: `/invitatie/${data.id}`, email } };
}

export async function revokeInvitation(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", str(fd, "id"));
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Invitația a fost anulată." };
}

export async function updateMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const role = str(fd, "role") as ClientRole;
  if (!(role in ROLE_PRESETS)) return { error: "Rol invalid." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_members")
    .update({ role, ...permsFromForm(fd) })
    .eq("company_id", companyId)
    .eq("user_id", str(fd, "user_id"))
    .select("user_id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Nu ai dreptul să modifici acest utilizator." };
  refresh(companyId);
  return { ok: true, message: "Permisiunile au fost salvate." };
}

export async function removeMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_members").delete().eq("company_id", companyId).eq("user_id", str(fd, "user_id")).select("user_id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Nu poți elimina acest utilizator." };
  refresh(companyId);
  return { ok: true, message: "Accesul utilizatorului la firmă a fost retras." };
}

// ------------------------------------------------------------------ administrare Gana
export async function saveCompany(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Introdu denumirea firmei." };
  const row = {
    name, cui: orNull(str(fd, "cui")), reg_com: orNull(str(fd, "reg_com")), address: orNull(str(fd, "address")),
    ...(fd.has("is_archived") ? { is_archived: fd.get("is_archived") === "1" } : {}),
  };
  const supabase = await createClient();
  if (isUuid(id)) {
    const { error } = await supabase.from("companies").update(row).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, message: "Datele firmei au fost salvate." };
  }
  const { data, error } = await supabase.from("companies").insert(row).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(`/f/${data.id}/setari`);
}

export async function setAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = str(fd, "company_id");
  const userId = str(fd, "user_id");
  if (!isUuid(companyId) || !isUuid(userId)) return { error: "Alege o persoană." };
  const supabase = await createClient();
  const { error } = fd.get("remove") === "1"
    ? await supabase.from("staff_assignments").delete().eq("company_id", companyId).eq("user_id", userId)
    : await supabase.from("staff_assignments").upsert({ company_id: companyId, user_id: userId });
  if (error) return { error: error.message };
  refresh(companyId);
  return { ok: true, message: "Arondarea a fost actualizată." };
}

export async function inviteStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "internal_role") as InternalRole;
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Introdu o adresă de email validă." };
  if (!["super_admin", "contabil", "specialist_hr"].includes(role)) return { error: "Alege rolul." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesiune expirată." };
  const { data, error } = await supabase
    .from("invitations")
    .insert({ kind: "staff", email, full_name: str(fd, "full_name"), internal_role: role, invited_by: auth.user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/echipa");
  return { ok: true, data: { link: `/invitatie/${data.id}`, email } };
}

export async function createResetLink(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesiune expirată." };
  const { data, error } = await supabase
    .from("invitations")
    .insert({ kind: "resetare", email, invited_by: auth.user.id, expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString() })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { ok: true, data: { link: `/invitatie/${data.id}`, email } };
}

export async function setProfileActive(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: fd.get("active") === "1" }).eq("id", str(fd, "user_id"));
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Starea contului a fost actualizată." };
}

export async function saveRequestType(_: ActionState, fd: FormData): Promise<ActionState> {
  const sla = Number(fd.get("sla_days"));
  if (!Number.isInteger(sla) || sla < 0 || sla > 60) return { error: "Termenul trebuie să fie între 0 și 60 de zile." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("request_types")
    .update({ sla_days: sla, sensitive: fd.get("sensitive") === "on", is_active: fd.get("is_active") === "on" })
    .eq("code", str(fd, "code"));
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Tipul de solicitare a fost salvat." };
}
