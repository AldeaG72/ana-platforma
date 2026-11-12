import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { DocumentList, loadNames } from "@/components/documents-board";
import { EmployeeForm, type EmployeePrivate } from "@/components/employee-form";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { UploadZone } from "@/components/upload-zone";
import { requireArea } from "@/lib/session";
import { EMPLOYEE_STATUS_LABEL, type DocCategory, type DocumentRow, type Employee } from "@/lib/types";
import { currentPeriod, formatDate, isUuid } from "@/lib/utils";

export const metadata = { title: "Angajat" };

export default async function EmployeePage({ params }: { params: Promise<{ cid: string; eid: string }> }) {
  const { cid, eid } = await params;
  const ctx = await requireArea(cid, "hr");
  if (!isUuid(eid)) notFound();
  const { supabase, access } = ctx;
  const [{ data: emp }, { data: priv }, { data: files }, { data: cats }] = await Promise.all([
    supabase.from("employees").select("*").eq("id", eid).eq("company_id", cid).maybeSingle(),
    supabase.from("employee_private").select("*").eq("employee_id", eid).maybeSingle(),
    supabase.from("documents").select("*").eq("employee_id", eid).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("document_categories").select("*").eq("area", "hr").order("sort"),
  ]);
  if (!emp) notFound();
  const e = emp as Employee;
  const p = priv as EmployeePrivate | null;
  const docs = (files ?? []) as DocumentRow[];
  const names = await loadNames(supabase, docs.map((d) => d.uploaded_by));
  const isStaff = access.staff.hr;
  const direction = isStaff ? "de_la_gana" : "de_la_client";
  const categories = ((cats ?? []) as DocCategory[]).filter((c) => c.direction === direction && !c.code.startsWith("pontaj") && !["stat_plata", "centralizator"].includes(c.code));
  const catLabels = new Map(((cats ?? []) as DocCategory[]).map((c) => [c.code, c.label]));
  const now = currentPeriod();

  const row = (k: string, v: string | null | undefined) => (
    <div key={k}><dt className="text-xs font-medium tracking-wide text-muted uppercase">{k}</dt><dd className="mt-0.5 text-sm text-navy-900">{v || "—"}</dd></div>
  );

  return (
    <>
      <Link href={`/f/${cid}/hr/angajati`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:underline"><ArrowLeft className="size-4" /> Angajați</Link>
      <PageHeader title={`${e.last_name} ${e.first_name}`} description={e.job_title ?? undefined}>
        <Badge tone={e.status === "activ" ? "green" : e.status === "suspendat" ? "amber" : "neutral"}>{EMPLOYEE_STATUS_LABEL[e.status]}</Badge>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="self-start">
          <CardHeader title="Date angajat" />
          {isStaff ? (
            <div className="p-5"><EmployeeForm companyId={cid} employee={e} priv={p} /></div>
          ) : (
            <>
              <dl className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
                {row("Departament", e.department)}
                {row("Contract", e.contract_no ? `${e.contract_no}${e.contract_date ? ` / ${formatDate(e.contract_date)}` : ""}` : null)}
                {row("Tip contract", e.contract_type)}
                {row("Normă", e.work_hours ? `${e.work_hours} ore/zi` : null)}
                {row("Data angajării", e.hire_date ? formatDate(e.hire_date) : null)}
                {row("Data încetării", e.end_date ? formatDate(e.end_date) : null)}
                {row("Email", e.email)}
                {row("Telefon", e.phone)}
              </dl>
              <div className="border-t border-line p-5">
                <p className="mb-3 text-sm font-semibold text-navy-900">Date personale</p>
                {access.viewPii ? (
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {row("CNP", p?.cnp)}
                    {row("Data nașterii", p?.birth_date ? formatDate(p.birth_date) : null)}
                    {row("Act de identitate", p?.id_series ? `${p.id_series} ${p.id_number ?? ""}` : null)}
                    {row("Valabil până la", p?.id_expiry ? formatDate(p.id_expiry) : null)}
                    <div className="sm:col-span-2">{row("Adresă", p?.address)}</div>
                  </dl>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted"><Lock className="size-4" /> Nu ai permisiunea de a vedea datele personale ale angajaților.</p>
                )}
              </div>
            </>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader title="Dosar digital" description="Contracte, acte adiționale, adeverințe și alte documente ale angajatului." />
          {docs.length ? <DocumentList docs={docs} names={names} companyId={cid} showCategory={catLabels} /> : <EmptyState title="Niciun document în dosar" />}
          <div className="border-t border-line p-5">
            <UploadZone compact companyId={cid} area="hr" direction={direction} year={now.year} month={now.month} employeeId={e.id}
              categories={categories.map((c) => ({ code: c.code, label: c.label, sensitive: c.sensitive_default }))}
              canMarkSensitive={isStaff} label="Adaugă documente în dosar" />
          </div>
        </Card>
      </div>
    </>
  );
}
