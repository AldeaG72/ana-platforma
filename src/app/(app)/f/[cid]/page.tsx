import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, MinusCircle } from "lucide-react";
import { DocumentList, loadNames } from "@/components/documents-board";
import { StatusBadge } from "@/components/status";
import { Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { loadChecklist } from "@/lib/checklist";
import { getCompanyContext } from "@/lib/session";
import { AREA_LABEL, OPEN_STATUSES, type DocumentRow, type RequestRow } from "@/lib/types";
import { formatDate, formatMoney, periodLabel, workPeriod } from "@/lib/utils";

export default async function CompanyDashboard({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await getCompanyContext(cid);
  const { supabase, company, access, profile } = ctx;
  const period = workPeriod();

  const [checklist, { data: reqs }, { data: delivered }, { data: snaps }] = await Promise.all([
    loadChecklist(ctx, period.year, period.month),
    supabase.from("requests").select("*").eq("company_id", cid).in("status", OPEN_STATUSES).order("created_at", { ascending: false }).limit(6),
    supabase.from("documents").select("*").eq("company_id", cid).eq("direction", access.isStaff ? "de_la_client" : "de_la_gana")
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(6),
    access.sensitive.accounting
      ? supabase.from("financial_snapshots").select("*").eq("company_id", cid).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as Record<string, number>[] }),
  ]);
  const requests = (reqs ?? []) as RequestRow[];
  const docs = (delivered ?? []) as DocumentRow[];
  const names = await loadNames(supabase, docs.map((d) => d.uploaded_by));
  const snap = snaps?.[0];
  const done = checklist.filter((c) => c.state !== "lipsa").length;
  const first = (profile.full_name || "").split(" ")[0];

  return (
    <>
      <PageHeader title={first ? `Bună, ${first}` : "Panou"} description={`${company.name}${company.cui ? ` · CUI ${company.cui}` : ""}`} />

      {snap ? (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Situația lunii {periodLabel(snap.period_year, snap.period_month)}</h2>
            <Link href={`/f/${cid}/contabilitate/situatie`} className="flex items-center gap-1 text-sm font-medium text-navy-700 hover:underline">Vezi evoluția <ArrowRight className="size-4" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Venituri", snap.revenue], ["Cheltuieli", snap.expenses], ["Profit estimat", snap.profit], ["Taxe de plată", snap.taxes_due],
            ].map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
                <p className="tabular mt-1 text-xl font-semibold text-navy-900 sm:text-2xl">{formatMoney(value as number)}</p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`Checklist ${periodLabel(period.year, period.month)}`}
            description={checklist.length ? `${done} din ${checklist.length} elemente rezolvate` : undefined}
            action={<Button asChild variant="outline" size="sm"><Link href={`/f/${cid}/checklist`}>Deschide</Link></Button>}
          />
          {checklist.length === 0 ? (
            <EmptyState title="Checklistul nu este configurat" />
          ) : (
            <>
              <div className="mx-5 mt-4 h-2 overflow-hidden rounded-full bg-navy-50">
                <div className="h-full rounded-full bg-gold-500" style={{ width: `${(done / checklist.length) * 100}%` }} />
              </div>
              <ul className="p-5 pt-3">
                {checklist.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                    {c.state === "lipsa" ? <Circle className="size-4 text-navy-100" /> : c.state === "nu_e_cazul" ? <MinusCircle className="size-4 text-muted" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
                    <span className={c.state === "lipsa" ? "font-medium text-navy-900" : "text-muted"}>{c.label}</span>
                    <span className="ml-auto text-xs text-muted">
                      {c.state === "lipsa" ? (c.dueDate ? `până la ${formatDate(c.dueDate)}` : "lipsește") : c.state === "nu_e_cazul" ? "nu e cazul" : c.docCount ? `${c.docCount} ${c.docCount === 1 ? "fișier" : "fișiere"}` : "bifat"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Solicitări în desfășurare" description={requests.length ? undefined : "Nu ai solicitări deschise."} />
          {requests.length ? (
            <ul className="divide-y divide-line/70">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/f/${cid}/solicitari/${r.id}`} className="block truncate text-sm font-medium text-navy-900 hover:underline">{r.title}</Link>
                    <p className="text-xs text-muted">{AREA_LABEL[r.area]} · termen {formatDate(r.due_at)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Totul este la zi">Solicitările noi le trimiți din meniul Contabilitate sau HR & Payroll.</EmptyState>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={access.isStaff ? "Ultimele documente trimise de client" : "Ultimele documente primite de la Gana"} />
          {docs.length ? <DocumentList docs={docs} names={names} companyId={cid} /> : <EmptyState title="Niciun document încă" />}
        </Card>
      </div>
    </>
  );
}
