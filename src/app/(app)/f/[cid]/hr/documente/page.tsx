import { DocumentsBoard } from "@/components/documents-board";
import { PeriodPicker } from "@/components/period-picker";
import { PageHeader } from "@/components/ui";
import { requireArea } from "@/lib/session";
import { parsePeriod } from "@/lib/utils";

export const metadata = { title: "Documente HR" };

export default async function Page({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireArea((await params).cid, "hr");
  const { year, month } = parsePeriod(await searchParams);
  return (
    <>
      <PageHeader title="Documente HR & Payroll" description="State de plată, centralizatoare, fluturași și documentele de personal ale lunii.">
        <PeriodPicker year={year} month={month} />
      </PageHeader>
      <DocumentsBoard ctx={ctx} area="hr" year={year} month={month} exclude={["pontaj", "pontaj_justificative"]} />
    </>
  );
}
