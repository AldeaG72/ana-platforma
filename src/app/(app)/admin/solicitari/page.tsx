import { notFound } from "next/navigation";
import { saveRequestType } from "@/app/actions/manage";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";
import { AREA_LABEL, type Area, type RequestType } from "@/lib/types";

export const metadata = { title: "Tipuri de solicitări" };

export default async function RequestTypesPage() {
  const { supabase, isSuperAdmin } = await getSession();
  if (!isSuperAdmin) notFound();
  const { data } = await supabase.from("request_types").select("*").order("area").order("sort");
  const types = (data ?? []) as RequestType[];

  return (
    <>
      <PageHeader title="Tipuri de solicitări" description="Termenul de răspuns (SLA) și vizibilitatea fiecărui tip de solicitare." />
      <div className="flex flex-col gap-6">
        {(["accounting", "hr"] as Area[]).map((area) => (
          <Card key={area}>
            <CardHeader title={AREA_LABEL[area]} description="„Restricționat” = doar utilizatorii cu acces la date financiare, respectiv salariale, pot trimite și vedea solicitarea." />
            <ul className="divide-y divide-line/70">
              {types.filter((t) => t.area === area).map((t) => (
                <li key={t.code} className="px-5 py-3">
                  <ActionForm action={saveRequestType} resetOnDone={false} className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <input type="hidden" name="code" value={t.code} />
                    <p className="min-w-0 flex-1 basis-56 text-sm font-medium text-navy-900">{t.label}</p>
                    <label className="flex items-center gap-2 text-sm">Termen <Input name="sla_days" type="number" min={0} max={60} defaultValue={t.sla_days} className="h-8 w-16" /> zile lucrătoare</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sensitive" defaultChecked={t.sensitive} className="size-4 accent-navy-900" /> Restricționat</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={t.is_active} className="size-4 accent-navy-900" /> Activ</label>
                    <SubmitButton variant="outline" size="sm">Salvează</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
