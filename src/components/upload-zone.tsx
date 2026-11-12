"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { registerDocuments, replaceDocument, type UploadedFile } from "@/app/actions/work";
import { createClient } from "@/lib/supabase/client";
import type { Area, Direction } from "@/lib/types";
import { cn, sanitizeFileName } from "@/lib/utils";

const MAX_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 50;
const ALLOWED = ["pdf", "jpg", "jpeg", "png", "heic", "webp", "xls", "xlsx", "csv", "doc", "docx", "txt", "xml", "zip", "mt940", "sta"];

export type UploadCategory = { code: string; label: string; hint?: string | null; sensitive?: boolean };

/**
 * Încărcare directă din browser în Supabase Storage (fără a trece prin funcțiile Vercel),
 * urmată de înregistrarea documentelor în baza de date.
 */
export function UploadZone({
  companyId, area, direction, year, month, categories, requestId, employeeId, replaceId, canMarkSensitive, compact, label,
}: {
  companyId: string; area: Area; direction: Direction; year: number; month: number;
  categories: UploadCategory[]; requestId?: string; employeeId?: string;
  /** dacă este setat, fișierul ales înlocuiește documentul existent */
  replaceId?: string;
  canMarkSensitive?: boolean; compact?: boolean; label?: string;
}) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [category, setCategory] = React.useState(categories[0]?.code ?? "");
  const current = categories.find((c) => c.code === category);
  const [sensitive, setSensitive] = React.useState(!!current?.sensitive);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [over, setOver] = React.useState(false);

  React.useEffect(() => setSensitive(!!categories.find((c) => c.code === category)?.sensitive), [category, categories]);

  async function handle(list: FileList | null) {
    if (!list?.length || progress) return;
    let files = Array.from(list);
    if (replaceId) files = files.slice(0, 1);
    if (files.length > MAX_FILES) return toast.error(`Poți încărca cel mult ${MAX_FILES} de fișiere odată.`);
    const bad = files.find((f) => f.size > MAX_SIZE || !ALLOWED.includes(f.name.split(".").pop()?.toLowerCase() ?? ""));
    if (bad) return toast.error(`„${bad.name}” nu poate fi încărcat: ${bad.size > MAX_SIZE ? "depășește 50 MB" : "tip de fișier neacceptat"}.`);

    const supabase = createClient();
    const uploaded: UploadedFile[] = [];
    const failed: string[] = [];
    setProgress({ done: 0, total: files.length });
    for (const file of files) {
      const path = `${companyId}/${area}/${year}/${String(month).padStart(2, "0")}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage.from("documente").upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) failed.push(file.name);
      else uploaded.push({ path, name: file.name, size: file.size, mime: file.type });
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    if (uploaded.length) {
      const res = replaceId
        ? await replaceDocument({ id: replaceId, companyId, file: uploaded[0] })
        : await registerDocuments({ companyId, area, direction, category, year, month, files: uploaded, requestId, employeeId, sensitive });
      if (res?.error) toast.error(res.error);
      else toast.success(replaceId ? "Fișierul a fost înlocuit." : uploaded.length === 1 ? "Fișierul a fost încărcat." : `${uploaded.length} fișiere încărcate.`);
    }
    if (failed.length) toast.error(`Nu s-au putut încărca: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}`);
    setProgress(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.length > 1 || canMarkSensitive ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {categories.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium text-navy-900">Categorie</span>
              <select className="h-9 rounded-md border border-line bg-white px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
          ) : null}
          {canMarkSensitive ? (
            <label className="flex items-center gap-2 text-sm text-navy-900">
              <input type="checkbox" className="size-4 accent-navy-900" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} />
              Vizibil doar utilizatorilor cu acces la date {area === "hr" ? "salariale" : "financiare"}
            </label>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!!progress}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-navy-100 bg-navy-50/50 text-center transition-colors hover:border-gold-500 hover:bg-gold-50 disabled:cursor-wait",
          compact ? "px-4 py-4" : "px-6 py-8",
          over && "border-gold-500 bg-gold-50",
        )}
      >
        {progress ? <Loader2 className="size-6 animate-spin text-navy-700" /> : <UploadCloud className="size-6 text-navy-700" />}
        <span className="text-sm font-medium text-navy-900">
          {progress ? `Se încarcă ${progress.done} din ${progress.total}…` : label ?? (replaceId ? "Alege fișierul nou" : "Trage fișierele aici sau apasă pentru a alege")}
        </span>
        {!compact && !progress ? (
          <span className="text-xs text-muted">{current?.hint ? `${current.hint}. ` : ""}PDF, imagini, Excel, CSV, MT940, XML — maximum 50 MB per fișier</span>
        ) : null}
      </button>
      <input ref={input} type="file" multiple={!replaceId} hidden onChange={(e) => handle(e.target.files)}
        accept={ALLOWED.map((e) => `.${e}`).join(",")} />
    </div>
  );
}
