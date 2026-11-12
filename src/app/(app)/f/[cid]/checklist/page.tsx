import Link from "next/link";
import { CheckCircle2, Circle, MinusCircle, Upload } from "lucide-react";
import { setChecklistEntry } from "@/app/actions/manage";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PeriodPicker } from "@/components/period-picker";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { loadChecklist, type ChecklistRow } from "@/lib/checklist";
import { getCompanyContext } from "@/lib/session";
import { AREA_LABEL, type Area } from "@/lib/types";
import { formatDate, parsePeriod, periodLabel } from "@/lib/utils";

export const metadata = { title: "Checklist lunar" };

export default async function ChecklistPage({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const ctx = await getCompanyContext(cid);
  const { year, month } = parsePeriod(await searchParams);
  const rows = await loadChecklist(ctx, year, month);
  const done = rows.filter((r) => r.state !== "lipsa").length;

  const uploadHref = (r: ChecklistRow) =>
    r.area === "accounting"
      ? `/f/${cid}/contabilitate/documente?an=${year}&luna=${month}`
      : `/f/${cid}/hr/${r.category_code?.startsWith("pontaj") ? "pontaj" : "documente"}?an=${year}&luna=${month}`;

  const mark = (r: ChecklistRow, state: string, label: string, variant: "outline" | "ghost" = "outline") => (
    <ActionForm action={setChecklistEntry}>
      <input type="hidden" name="company_id" value={cid} />
      <input type="hidden" name="item_id" value={r.id} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="state" value={state} />
      <SubmitButton variant={variant} size="sm">{label}</SubmitButton>
    </ActionForm>
  );

  return (
    <>
      <PageHeader title="Checklist lunar" description={`Ce a fost trimis și ce mai lipsește pentru ${periodLabel(year, month)}.`}>
        <PeriodPicker year={year} month={month} />
      </PageHeader>

      {rows.length === 0 ? (
        <Card><EmptyState title="Checklistul nu este configurat">Echipa Gana îl poate configura din Setări firmă.</EmptyState></Card>
      ) : (
        <>
          <Card className="mb-6 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-navy-900">{done} din {rows.length} elemente rezolvate</span>
              <span className="text-muted">{Math.round((done / rows.length) * 100)}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-navy-50">
              <div className="h-full rounded-full bg-gold-500" style={{ width: `${(done / rows.length) * 100}%` }} />
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            {(["accounting", "hr"] as Area[]).map((area) => {
              const list = rows.filter((r) => r.area === area);
              if (!list.length) return null;
              return (
                <Card key={area}>
                  <CardHeader title={AREA_LABEL[area]} />
                  <ul className="divide-y divide-line/70">
                    {list.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                        {r.state === "lipsa" ? <Circle className="size-5 shrink-0 text-navy-100" /> : r.state === "nu_e_cazul" ? <MinusCircle className="size-5 shrink-0 text-muted" /> : <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />}
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="text-sm font-medium text-navy-900">{r.label}</p>
                          <p className="text-xs text-muted">{r.dueDate ? `Termen: ${formatDate(r.dueDate)}` : "Fără termen"}</p>
                        </div>
                        {r.state === "incarcat" ? <Badge tone="green">{r.docCount} {r.docCount === 1 ? "fișier încărcat" : "fișiere încărcate"}</Badge> : null}
                        {r.state === "bifat" ? <Badge tone="green">Marcat ca trimis</Badge> : null}
                        {r.state === "nu_e_cazul" ? <Badge>Nu e cazul luna aceasta</Badge> : null}
                        {r.state === "lipsa" ? <Badge tone="amber">Lipsește</Badge> : null}
                        <div className="flex flex-wrap items-center gap-2">
                          {r.state === "lipsa" || r.state === "incarcat" ? (
                            <Button asChild variant={r.state === "lipsa" ? "primary" : "ghost"} size="sm"><Link href={uploadHref(r)}><Upload /> Încarcă</Link></Button>
                          ) : null}
                          {r.state === "lipsa" ? <>{mark(r, "nu_e_cazul", "Nu e cazul")}{mark(r, "bifat", "Marchează trimis", "ghost")}</> : null}
                          {r.state === "bifat" || r.state === "nu_e_cazul" ? mark(r, "sterge", "Anulează", "ghost") : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
