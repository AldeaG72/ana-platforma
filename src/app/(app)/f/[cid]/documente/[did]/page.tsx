import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/work";
import { DownloadButton } from "@/components/doc-actions";
import { loadNames } from "@/components/documents-board";
import { ActionForm, ConfirmSubmit } from "@/components/forms";
import { StatusControl } from "@/components/status";
import { Thread } from "@/components/thread";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { UploadZone } from "@/components/upload-zone";
import { getCompanyContext } from "@/lib/session";
import { AREA_LABEL, AREA_SEGMENT, type DocumentRow } from "@/lib/types";
import { formatBytes, formatDateTime, isUuid, periodLabel } from "@/lib/utils";

export const metadata = { title: "Document" };

export default async function DocumentPage({ params }: { params: Promise<{ cid: string; did: string }> }) {
  const { cid, did } = await params;
  const ctx = await getCompanyContext(cid);
  if (!isUuid(did)) notFound();
  const { supabase, access } = ctx;
  const { data } = await supabase.from("documents").select("*").eq("id", did).eq("company_id", cid).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const doc = data as DocumentRow;
  const [{ data: cat }, names] = await Promise.all([
    supabase.from("document_categories").select("label").eq("code", doc.category).maybeSingle(),
    loadNames(supabase, [doc.uploaded_by]),
  ]);
  const isStaff = access.staff[doc.area];
  const pontaj = ["pontaj", "pontaj_justificative"].includes(doc.category);
  const back = doc.request_id
    ? `/f/${cid}/solicitari/${doc.request_id}`
    : `/f/${cid}/${AREA_SEGMENT[doc.area]}/${pontaj ? "pontaj" : "documente"}?an=${doc.period_year}&luna=${doc.period_month}`;

  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:underline">
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <PageHeader title={doc.file_name} description={`${cat?.label ?? doc.category} · ${periodLabel(doc.period_year, doc.period_month)}`}>
        {doc.sensitive ? <Badge tone="gold"><Lock className="size-3" /> Restricționat</Badge> : null}
        <StatusControl kind="document" id={doc.id} companyId={cid} status={doc.status} />
        <DownloadButton id={doc.id} label="Descarcă" />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0"><Thread ctx={ctx} documentId={doc.id} /></div>
        <div className="flex flex-col gap-6 self-start">
          <Card>
            <CardHeader title="Detalii" />
            <dl className="flex flex-col gap-3 p-5 text-sm">
              {[
                ["Zonă", AREA_LABEL[doc.area]],
                ["Sens", doc.direction === "de_la_gana" ? "De la Gana" : "De la client"],
                ["Dimensiune", formatBytes(doc.size_bytes)],
                ["Încărcat de", names.get(doc.uploaded_by ?? "") ?? "—"],
                ["Încărcat la", formatDateTime(doc.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt><dd className="text-right font-medium text-navy-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {isStaff ? (
            <Card>
              <CardHeader title="Administrare" description="Doar echipa Gana poate înlocui sau șterge documente. Operațiunile rămân în jurnalul de audit." />
              <div className="flex flex-col gap-4 p-5">
                <UploadZone compact companyId={cid} area={doc.area} direction={doc.direction} year={doc.period_year} month={doc.period_month}
                  categories={[{ code: doc.category, label: "" }]} replaceId={doc.id} label="Înlocuiește fișierul" />
                <ActionForm action={deleteDocument}>
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="company_id" value={cid} />
                  <input type="hidden" name="back" value={back} />
                  <ConfirmSubmit variant="danger" className="w-full" confirm={`Ștergi definitiv „${doc.file_name}”?`}><Trash2 /> Șterge documentul</ConfirmSubmit>
                </ActionForm>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
