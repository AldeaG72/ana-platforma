import { saveEmployee } from "@/app/actions/manage";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select } from "@/components/ui";
import { EMPLOYEE_STATUS_LABEL, type Employee } from "@/lib/types";

export type EmployeePrivate = {
  cnp: string | null; id_series: string | null; id_number: string | null; id_issued_by: string | null;
  id_expiry: string | null; birth_date: string | null; address: string | null;
};

export function EmployeeForm({ companyId, employee, priv }: { companyId: string; employee?: Employee; priv?: EmployeePrivate | null }) {
  const e = employee;
  return (
    <ActionForm action={saveEmployee} resetOnDone={false} className="flex flex-col gap-4">
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="id" value={e?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nume *"><Input name="last_name" defaultValue={e?.last_name} required /></Field>
        <Field label="Prenume *"><Input name="first_name" defaultValue={e?.first_name} required /></Field>
        <Field label="Funcție"><Input name="job_title" defaultValue={e?.job_title ?? ""} /></Field>
        <Field label="Departament"><Input name="department" defaultValue={e?.department ?? ""} /></Field>
        <Field label="Nr. contract"><Input name="contract_no" defaultValue={e?.contract_no ?? ""} /></Field>
        <Field label="Data contractului"><Input type="date" name="contract_date" defaultValue={e?.contract_date ?? ""} /></Field>
        <Field label="Tip contract">
          <Select name="contract_type" defaultValue={e?.contract_type ?? "Nedeterminată"}>
            <option>Nedeterminată</option><option>Determinată</option>
          </Select>
        </Field>
        <Field label="Normă (ore/zi)"><Input name="work_hours" inputMode="decimal" defaultValue={e?.work_hours ?? 8} /></Field>
        <Field label="Data angajării"><Input type="date" name="hire_date" defaultValue={e?.hire_date ?? ""} /></Field>
        <Field label="Data încetării"><Input type="date" name="end_date" defaultValue={e?.end_date ?? ""} /></Field>
        <Field label="Stare">
          <Select name="status" defaultValue={e?.status ?? "activ"}>
            {Object.entries(EMPLOYEE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Email"><Input type="email" name="email" defaultValue={e?.email ?? ""} /></Field>
        <Field label="Telefon"><Input name="phone" defaultValue={e?.phone ?? ""} /></Field>
      </div>
      <p className="border-t border-line pt-4 text-sm font-semibold text-navy-900">Date personale</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CNP"><Input name="cnp" inputMode="numeric" pattern="\d{13}" maxLength={13} defaultValue={priv?.cnp ?? ""} /></Field>
        <Field label="Data nașterii"><Input type="date" name="birth_date" defaultValue={priv?.birth_date ?? ""} /></Field>
        <Field label="Serie CI"><Input name="id_series" maxLength={4} defaultValue={priv?.id_series ?? ""} /></Field>
        <Field label="Număr CI"><Input name="id_number" maxLength={10} defaultValue={priv?.id_number ?? ""} /></Field>
        <Field label="Eliberat de"><Input name="id_issued_by" defaultValue={priv?.id_issued_by ?? ""} /></Field>
        <Field label="Valabil până la"><Input type="date" name="id_expiry" defaultValue={priv?.id_expiry ?? ""} /></Field>
        <Field label="Adresă" className="sm:col-span-2"><Input name="address" defaultValue={priv?.address ?? ""} /></Field>
      </div>
      <div className="flex justify-end"><SubmitButton>{e ? "Salvează modificările" : "Adaugă angajatul"}</SubmitButton></div>
    </ActionForm>
  );
}
