import { Bell } from "lucide-react";
import { markNotificationsRead, openNotification } from "@/app/actions/work";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Notificări" };

export default async function NotificationsPage() {
  const { supabase } = await getSession();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const list = data ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader title="Notificări" description={unread ? `${unread} necitite` : "Ești la zi."}>
        {unread ? <ActionForm action={markNotificationsRead}><SubmitButton variant="outline">Marchează toate ca citite</SubmitButton></ActionForm> : null}
      </PageHeader>
      <Card>
        {list.length === 0 ? <EmptyState icon={<Bell />} title="Nicio notificare">Aici apar documentele noi, schimbările de status, comentariile și reminderele de checklist.</EmptyState> : (
          <ul className="divide-y divide-line/70">
            {list.map((n) => (
              <li key={n.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={n.id} /><input type="hidden" name="link" value={n.link ?? "/"} />
                  <button className={cn("flex w-full cursor-pointer items-start gap-3 px-5 py-3.5 text-left hover:bg-navy-50/50", !n.read_at && "bg-gold-50/60")}>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-gold-500")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm text-navy-900", !n.read_at && "font-semibold")}>{n.title}</span>
                      <span className="block text-xs text-muted">{n.body ? `${n.body} · ` : ""}{formatDateTime(n.created_at)}</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
