import Link from "next/link";
import { ClipboardList, Lock } from "lucide-react";
import { NewRequestDialog } from "@/components/request-form";
import { StatusBadge } from "@/components/status";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { loadNames } from "@/components/documents-board";
import type { getCompanyContext } from "@/lib/session";
import { AREA_LABEL, AREA_SEGMENT, OPEN_STATUSES, type Area, type RequestRow, type RequestType } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Ctx = Awaited<ReturnType<typeof getCompanyContext>>;

export async function RequestsBoard({ ctx, area, filter }: { ctx: Ctx; area: Area; filter: "deschise" | "toate" }) {
  const { supabase, company, access } = ctx;
  let query = supabase.from("requests").select("*").eq("company_id", company.id).eq("area", area)
    .order("created_at", { ascending: false }).limit(200);
  if (filter === "deschise") query = query.in("status", OPEN_STATUSES);

  const [{ data: rows }, { data: types }, { data: emps }] = await Promise.all([
    query,
    supabase.from("request_types").select("*").eq("area", area).eq("is_active", true).order("sort"),
    area === "hr"
      ? supabase.from("employees").select("id, last_name, first_name").eq("company_id", company.id).neq("status", "incetat").order("last_name")
      : Promise.resolve({ data: [] as { id: string; last_name: string; first_name: string }[] }),
  ]);
  const requests = (rows ?? []) as RequestRow[];
  const allowedTypes = ((types ?? []) as RequestType[]).filter((t) => !t.sensitive || access.sensitive[area]);
  const names = await loadNames(supabase, requests.flatMap((r) => [r.created_by, r.assigned_to]));
  const base = `/f/${company.id}/${AREA_SEGMENT[area]}/solicitari`;

  return (
    <>
      <PageHeader
        title={`Solicitări ${AREA_LABEL[area]}`}
        description={area === "hr"
          ? "Adeverințe, angajări, modificări și încetări de contract."
          : "Balanțe, fișe de partener, situații de taxe, certificate și alte rapoarte."}
      >
        <NewRequestDialog
          companyId={company.id} area={area} types={allowedTypes}
          employees={(emps ?? []).map((e) => ({ id: e.id, name: `${e.last_name} ${e.first_name}` }))}
        />
      </PageHeader>

      <div className="mb-4 flex gap-1 text-sm">
        {(["deschise", "toate"] as const).map((f) => (
          <Link key={f} href={`${base}?arata=${f}`}
            className={cn("rounded-full px-3 py-1.5 font-medium", filter === f ? "bg-navy-900 text-white" : "text-navy-700 hover:bg-navy-50")}>
            {f === "deschise" ? "În desfășurare" : "Toate"}
          </Link>
        ))}
      </div>

      <Card>
        {requests.length === 0 ? (
          <EmptyState icon={<ClipboardList />} title={filter === "deschise" ? "Nicio solicitare în desfășurare" : "Nicio solicitare"}>
            Folosește butonul „Solicitare nouă” pentru a cere un document sau un raport.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr><Th>Solicitare</Th><Th>Status</Th><Th>Trimisă</Th><Th>Termen de răspuns</Th><Th>Responsabil</Th></tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-navy-50/40">
                  <Td>
                    <Link href={`/f/${company.id}/solicitari/${r.id}`} className="font-medium text-navy-900 hover:underline">{r.title}</Link>
                    <p className="text-xs text-muted">
                      {names.get(r.created_by ?? "") ?? "—"}
                      {r.sensitive ? <Badge tone="gold" className="ml-2"><Lock className="size-3" /> Restricționat</Badge> : null}
                    </p>
                  </Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td className="whitespace-nowrap">{formatDate(r.created_at)}</Td>
                  <Td className="whitespace-nowrap">{formatDate(r.due_at)}</Td>
                  <Td>{names.get(r.assigned_to ?? "") ?? "Nealocat"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
