import Link from "next/link";
import { FileText, Lock } from "lucide-react";
import { DownloadButton } from "@/components/doc-actions";
import { StatusControl } from "@/components/status";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { UploadZone } from "@/components/upload-zone";
import type { getCompanyContext } from "@/lib/session";
import type { Area, Direction, DocCategory, DocumentRow } from "@/lib/types";
import { formatBytes, formatDateTime, periodLabel } from "@/lib/utils";

type Ctx = Awaited<ReturnType<typeof getCompanyContext>>;

export async function loadNames(supabase: Ctx["supabase"], ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.from("profiles").select("id, full_name, email, internal_role").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, `${p.full_name || p.email}${p.internal_role ? " (Gana)" : ""}`]));
}

export function DocumentList({ docs, names, companyId, showCategory }: {
  docs: DocumentRow[]; names: Map<string, string>; companyId: string; showCategory?: Map<string, string>;
}) {
  return (
    <ul className="divide-y divide-line/70">
      {docs.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <FileText className="size-5 shrink-0 text-navy-600" />
          <div className="min-w-0 flex-1 basis-48">
            <Link href={`/f/${companyId}/documente/${d.id}`} className="block truncate text-sm font-medium text-navy-900 hover:underline">
              {d.file_name}
            </Link>
            <p className="truncate text-xs text-muted">
              {showCategory ? `${showCategory.get(d.category) ?? d.category} · ` : ""}
              {formatBytes(d.size_bytes)} · {names.get(d.uploaded_by ?? "") ?? "—"} · {formatDateTime(d.created_at)}
            </p>
          </div>
          {d.sensitive ? <Badge tone="gold" title="Vizibil doar utilizatorilor cu acces la date sensibile"><Lock className="size-3" /> Restricționat</Badge> : null}
          <StatusControl kind="document" id={d.id} companyId={companyId} status={d.status} />
          <DownloadButton id={d.id} />
        </li>
      ))}
    </ul>
  );
}

/** Documentele unei zone pentru o lună: ce a trimis clientul și ce a livrat Gana. */
export async function DocumentsBoard({ ctx, area, year, month, only, exclude }: {
  ctx: Ctx; area: Area; year: number; month: number; only?: string[]; exclude?: string[];
}) {
  const { supabase, company, access } = ctx;
  const [{ data: cats }, { data: rows }] = await Promise.all([
    supabase.from("document_categories").select("*").eq("area", area).order("sort"),
    supabase.from("documents").select("*").eq("company_id", company.id).eq("area", area)
      .eq("period_year", year).eq("period_month", month).is("deleted_at", null).is("request_id", null)
      .order("created_at", { ascending: false }),
  ]);
  const categories = ((cats ?? []) as DocCategory[]).filter((c) => (!only || only.includes(c.code)) && !exclude?.includes(c.code));
  const docs = ((rows ?? []) as DocumentRow[]).filter((d) => categories.some((c) => c.code === d.category));
  const names = await loadNames(supabase, docs.map((d) => d.uploaded_by));
  const isStaff = access.staff[area];

  const section = (direction: Direction) => {
    const list = categories.filter((c) => c.direction === direction);
    if (!list.length) return null;
    const mine = direction === "de_la_client" ? !isStaff : isStaff;
    const fromGana = direction === "de_la_gana";
    const count = docs.filter((d) => d.direction === direction).length;
    return (
      <Card>
        <CardHeader
          title={fromGana ? "Primite de la Gana" : isStaff ? "Trimise de client" : "Trimise de tine către Gana"}
          description={`${periodLabel(year, month)} · ${count} ${count === 1 ? "document" : "documente"}`}
        />
        {mine ? (
          <div className="border-b border-line p-5">
            <UploadZone
              companyId={company.id} area={area} direction={direction} year={year} month={month}
              categories={list.map((c) => ({ code: c.code, label: c.label, hint: c.hint, sensitive: c.sensitive_default }))}
              canMarkSensitive={isStaff}
            />
          </div>
        ) : null}
        {fromGana && !access.sensitive[area] ? (
          <p className="flex items-center gap-2 border-b border-line bg-gold-50 px-5 py-2.5 text-xs text-gold-600">
            <Lock className="size-3.5" /> Documentele cu date {area === "hr" ? "salariale" : "financiare"} sunt vizibile doar utilizatorilor cu această permisiune.
          </p>
        ) : null}
        {count === 0 ? (
          <EmptyState title="Niciun document în această lună">
            {mine ? "Încarcă primul document folosind zona de mai sus." : fromGana ? "Aici vor apărea documentele livrate de echipa Gana." : "Clientul nu a încărcat încă documente."}
          </EmptyState>
        ) : (
          list.map((c) => {
            const items = docs.filter((d) => d.category === c.code);
            if (!items.length) return null;
            return (
              <div key={c.code}>
                <p className="bg-navy-50/60 px-5 py-2 text-xs font-semibold tracking-wide text-navy-700 uppercase">{c.label} · {items.length}</p>
                <DocumentList docs={items} names={names} companyId={company.id} />
              </div>
            );
          })
        )}
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {section("de_la_client")}
      {section("de_la_gana")}
    </div>
  );
}
