"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { createRequest } from "@/app/actions/work";
import { Dialog } from "@/components/dialog";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Area, RequestField, RequestType } from "@/lib/types";
import { cn } from "@/lib/utils";

type EmployeeOption = { id: string; name: string };

function FieldInput({ field, employees }: { field: RequestField; employees: EmployeeOption[] }) {
  const name = `f_${field.name}`;
  const common = { name, required: field.required };
  switch (field.type) {
    case "employee":
      return (
        <Select {...common} defaultValue="">
          <option value="" disabled>Alege angajatul…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      );
    case "select":
      return (
        <Select {...common} defaultValue="">
          <option value="" disabled>Alege…</option>
          {field.options?.map((o) => <option key={o}>{o}</option>)}
        </Select>
      );
    case "date":
      return <Input type="date" {...common} />;
    case "month":
      return <Input type="month" {...common} />;
    case "year":
      return <Input type="number" min={2015} max={2100} defaultValue={new Date().getFullYear() - 1} {...common} />;
    case "textarea":
      return <Textarea {...common} />;
    default:
      return <Input {...common} maxLength={500} />;
  }
}

export function NewRequestDialog({ companyId, area, types, employees }: {
  companyId: string; area: Area; types: RequestType[]; employees: EmployeeOption[];
}) {
  const [code, setCode] = React.useState<string | null>(null);
  const type = types.find((t) => t.code === code);

  return (
    <Dialog
      wide
      title="Solicitare nouă"
      description={type ? type.description ?? undefined : "Alege ce ai nevoie; solicitarea ajunge direct la persoana care se ocupă de firma ta."}
      trigger={<Button><Plus /> Solicitare nouă</Button>}
    >
      {!type ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {types.map((t) => (
            <button
              key={t.code}
              type="button"
              onClick={() => setCode(t.code)}
              className={cn("cursor-pointer rounded-lg border border-line p-3 text-left transition-colors hover:border-gold-500 hover:bg-gold-50")}
            >
              <span className="block text-sm font-medium text-navy-900">{t.label}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t.description} Termen de răspuns: {t.sla_days} {t.sla_days === 1 ? "zi lucrătoare" : "zile lucrătoare"}.
              </span>
            </button>
          ))}
        </div>
      ) : (
        <ActionForm action={createRequest} resetOnDone={false} className="flex flex-col gap-4">
          <input type="hidden" name="company_id" value={companyId} />
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="type_code" value={type.code} />
          <p className="rounded-md bg-navy-50 px-3 py-2 text-sm font-medium text-navy-900">{type.label}</p>
          {type.fields.map((f) => (
            <Field key={f.name} label={`${f.label}${f.required ? " *" : ""}`}>
              <FieldInput field={f} employees={employees} />
            </Field>
          ))}
          <Field label="Detalii suplimentare" hint="După trimitere poți atașa fișiere și continua discuția în pagina solicitării.">
            <Textarea name="message" maxLength={4000} />
          </Field>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setCode(null)}>Înapoi</Button>
            <SubmitButton>Trimite solicitarea</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
