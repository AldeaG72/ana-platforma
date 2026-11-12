"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setStatus } from "@/app/actions/work";
import { Badge } from "@/components/ui";
import { STATUSES, STATUS_LABEL, type WorkStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE: Record<WorkStatus, "blue" | "gold" | "amber" | "green" | "neutral"> = {
  trimis: "blue", in_lucru: "gold", necesita_clarificari: "amber", finalizat: "green", anulat: "neutral",
};
const SELECT_TONE: Record<WorkStatus, string> = {
  trimis: "border-sky-200 bg-sky-50 text-sky-900",
  in_lucru: "border-gold-100 bg-gold-50 text-gold-600",
  necesita_clarificari: "border-amber-200 bg-amber-50 text-amber-900",
  finalizat: "border-emerald-200 bg-emerald-50 text-emerald-900",
  anulat: "border-navy-100 bg-navy-50 text-navy-700",
};

export function StatusBadge({ status }: { status: WorkStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Statusul poate fi schimbat de ambele părți; fiecare schimbare rămâne în istoric. */
export function StatusControl({ kind, id, companyId, status }: { kind: "document" | "request"; id: string; companyId: string; status: WorkStatus }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Status"
      disabled={pending}
      value={status}
      onChange={(e) => {
        const next = e.target.value as WorkStatus;
        start(async () => {
          const res = await setStatus({ kind, id, companyId, status: next });
          if (res?.error) toast.error(res.error);
          else toast.success(`Status: ${STATUS_LABEL[next]}`);
        });
      }}
      className={cn("h-8 cursor-pointer rounded-full border px-2.5 text-xs font-medium disabled:opacity-60", SELECT_TONE[status])}
    >
      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  );
}
