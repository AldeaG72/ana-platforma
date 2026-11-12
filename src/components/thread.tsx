import { MessageSquare } from "lucide-react";
import { addComment } from "@/app/actions/work";
import { loadNames } from "@/components/documents-board";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Textarea } from "@/components/ui";
import type { getCompanyContext } from "@/lib/session";
import { STATUS_LABEL, type WorkStatus } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

type Ctx = Awaited<ReturnType<typeof getCompanyContext>>;

/** Discuția și istoricul de statusuri, lipite de un document sau de o solicitare. */
export async function Thread({ ctx, documentId, requestId }: { ctx: Ctx; documentId?: string; requestId?: string }) {
  const { supabase, company, profile } = ctx;
  const col = documentId ? "document_id" : "request_id";
  const id = (documentId ?? requestId)!;
  const [{ data: comments }, { data: history }] = await Promise.all([
    supabase.from("comments").select("id, author_id, body, created_at").eq(col, id).order("created_at"),
    supabase.from("status_history").select("id, from_status, to_status, changed_by, changed_at").eq(col, id).order("changed_at"),
  ]);
  const names = await loadNames(supabase, [...(comments ?? []).map((c) => c.author_id), ...(history ?? []).map((h) => h.changed_by)]);

  const events = [
    ...(comments ?? []).map((c) => ({ kind: "comment" as const, at: c.created_at as string, who: c.author_id as string | null, body: c.body as string, key: `c${c.id}` })),
    ...(history ?? []).filter((h) => h.from_status).map((h) => ({
      kind: "status" as const, at: h.changed_at as string, who: h.changed_by as string | null,
      body: `a schimbat statusul: ${STATUS_LABEL[h.from_status as WorkStatus]} → ${STATUS_LABEL[h.to_status as WorkStatus]}`, key: `s${h.id}`,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <Card>
      <CardHeader title="Discuție" description="Mesajele sunt vizibile echipei Gana și utilizatorilor firmei care au acces la acest element." />
      <div className="flex flex-col gap-4 p-5">
        {events.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted"><MessageSquare className="size-4" /> Niciun mesaj încă.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((e) =>
              e.kind === "status" ? (
                <li key={e.key} className="text-center text-xs text-muted">
                  {names.get(e.who ?? "") ?? "Sistem"} {e.body} · {formatDateTime(e.at)}
                </li>
              ) : (
                <li key={e.key} className={cn("flex flex-col", e.who === profile.id ? "items-end" : "items-start")}>
                  <div className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap", e.who === profile.id ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-900")}>
                    {e.body}
                  </div>
                  <span className="mt-1 text-xs text-muted">{names.get(e.who ?? "") ?? "—"} · {formatDateTime(e.at)}</span>
                </li>
              ),
            )}
          </ol>
        )}
        <ActionForm action={addComment} className="flex flex-col gap-2 border-t border-line pt-4">
          <input type="hidden" name="company_id" value={company.id} />
          <input type="hidden" name={col} value={id} />
          <Textarea name="body" placeholder="Scrie un mesaj…" required maxLength={5000} className="min-h-20" />
          <div className="flex justify-end"><SubmitButton>Trimite mesajul</SubmitButton></div>
        </ActionForm>
      </div>
    </Card>
  );
}
