import { DocumentsBoard } from "@/components/documents-board";
import { PeriodPicker } from "@/components/period-picker";
import { PageHeader } from "@/components/ui";
import { requireArea } from "@/lib/session";
import { parsePeriod } from "@/lib/utils";

export const metadata = { title: "Documente contabilitate" };

export default async function Page({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string>> }) {
  const ctx = await requireArea((await params).cid, "accounting");
  const { year, month } = parsePeriod(await searchParams);
  return (
    <>
      <PageHeader title="Documente contabilitate" description="Facturi, extrase, registru de casă și celelalte documente ale lunii, organizate pe categorii.">
        <PeriodPicker year={year} month={month} />
      </PageHeader>
      <DocumentsBoard ctx={ctx} area="accounting" year={year} month={month} />
    </>
  );
}
