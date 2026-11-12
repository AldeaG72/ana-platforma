"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { STATUSES, type ActionState, type Area, type Direction, type RequestType, type WorkStatus } from "@/lib/types";

const refresh = (companyId: string) => revalidatePath(`/f/${companyId}`, "layout");
const isArea = (v: unknown): v is Area => v === "accounting" || v === "hr";

export type UploadedFile = { path: string; name: string; size: number; mime: string };

/** Înregistrează în baza de date fișierele deja urcate direct în Storage din browser. */
export async function registerDocuments(input: {
  companyId: string; area: Area; direction: Direction; category: string; year: number; month: number;
  files: UploadedFile[]; requestId?: string | null; employeeId?: string | null; sensitive?: boolean; note?: string;
}): Promise<ActionState> {
  if (!isUuid(input.companyId) || !isArea(input.area) || !input.files.length) return { error: "Date incomplete." };
  if (input.files.length > 50) return { error: "Poți încărca cel mult 50 de fișiere odată." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesiune expirată. Autentifică-te din nou." };

  const { error } = await supabase.from("documents").insert(
    input.files.map((f) => ({
      company_id: input.companyId,
      area: input.area,
      direction: input.direction,
      category: input.category,
      period_year: input.year,
      period_month: input.month,
      file_name: f.name.slice(0, 200),
      storage_path: f.path,
      size_bytes: f.size,
      mime_type: f.mime || null,
      note: input.note?.trim() || null,
      request_id: input.requestId ?? null,
      employee_id: input.employeeId ?? null,
      sensitive: input.sensitive ?? false,
      status: input.direction === "de_la_gana" ? "finalizat" : "trimis",
      uploaded_by: auth.user.id,
    })),
  );
  if (error) return { error: error.message };
  refresh(input.companyId);
  return { ok: true };
}

/** Înlocuirea fișierului unui document (doar echipa Gana — impus și în baza de date). */
export async function replaceDocument(input: { id: string; companyId: string; file: UploadedFile }): Promise<ActionState> {
  if (!isUuid(input.id)) return { error: "Document invalid." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", input.id).maybeSingle();
  if (!doc) return { error: "Documentul nu a fost găsit." };
  const { error } = await supabase
    .from("documents")
    .update({ storage_path: input.file.path, file_name: input.file.name, size_bytes: input.file.size, mime_type: input.file.mime || null })
    .eq("id", input.id);
  if (error) return { error: error.message };
  await supabase.storage.from("documente").remove([doc.storage_path]);
  refresh(input.companyId);
  return { ok: true, message: "Fișierul a fost înlocuit." };
}

export async function deleteDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const companyId = String(fd.get("company_id"));
  if (!isUuid(id) || !isUuid(companyId)) return { error: "Document invalid." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: doc } = await supabase.from("documents").select("storage_path, area").eq("id", id).maybeSingle();
  if (!doc || !auth.user) return { error: "Documentul nu a fost găsit." };

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user.id })
    .eq("id", id);
  if (error) return { error: error.message };
  await supabase.storage.from("documente").remove([doc.storage_path]);
  refresh(companyId);
  const back = String(fd.get("back") ?? "");
  if (back.startsWith(`/f/${companyId}`)) redirect(back);
  return { ok: true, message: "Documentul a fost șters." };
}

export async function getDownloadUrl(id: string): Promise<{ url?: string; error?: string }> {
  if (!isUuid(id)) return { error: "Document invalid." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!doc) return { error: "Nu ai acces la acest document." };
  const { data, error } = await supabase.storage.from("documente").createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !data) return { error: "Fișierul nu a putut fi descărcat." };
  return { url: data.signedUrl };
}

export async function setStatus(input: { kind: "document" | "request"; id: string; companyId: string; status: WorkStatus }): Promise<ActionState> {
  if (!isUuid(input.id) || !STATUSES.includes(input.status)) return { error: "Date invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(input.kind === "document" ? "documents" : "requests")
    .update({ status: input.status })
    .eq("id", input.id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Nu ai dreptul să modifici acest element." };
  refresh(input.companyId);
  return { ok: true, message: "Status actualizat." };
}

export async function createRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = String(fd.get("company_id"));
  const area = fd.get("area");
  const typeCode = String(fd.get("type_code") ?? "");
  if (!isUuid(companyId) || !isArea(area) || !typeCode) return { error: "Alege tipul solicitării." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: type } = await supabase.from("request_types").select("*").eq("code", typeCode).maybeSingle();
  if (!auth.user || !type) return { error: "Tip de solicitare necunoscut." };

  const details: Record<string, string> = {};
  let employeeId: string | null = null;
  let subject = "";
  for (const f of (type as RequestType).fields) {
    const value = String(fd.get(`f_${f.name}`) ?? "").trim();
    if (f.required && !value) return { error: `Completează câmpul „${f.label}”.` };
    if (!value) continue;
    if (f.type === "employee") {
      if (!isUuid(value)) return { error: "Alege un angajat." };
      const { data: emp } = await supabase.from("employees").select("last_name, first_name").eq("id", value).maybeSingle();
      if (!emp) return { error: "Angajatul nu a fost găsit." };
      employeeId = value;
      details[f.name] = `${emp.last_name} ${emp.first_name}`;
      subject = details[f.name];
    } else {
      details[f.name] = value.slice(0, 500);
      if (!subject && f.type !== "select") subject = details[f.name];
    }
  }

  const { data, error } = await supabase
    .from("requests")
    .insert({
      company_id: companyId,
      area,
      type_code: typeCode,
      title: (subject ? `${type.label} — ${subject}` : type.label).slice(0, 160),
      details,
      message: String(fd.get("message") ?? "").trim().slice(0, 4000) || null,
      employee_id: employeeId,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  refresh(companyId);
  redirect(`/f/${companyId}/solicitari/${data.id}`);
}

export async function addComment(_: ActionState, fd: FormData): Promise<ActionState> {
  const companyId = String(fd.get("company_id"));
  const body = String(fd.get("body") ?? "").trim();
  const documentId = String(fd.get("document_id") ?? "");
  const requestId = String(fd.get("request_id") ?? "");
  if (!body) return { error: "Scrie un mesaj." };
  if (!isUuid(companyId) || (!isUuid(documentId) && !isUuid(requestId))) return { error: "Date invalide." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesiune expirată." };
  const { error } = await supabase.from("comments").insert({
    company_id: companyId,
    document_id: isUuid(documentId) ? documentId : null,
    request_id: isUuid(requestId) ? requestId : null,
    author_id: auth.user.id,
    body: body.slice(0, 5000),
  });
  if (error) return { error: error.message };
  refresh(companyId);
  return { ok: true };
}

export async function markNotificationsRead(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const id = fd.get("id");
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (id) q = q.eq("id", Number(id));
  const { error } = await q;
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Deschide o notificare: o marchează ca citită și duce utilizatorul la elementul vizat. */
export async function openNotification(fd: FormData) {
  const supabase = await createClient();
  const id = Number(fd.get("id"));
  const { data } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).select("link").maybeSingle();
  revalidatePath("/", "layout");
  const link = data?.link ?? String(fd.get("link") ?? "/");
  redirect(link.startsWith("/") && !link.startsWith("//") ? link : "/");
}
