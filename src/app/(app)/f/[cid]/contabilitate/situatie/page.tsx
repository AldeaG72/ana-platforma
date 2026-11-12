import { notFound } from "next/navigation";
import { saveSnapshot } from "@/app/actions/manage";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PeriodPicker } from "@/components/period-picker";
import { Card, CardHeader, Field, Input, PageHeader, Table, Td, Textarea, Th } from "@/components/ui";
import { requireArea } from "@/lib/session";
import { MONTHS, cn, currentPeriod, formatDateTime, formatMoney, parsePeriod, periodLabel } from "@/lib/utils";

export const metadata = { title: "Situație financiară" };

type Snap = { period_month: number; revenue: number; expenses: number; profit: number; taxes_due: number; note: string | null; updated_at: string };

export default async function Page({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const ctx = await requireArea(cid, "accounting");
  if (!ctx.access.sensitive.accounting) notFound();
  const sp = await searchParams;
  const { year, month } = parsePeriod({ an: sp.an ?? String(currentPeriod().year), luna: sp.luna });

  const { data } = await ctx.supabase.from("financial_snapshots").select("*").eq("company_id", cid).eq("period_year", year).order("period_month");
  const snaps = (data ?? []) as Snap[];
  const byMonth = new Map(snaps.map((s) => [s.period_month, s]));
  const selected = byMonth.get(month);
  const max = Math.max(1, ...snaps.flatMap((s) => [Number(s.revenue), Number(s.expenses)]));
  const total = (k: "revenue" | "expenses" | "profit" | "taxes_due") => snaps.reduce((sum, s) => sum + Number(s[k]), 0);
  const isStaff = ctx.access.staff.accounting;

  return (
    <>
      <PageHeader title="Situație financiară" description="Cifrele lunare, actualizate de contabilul tău după închiderea fiecărei luni.">
        <PeriodPicker year={year} month={month} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([["Venituri", "revenue"], ["Cheltuieli", "expenses"], ["Profit estimat", "profit"], ["Taxe de plată", "taxes_due"]] as const).map(([label, key]) => (
          <Card key={key} className="p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{label} · {MONTHS[month - 1]}</p>
            <p className={cn("tabular mt-1 text-xl font-semibold sm:text-2xl", key === "profit" && selected && Number(selected.profit) < 0 ? "text-red-700" : "text-navy-900")}>
              {selected ? formatMoney(selected[key]) : "—"}
            </p>
          </Card>
        ))}
      </div>
      {selected?.note ? <Card className="mb-6 p-4 text-sm"><span className="font-medium">Nota contabilului: </span>{selected.note}</Card> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title={`Evoluție ${year}`} description="Venituri și cheltuieli pe luni." />
          <div className="flex h-44 items-end gap-1.5 px-5 pt-5 sm:gap-3" role="img" aria-label={`Grafic venituri și cheltuieli ${year}`}>
            {MONTHS.map((m, i) => {
              const s = byMonth.get(i + 1);
              return (
                <div key={m} className="flex h-full flex-1 flex-col justify-end gap-1">
                  <div className="flex h-full items-end gap-0.5">
                    <div className="flex-1 rounded-t bg-navy-900" style={{ height: `${s ? (Number(s.revenue) / max) * 100 : 0}%` }} title={s ? `Venituri ${m}: ${formatMoney(s.revenue)}` : undefined} />
                    <div className="flex-1 rounded-t bg-gold-500" style={{ height: `${s ? (Number(s.expenses) / max) * 100 : 0}%` }} title={s ? `Cheltuieli ${m}: ${formatMoney(s.expenses)}` : undefined} />
                  </div>
                  <span className={cn("text-center text-[10px] text-muted", i + 1 === month && "font-bold text-navy-900")}>{m.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 px-5 py-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-navy-900" /> Venituri</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-gold-500" /> Cheltuieli</span>
          </div>
          <Table>
            <thead><tr><Th>Luna</Th><Th className="text-right">Venituri</Th><Th className="text-right">Cheltuieli</Th><Th className="text-right">Profit estimat</Th><Th className="text-right">Taxe de plată</Th></tr></thead>
            <tbody className="tabular">
              {MONTHS.map((m, i) => {
                const s = byMonth.get(i + 1);
                return (
                  <tr key={m} className={cn(i + 1 === month && "bg-gold-50")}>
                    <Td><a className="font-medium hover:underline" href={`?an=${year}&luna=${i + 1}`}>{m}</a></Td>
                    <Td className="text-right">{s ? formatMoney(s.revenue) : "—"}</Td>
                    <Td className="text-right">{s ? formatMoney(s.expenses) : "—"}</Td>
                    <Td className={cn("text-right", s && Number(s.profit) < 0 && "text-red-700")}>{s ? formatMoney(s.profit) : "—"}</Td>
                    <Td className="text-right">{s ? formatMoney(s.taxes_due) : "—"}</Td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <Td>Total {year}</Td>
                <Td className="text-right">{formatMoney(total("revenue"))}</Td>
                <Td className="text-right">{formatMoney(total("expenses"))}</Td>
                <Td className="text-right">{formatMoney(total("profit"))}</Td>
                <Td className="text-right">{formatMoney(total("taxes_due"))}</Td>
              </tr>
            </tbody>
          </Table>
        </Card>

        {isStaff ? (
          <Card className="self-start">
            <CardHeader title={`Actualizează ${periodLabel(year, month)}`} description={selected ? `Ultima modificare: ${formatDateTime(selected.updated_at)}` : "Luna nu are încă date."} />
            <ActionForm key={`${year}-${month}`} action={saveSnapshot} resetOnDone={false} className="flex flex-col gap-3 p-5">
              <input type="hidden" name="company_id" value={cid} />
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={month} />
              <Field label="Venituri (lei)"><Input name="revenue" inputMode="decimal" defaultValue={selected?.revenue ?? ""} required /></Field>
              <Field label="Cheltuieli (lei)"><Input name="expenses" inputMode="decimal" defaultValue={selected?.expenses ?? ""} required /></Field>
              <Field label="Profit estimat (lei)" hint="Lasă gol pentru venituri minus cheltuieli."><Input name="profit" inputMode="decimal" defaultValue={selected?.profit ?? ""} /></Field>
              <Field label="Taxe de plată (lei)"><Input name="taxes_due" inputMode="decimal" defaultValue={selected?.taxes_due ?? ""} /></Field>
              <Field label="Notă pentru client"><Textarea name="note" defaultValue={selected?.note ?? ""} className="min-h-16" /></Field>
              <SubmitButton>Salvează</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
