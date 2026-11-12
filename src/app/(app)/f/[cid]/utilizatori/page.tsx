import { notFound } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { removeMember, revokeInvitation } from "@/app/actions/manage";
import { CopyLink } from "@/components/doc-actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { EditMemberDialog, InviteClientDialog, ResetPasswordDialog } from "@/components/user-forms";
import { getCompanyContext } from "@/lib/session";
import { CLIENT_ROLE_LABEL, PERMISSIONS, type Member, type Perms } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Utilizatori" };

export default async function UsersPage({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await getCompanyContext(cid);
  const { supabase, access, profile } = ctx;
  if (!access.manageUsers && !access.isStaff) notFound();

  const [{ data: m }, { data: inv }] = await Promise.all([
    supabase.from("company_members").select("*").eq("company_id", cid).order("created_at"),
    access.manageUsers
      ? supabase.from("invitations").select("id, email, full_name, role, expires_at").eq("company_id", cid).eq("kind", "client")
          .is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; email: string; full_name: string; role: string; expires_at: string }[] }),
  ]);
  const members = (m ?? []) as Member[];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, is_active").in("id", members.map((x) => x.user_id).concat(profile.id));
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return (
    <>
      <PageHeader title="Utilizatori" description="Cine are acces la firmă și ce poate vedea fiecare.">
        {access.manageUsers ? <InviteClientDialog companyId={cid} /> : null}
      </PageHeader>

      <Card>
        {members.length === 0 ? (
          <EmptyState title="Niciun utilizator">Invită administratorul firmei pentru a începe.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Utilizator</Th><Th>Rol</Th>
                {PERMISSIONS.map((p) => <Th key={p.key} className="text-center normal-case" title={p.hint}>{p.label}</Th>)}
                <Th />
              </tr>
            </thead>
            <tbody>
              {members.map((x) => {
                const p = byId.get(x.user_id);
                const name = p?.full_name || p?.email || "—";
                const perms = Object.fromEntries(PERMISSIONS.map((k) => [k.key, x[k.key]])) as Perms;
                const self = x.user_id === profile.id;
                return (
                  <tr key={x.user_id}>
                    <Td>
                      <p className="font-medium text-navy-900">{name}{self ? " (tu)" : ""}</p>
                      <p className="text-xs text-muted">{p?.email}{p && !p.is_active ? " · cont dezactivat" : ""}</p>
                    </Td>
                    <Td><Badge tone={x.role === "client_admin" ? "gold" : "neutral"}>{CLIENT_ROLE_LABEL[x.role]}</Badge></Td>
                    {PERMISSIONS.map((k) => (
                      <Td key={k.key} className="text-center">
                        {x[k.key] ? <Check className="mx-auto size-4 text-emerald-600" aria-label="Da" /> : <Minus className="mx-auto size-4 text-navy-100" aria-label="Nu" />}
                      </Td>
                    ))}
                    <Td>
                      {access.manageUsers && (!self || access.isSuperAdmin) ? (
                        <div className="flex items-center justify-end gap-1">
                          <EditMemberDialog companyId={cid} userId={x.user_id} name={name} role={x.role} perms={perms} />
                          {access.isSuperAdmin && p?.email ? <ResetPasswordDialog email={p.email} /> : null}
                          {!self ? (
                            <ActionForm action={removeMember}>
                              <input type="hidden" name="company_id" value={cid} />
                              <input type="hidden" name="user_id" value={x.user_id} />
                              <ConfirmSubmit variant="ghost" size="sm" className="text-red-700" confirm={`Retragi accesul lui ${name} la această firmă?`}>Elimină</ConfirmSubmit>
                            </ActionForm>
                          ) : null}
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {inv?.length ? (
        <Card className="mt-6">
          <CardHeader title="Invitații în așteptare" description="Linkul se trimite manual persoanei invitate." />
          <ul className="divide-y divide-line/70">
            {inv.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-navy-900">{i.full_name || i.email}</p>
                  <p className="text-xs text-muted">{i.email} · expiră la {formatDate(i.expires_at)}</p>
                </div>
                <div className="min-w-0 flex-1 basis-72"><CopyLink path={`/invitatie/${i.id}`} /></div>
                <ActionForm action={revokeInvitation}>
                  <input type="hidden" name="id" value={i.id} />
                  <SubmitButton variant="ghost" size="sm" className="text-red-700">Anulează</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
