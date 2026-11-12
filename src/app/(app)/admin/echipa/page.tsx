import { notFound } from "next/navigation";
import { revokeInvitation, setProfileActive } from "@/app/actions/manage";
import { CopyLink } from "@/components/doc-actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { InviteStaffDialog, ResetPasswordDialog } from "@/components/user-forms";
import { getSession } from "@/lib/session";
import { INTERNAL_ROLE_LABEL, type InternalRole } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Echipa Gana" };

export default async function TeamPage() {
  const { supabase, isSuperAdmin, profile, companies } = await getSession();
  if (!isSuperAdmin) notFound();
  const [{ data: staff }, { data: assignments }, { data: inv }] = await Promise.all([
    supabase.from("profiles").select("*").not("internal_role", "is", null).order("full_name"),
    supabase.from("staff_assignments").select("company_id, user_id"),
    supabase.from("invitations").select("id, email, full_name, internal_role, expires_at").eq("kind", "staff")
      .is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title="Echipa Gana" description="Conturile interne: Super Admin, contabili și specialiști HR."><InviteStaffDialog /></PageHeader>
      <Card>
        <Table>
          <thead><tr><Th>Nume</Th><Th>Rol</Th><Th>Firme arondate</Th><Th>Stare</Th><Th /></tr></thead>
          <tbody>
            {(staff ?? []).map((s) => {
              const firms = (assignments ?? []).filter((a) => a.user_id === s.id).map((a) => companyName.get(a.company_id)).filter(Boolean);
              return (
                <tr key={s.id}>
                  <Td><p className="font-medium text-navy-900">{s.full_name || "—"}</p><p className="text-xs text-muted">{s.email}</p></Td>
                  <Td><Badge tone={s.internal_role === "super_admin" ? "gold" : "neutral"}>{INTERNAL_ROLE_LABEL[s.internal_role as InternalRole]}</Badge></Td>
                  <Td className="max-w-xs text-xs text-muted">{s.internal_role === "super_admin" ? "Toate firmele" : firms.length ? firms.join(", ") : "—"}</Td>
                  <Td><Badge tone={s.is_active ? "green" : "red"}>{s.is_active ? "Activ" : "Dezactivat"}</Badge></Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <ResetPasswordDialog email={s.email} />
                      {s.id !== profile.id ? (
                        <ActionForm action={setProfileActive}>
                          <input type="hidden" name="user_id" value={s.id} /><input type="hidden" name="active" value={s.is_active ? "0" : "1"} />
                          <ConfirmSubmit variant="ghost" size="sm" confirm={s.is_active ? `Dezactivezi contul ${s.email}?` : `Reactivezi contul ${s.email}?`}>
                            {s.is_active ? "Dezactivează" : "Reactivează"}
                          </ConfirmSubmit>
                        </ActionForm>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {inv?.length ? (
        <Card className="mt-6">
          <CardHeader title="Invitații în așteptare" />
          <ul className="divide-y divide-line/70">
            {inv.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-navy-900">{i.full_name || i.email} · {INTERNAL_ROLE_LABEL[i.internal_role as InternalRole]}</p>
                  <p className="text-xs text-muted">{i.email} · expiră la {formatDate(i.expires_at)}</p>
                </div>
                <div className="min-w-0 flex-1 basis-72"><CopyLink path={`/invitatie/${i.id}`} /></div>
                <ActionForm action={revokeInvitation}><input type="hidden" name="id" value={i.id} /><SubmitButton variant="ghost" size="sm" className="text-red-700">Anulează</SubmitButton></ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
