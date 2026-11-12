import Link from "next/link";
import { Download, FileSpreadsheet, Plus, UsersRound } from "lucide-react";
import { importEmployees } from "@/app/actions/manage";
import { Dialog } from "@/components/dialog";
import { EmployeeForm } from "@/components/employee-form";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Button, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireArea } from "@/lib/session";
import { EMPLOYEE_STATUS_LABEL, type Employee } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Angajați" };

export default async function EmployeesPage({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await requireArea(cid, "hr");
  const { data } = await ctx.supabase.from("employees").select("*").eq("company_id", cid).order("status").order("last_name");
  const employees = (data ?? []) as Employee[];
  const isStaff = ctx.access.staff.hr;

  return (
    <>
      <PageHeader title="Angajați" description="Lista angajaților și dosarul digital al fiecăruia. Lista este întreținută de specialistul HR Gana.">
        {isStaff ? (
          <>
            <Dialog title="Import angajați" description="Completează șablonul Excel (cap de tabel predefinit) și încarcă-l. Angajații cu CNP deja existent sunt actualizați."
              trigger={<Button variant="outline"><FileSpreadsheet /> Import Excel</Button>}>
              <div className="flex flex-col gap-4">
                <Button asChild variant="outline"><a href="/api/sabloane/angajati"><Download /> Descarcă șablonul</a></Button>
                <ActionForm action={importEmployees} className="flex flex-col gap-4">
                  <input type="hidden" name="company_id" value={cid} />
                  <input type="file" name="file" accept=".xlsx" required className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-medium file:text-navy-900" />
                  <div className="flex justify-end"><SubmitButton>Importă</SubmitButton></div>
                </ActionForm>
              </div>
            </Dialog>
            <Dialog wide title="Angajat nou" trigger={<Button><Plus /> Angajat nou</Button>}>
              <EmployeeForm companyId={cid} />
            </Dialog>
          </>
        ) : null}
      </PageHeader>

      <Card>
        {employees.length === 0 ? (
          <EmptyState icon={<UsersRound />} title="Niciun angajat înregistrat">
            {isStaff ? "Adaugă angajații manual sau importă-i din șablonul Excel." : "Lista va fi completată de specialistul HR Gana."}
          </EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Angajat</Th><Th>Funcție</Th><Th>Contract</Th><Th>Data angajării</Th><Th>Stare</Th></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-navy-50/40">
                  <Td><Link href={`/f/${cid}/hr/angajati/${e.id}`} className="font-medium text-navy-900 hover:underline">{e.last_name} {e.first_name}</Link></Td>
                  <Td>{e.job_title ?? "—"}</Td>
                  <Td>{e.contract_no ? `${e.contract_no}${e.contract_date ? ` / ${formatDate(e.contract_date)}` : ""}` : "—"}</Td>
                  <Td>{formatDate(e.hire_date)}</Td>
                  <Td><Badge tone={e.status === "activ" ? "green" : e.status === "suspendat" ? "amber" : "neutral"}>{EMPLOYEE_STATUS_LABEL[e.status]}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
