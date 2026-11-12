import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { DocumentList, loadNames } from "@/components/documents-board";
import { StatusControl } from "@/components/status";
import { Thread } from "@/components/thread";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { UploadZone } from "@/components/upload-zone";
import { getCompanyContext } from "@/lib/session";
import { AREA_LABEL, AREA_SEGMENT, type DocCategory, type DocumentRow, type RequestRow, type RequestType } from "@/lib/types";
import { formatDate, formatDateTime, isUuid } from "@/lib/utils";

export const metadata = { title: "Solicitare" };

export default async function RequestPage({ params }: { params: Promise<{ cid: string; rid: string }> }) {
  const { cid, rid } = await params;
  const ctx = await getCompanyContext(cid);
  if (!isUuid(rid)) notFound();
  const { supabase, access } = ctx;
  const { data } = await supabase.from("requests").select("*").eq("id", rid).eq("company_id", cid).maybeSingle();
  if (!data) notFound();
  const req = data as RequestRow;

  const [{ data: type }, { data: files }, { data: cats }] = await Promise.all([
    supabase.from("request_types").select("*").eq("code", req.type_code).maybeSingle(),
    supabase.from("documents").select("*").eq("request_id", rid).is("deleted_at", null).order("created_at"),
    supabase.from("document_categories").select("*").eq("area", req.area).order("sort"),
  ]);
  const docs = (files ?? []) as DocumentRow[];
  const names = await loadNames(supabase, [req.created_by, req.assigned_to, ...docs.map((d) => d.uploaded_by)]);
  const fields = ((type as RequestType | null)?.fields ?? []).filter((f) => req.details[f.name]);
  const isStaff = access.staff[req.area];
  const direction = isStaff ? "de_la_gana" : "de_la_client";
  const categories = ((cats ?? []) as DocCategory[]).filter((c) => c.direction === direction && !["pontaj", "pontaj_justificative"].includes(c.code));
  // categoria implicită: „Alte documente” pentru client, prima potrivită pentru Gana
  const preferred = isStaff ? (req.type_code.startsWith("adeverinta") ? "adeverinte" : null) : req.type_code === "angajare_noua" ? "dosar_angajare" : req.area === "hr" ? "alte_hr" : "alte_contabilitate";
  categories.sort((a, b) => Number(b.code === preferred) - Number(a.code === preferred));
  const created = new Date(req.created_at);
  const catLabels = new Map(((cats ?? []) as DocCategory[]).map((c) => [c.code, c.label]));

  return (
    <>
      <Link href={`/f/${cid}/${AREA_SEGMENT[req.area]}/solicitari`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:underline">
        <ArrowLeft className="size-4" /> Solicitări {AREA_LABEL[req.area]}
      </Link>
      <PageHeader title={req.title} description={`Trimisă de ${names.get(req.created_by ?? "") ?? "—"} · ${formatDateTime(req.created_at)}`}>
        {req.sensitive ? <Badge tone="gold"><Lock className="size-3" /> Restricționat</Badge> : null}
        <StatusControl kind="request" id={req.id} companyId={cid} status={req.status} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {req.message || fields.length ? (
            <Card>
              <CardHeader title="Detaliile solicitării" />
              <dl className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.name}>
                    <dt className="text-xs font-medium tracking-wide text-muted uppercase">{f.label}</dt>
                    <dd className="mt-0.5 text-sm text-navy-900">{f.type === "date" ? formatDate(req.details[f.name]) : req.details[f.name]}</dd>
                  </div>
                ))}
                {req.message ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium tracking-wide text-muted uppercase">Mesaj</dt>
                    <dd className="mt-0.5 text-sm whitespace-pre-wrap text-navy-900">{req.message}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Fișiere atașate" description={isStaff ? "Încarcă aici documentul cerut; clientul îl poate descărca imediat." : "Documentele livrate de Gana apar aici. Poți atașa și tu fișiere."} />
            {docs.length ? <DocumentList docs={docs} names={names} companyId={cid} showCategory={catLabels} /> : <EmptyState title="Niciun fișier atașat" />}
            <div className="border-t border-line p-5">
              <UploadZone
                compact companyId={cid} area={req.area} direction={direction}
                year={created.getFullYear()} month={created.getMonth() + 1} requestId={req.id}
                categories={categories.map((c) => ({ code: c.code, label: c.label }))}
                label="Atașează fișiere la această solicitare"
              />
            </div>
          </Card>

          <Thread ctx={ctx} requestId={req.id} />
        </div>

        <Card className="self-start">
          <CardHeader title="Sumar" />
          <dl className="flex flex-col gap-3 p-5 text-sm">
            {[
              ["Zonă", AREA_LABEL[req.area]],
              ["Tip", (type as RequestType | null)?.label ?? req.type_code],
              ["Responsabil Gana", names.get(req.assigned_to ?? "") ?? "Nealocat"],
              ["Termen de răspuns", formatDate(req.due_at)],
              ["Închisă la", req.closed_at ? formatDateTime(req.closed_at) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt><dd className="text-right font-medium text-navy-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
