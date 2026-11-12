import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { deleteChecklistItem, saveChecklistItem, saveCompany, setAssignment } from "@/app/actions/manage";
import { Dialog } from "@/components/dialog";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { getCompanyContext } from "@/lib/session";
import { AREA_LABEL, INTERNAL_ROLE_LABEL, type Area, type DocCategory, type InternalRole } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Setări firmă" };

type Item = { id: string; area: Area; label: string; category_code: string | null; due_day: number | null; is_active: boolean };
const AUDIT_LABEL: Record<string, string> = {
  stergere: "Document șters", inlocuire: "Fișier înlocuit", restaurare: "Document restaurat", invitatie_acceptata: "Invitație acceptată",
  insert: "Adăugare", update: "Modificare", delete: "Eliminare",
};
const ENTITY_LABEL: Record<string, string> = { company_members: "utilizator firmă", staff_assignments: "arondare", documents: "", invitations: "" };

export default async function SettingsPage({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await getCompanyContext(cid);
  const { supabase, company, access } = ctx;
  if (!access.isStaff) notFound();

  const [{ data: assigned }, { data: staff }, { data: items }, { data: cats }, { data: audit }] = await Promise.all([
    supabase.from("staff_assignments").select("user_id").eq("company_id", cid),
    supabase.from("profiles").select("id, full_name, email, internal_role, is_active").not("internal_role", "is", null).order("full_name"),
    supabase.from("checklist_items").select("*").eq("company_id", cid).order("area").order("sort"),
    supabase.from("document_categories").select("*").eq("direction", "de_la_client").order("sort"),
    supabase.from("audit_log").select("id, actor_id, action, entity, details, created_at").eq("company_id", cid).order("created_at", { ascending: false }).limit(25),
  ]);
  const assignedIds = new Set((assigned ?? []).map((a) => a.user_id as string));
  const team = (staff ?? []).filter((s) => s.internal_role !== "super_admin");
  const assignedTeam = team.filter((s) => assignedIds.has(s.id));
  const available = team.filter((s) => !assignedIds.has(s.id) && s.is_active);
  const categories = (cats ?? []) as DocCategory[];
  const staffName = new Map((staff ?? []).map((s) => [s.id as string, s.full_name || s.email]));

  const itemForm = (area: Area, item?: Item) => (
    <ActionForm action={saveChecklistItem} resetOnDone={!item} className="flex flex-col gap-4">
      <input type="hidden" name="company_id" value={cid} />
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="area" value={area} />
      <Field label="Denumire *"><Input name="label" defaultValue={item?.label} required /></Field>
      <Field label="Categorie de documente" hint="Elementul se bifează automat când clientul încarcă documente în această categorie.">
        <Select name="category_code" defaultValue={item?.category_code ?? ""}>
          <option value="">Fără legătură (bifare manuală)</option>
          {categories.filter((c) => c.area === area).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </Select>
      </Field>
      <Field label="Termen: ziua din luna următoare" hint="Ex.: 10 = documentele lunii martie se așteaptă până pe 10 aprilie. Clientul primește reminder cu 2 zile înainte și în ziua termenului.">
        <Input name="due_day" type="number" min={1} max={31} defaultValue={item?.due_day ?? ""} />
      </Field>
      <Field label="Stare">
        <Select name="is_active" defaultValue={item?.is_active === false ? "0" : "1"}>
          <option value="1">Activ pentru această firmă</option><option value="0">Dezactivat</option>
        </Select>
      </Field>
      <div className="flex justify-end"><SubmitButton>Salvează</SubmitButton></div>
    </ActionForm>
  );

  return (
    <>
      <PageHeader title="Setări firmă" description={company.name} />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Date firmă" description={access.isSuperAdmin ? undefined : "Doar un Super Admin poate modifica datele firmei."} />
          <ActionForm action={saveCompany} resetOnDone={false} className="grid gap-4 p-5 sm:grid-cols-2">
            <input type="hidden" name="id" value={cid} />
            <fieldset disabled={!access.isSuperAdmin} className="contents">
              <Field label="Denumire *"><Input name="name" defaultValue={company.name} required /></Field>
              <Field label="CUI"><Input name="cui" defaultValue={company.cui ?? ""} /></Field>
              <Field label="Nr. Registrul Comerțului"><Input name="reg_com" defaultValue={company.reg_com ?? ""} /></Field>
              <Field label="Adresă"><Input name="address" defaultValue={company.address ?? ""} /></Field>
              <Field label="Stare" hint="O firmă arhivată rămâne în baza de date, dar clienții nu o mai pot accesa.">
                <Select name="is_archived" defaultValue={company.is_archived ? "1" : "0"}>
                  <option value="0">Activă</option><option value="1">Arhivată (colaborare încetată)</option>
                </Select>
              </Field>
              {access.isSuperAdmin ? <div className="flex items-end justify-end"><SubmitButton>Salvează</SubmitButton></div> : null}
            </fieldset>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader title="Echipa Gana arondată" description="Solicitările noi se alocă automat contabilului, respectiv specialistului HR arondat." />
          {assignedTeam.length === 0 ? <EmptyState title="Nimeni arondat">Până la arondare, notificările ajung la Super Admin.</EmptyState> : (
            <ul className="divide-y divide-line/70">
              {assignedTeam.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{s.full_name || s.email}</p>
                    <p className="text-xs text-muted">{INTERNAL_ROLE_LABEL[s.internal_role as InternalRole]}{s.is_active ? "" : " · cont dezactivat"}</p>
                  </div>
                  {access.isSuperAdmin ? (
                    <ActionForm action={setAssignment}>
                      <input type="hidden" name="company_id" value={cid} /><input type="hidden" name="user_id" value={s.id} /><input type="hidden" name="remove" value="1" />
                      <SubmitButton variant="ghost" size="sm" className="text-red-700">Elimină</SubmitButton>
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {access.isSuperAdmin && available.length ? (
            <ActionForm action={setAssignment} className="flex flex-wrap items-end gap-3 border-t border-line p-5">
              <input type="hidden" name="company_id" value={cid} />
              <Field label="Arondează o persoană" className="min-w-56 flex-1">
                <Select name="user_id" defaultValue="" required>
                  <option value="" disabled>Alege…</option>
                  {available.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email} — {INTERNAL_ROLE_LABEL[s.internal_role as InternalRole]}</option>)}
                </Select>
              </Field>
              <SubmitButton variant="outline">Arondează</SubmitButton>
            </ActionForm>
          ) : null}
        </Card>

        {(["accounting", "hr"] as Area[]).filter((a) => access.staff[a]).map((area) => {
          const list = ((items ?? []) as Item[]).filter((i) => i.area === area);
          return (
            <Card key={area}>
              <CardHeader title={`Checklist lunar — ${AREA_LABEL[area]}`} description="Ce trebuie să trimită firma în fiecare lună și până când."
                action={<Dialog title="Element nou" trigger={<Button variant="outline" size="sm"><Plus /> Adaugă</Button>}>{itemForm(area)}</Dialog>} />
              {list.length === 0 ? <EmptyState title="Niciun element" /> : (
                <Table>
                  <thead><tr><Th>Element</Th><Th>Categorie legată</Th><Th>Termen</Th><Th>Stare</Th><Th /></tr></thead>
                  <tbody>
                    {list.map((i) => (
                      <tr key={i.id}>
                        <Td className="font-medium text-navy-900">{i.label}</Td>
                        <Td>{categories.find((c) => c.code === i.category_code)?.label ?? "—"}</Td>
                        <Td>{i.due_day ? `ziua ${i.due_day} a lunii următoare` : "—"}</Td>
                        <Td><Badge tone={i.is_active ? "green" : "neutral"}>{i.is_active ? "Activ" : "Dezactivat"}</Badge></Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <Dialog title="Modifică elementul" trigger={<Button variant="outline" size="sm">Modifică</Button>}>{itemForm(area, i)}</Dialog>
                            <ActionForm action={deleteChecklistItem}>
                              <input type="hidden" name="company_id" value={cid} /><input type="hidden" name="id" value={i.id} />
                              <ConfirmSubmit variant="ghost" size="sm" className="text-red-700" confirm={`Elimini „${i.label}” din checklist?`}>Șterge</ConfirmSubmit>
                            </ActionForm>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}

        <Card>
          <CardHeader title="Jurnal de audit" description="Ultimele operațiuni sensibile: ștergeri și înlocuiri de documente, schimbări de acces." />
          {audit?.length ? (
            <ul className="divide-y divide-line/70 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                  <span>
                    <span className="font-medium text-navy-900">{AUDIT_LABEL[a.action] ?? a.action}</span>
                    {ENTITY_LABEL[a.entity] ? ` ${ENTITY_LABEL[a.entity]}` : ""}
                    {a.details?.fisier_vechi ? ` — ${a.details.fisier_vechi}` : a.details?.email ? ` — ${a.details.email}` : ""}
                  </span>
                  <span className="text-xs text-muted">{staffName.get(a.actor_id) ?? "utilizator client"} · {formatDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Nicio operațiune înregistrată" />}
        </Card>
      </div>
    </>
  );
}
