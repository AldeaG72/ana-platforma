import { Download } from "lucide-react";
import { DocumentsBoard } from "@/components/documents-board";
import { PeriodPicker } from "@/components/period-picker";
import { Button, Card, PageHeader } from "@/components/ui";
import { requireArea } from "@/lib/session";
import { parsePeriod, periodLabel } from "@/lib/utils";

export const metadata = { title: "Pontaj" };

export default async function Page({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const { cid } = await params;
  const ctx = await requireArea(cid, "hr");
  const { year, month } = parsePeriod(await searchParams);
  return (
    <>
      <PageHeader title="Pontaj lunar" description="Descarcă șablonul, completează-l și încarcă-l împreună cu documentele justificative.">
        <PeriodPicker year={year} month={month} />
      </PageHeader>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold text-navy-900">1. Șablonul de pontaj pentru {periodLabel(year, month)}</p>
          <p className="mt-0.5 text-sm text-muted">Fișier Excel precompletat cu angajații activi ai firmei și zilele lunii.</p>
        </div>
        <Button asChild variant="gold">
          <a href={`/api/sabloane/pontaj?firma=${cid}&an=${year}&luna=${month}`}><Download /> Descarcă șablonul</a>
        </Button>
      </Card>

      <p className="mb-3 font-semibold text-navy-900">2. Încarcă pontajul completat și documentele justificative</p>
      <DocumentsBoard ctx={ctx} area="hr" year={year} month={month} only={["pontaj", "pontaj_justificative"]} />
    </>
  );
}
