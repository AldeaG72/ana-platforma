import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { saveCompany } from "@/app/actions/manage";
import { Dialog } from "@/components/dialog";
import { loadNames } from "@/components/documents-board";
import { ActionForm, SubmitButton } from "@/components/forms";
import { StatusBadge } from "@/components/status";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/session";
import { AREA_LABEL, OPEN_STATUSES, type RequestRow } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Firme" };

export default async function HomePage() {
  const session = await getSession();
  const { supabase, companies, isStaff, isSuperAdmin } = session;
  if (!isStaff && companies.length === 1) redirect(`/f/${companies[0].id}`);

  // RLS întoarce doar solicitările din firmele și zonele la care utilizatorul are acces
  const { data: open } = await supabase.from("requests").select("*").in("status", OPEN_STATUSES)
    .order("due_at", { ascending: true, nullsFirst: false }).limit(isStaff ? 100 : 20);
  const requests = (open ?? []) as RequestRow[];
  const openByCompany = new Map<string, number>();
  for (const r of requests) openByCompany.set(r.company_id, (openByCompany.get(r.company_id) ?? 0) + 1);
  const { data: fresh } = isStaff
    ? await supabase.from("documents").select("company_id").eq("direction", "de_la_client").eq("status", "trimis").is("deleted_at", null).limit(2000)
    : { data: [] as { company_id: string }[] };
  const newDocs = new Map<string, number>();
  for (const d of fresh ?? []) newDocs.set(d.company_id, (newDocs.get(d.company_id) ?? 0) + 1);
  const names = await loadNames(supabase, requests.map((r) => r.assigned_to));
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title={isStaff ? "Firme" : "Firmele mele"} description={isStaff ? "Firmele la care ești arondat și lucrările în desfășurare." : "Alege firma în care vrei să lucrezi."}>
        {isSuperAdmin ? (
          <Dialog title="Firmă nouă" description="După creare poți aronda contabilul și specialistul HR și poți invita administratorul firmei." trigger={<Button><Plus /> Firmă nouă</Button>}>
            <ActionForm action={saveCompany} resetOnDone={false} className="flex flex-col gap-4">
              <Field label="Denumire *"><Input name="name" required /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CUI"><Input name="cui" /></Field>
                <Field label="Nr. Registrul Comerțului"><Input name="reg_com" /></Field>
              </div>
              <Field label="Adresă"><Input name="address" /></Field>
              <div className="flex justify-end"><SubmitButton>Creează firma</SubmitButton></div>
            </ActionForm>
          </Dialog>
        ) : null}
      </PageHeader>

      {companies.length === 0 ? (
        <Card><EmptyState icon={<Building2 />} title="Nicio firmă disponibilă">
          {isStaff ? "Nu ești arondat încă niciunei firme. Un Super Admin te poate aronda din setările firmei." : "Contul tău nu este asociat niciunei firme. Contactează echipa Gana."}
        </EmptyState></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Link key={c.id} href={`/f/${c.id}`} className="group rounded-xl border border-line bg-white p-5 transition-colors hover:border-gold-500">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-navy-900 group-hover:underline">{c.name}</p>
                {c.is_archived ? <Badge>Arhivată</Badge> : null}
              </div>
              <p className="mt-0.5 text-xs text-muted">{c.cui ? `CUI ${c.cui}` : "—"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={openByCompany.get(c.id) ? "blue" : "neutral"}>{openByCompany.get(c.id) ?? 0} solicitări deschise</Badge>
                {isStaff && newDocs.get(c.id) ? <Badge tone="gold">{newDocs.get(c.id)} documente noi</Badge> : null}
              </div>
            </Link>
          ))}
        </div>
      )}

      {isStaff && requests.length > 0 ? (
        <Card className="mt-8">
          <CardHeader title="Coada de lucru" description="Solicitările în desfășurare din firmele tale, în ordinea termenului de răspuns." />
          <Table>
            <thead><tr><Th>Solicitare</Th><Th>Firmă</Th><Th>Zonă</Th><Th>Status</Th><Th>Termen</Th><Th>Responsabil</Th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-navy-50/40">
                  <Td><Link className="font-medium text-navy-900 hover:underline" href={`/f/${r.company_id}/solicitari/${r.id}`}>{r.title}</Link></Td>
                  <Td>{companyName.get(r.company_id) ?? "—"}</Td>
                  <Td>{AREA_LABEL[r.area]}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td className="whitespace-nowrap">{formatDate(r.due_at)}</Td>
                  <Td>{names.get(r.assigned_to ?? "") ?? "Nealocat"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </>
  );
}
