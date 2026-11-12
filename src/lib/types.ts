export type Area = "accounting" | "hr";
export type Direction = "de_la_client" | "de_la_gana";
export type WorkStatus = "trimis" | "in_lucru" | "necesita_clarificari" | "finalizat" | "anulat";
export type InternalRole = "super_admin" | "contabil" | "specialist_hr";
export type ClientRole = "client_admin" | "client_operational";

export const AREA_LABEL: Record<Area, string> = { accounting: "Contabilitate", hr: "HR & Payroll" };
export const AREA_SEGMENT: Record<Area, string> = { accounting: "contabilitate", hr: "hr" };

export const STATUS_LABEL: Record<WorkStatus, string> = {
  trimis: "Trimis",
  in_lucru: "În lucru",
  necesita_clarificari: "Necesită clarificări",
  finalizat: "Finalizat",
  anulat: "Anulat",
};
export const STATUSES = Object.keys(STATUS_LABEL) as WorkStatus[];
export const OPEN_STATUSES: WorkStatus[] = ["trimis", "in_lucru", "necesita_clarificari"];

export const INTERNAL_ROLE_LABEL: Record<InternalRole, string> = {
  super_admin: "Super Admin",
  contabil: "Contabil",
  specialist_hr: "Specialist HR",
};
export const CLIENT_ROLE_LABEL: Record<ClientRole, string> = {
  client_admin: "Administrator firmă",
  client_operational: "Operațional",
};

export const PERMISSIONS = [
  { key: "perm_accounting", label: "Modul Contabilitate", hint: "Încarcă documente și trimite solicitări către contabilitate." },
  { key: "perm_view_financials", label: "Vede date financiare", hint: "Balanțe, profit, taxe, dashboard financiar." },
  { key: "perm_hr", label: "Modul HR & Payroll", hint: "Încarcă pontaje și documente, trimite solicitări către HR." },
  { key: "perm_view_salaries", label: "Vede date salariale", hint: "State de plată, fluturași, contracte, adeverințe de venit." },
  { key: "perm_view_employee_pii", label: "Vede date personale angajați", hint: "CNP, act de identitate, adresă." },
  { key: "perm_manage_users", label: "Gestionează utilizatori", hint: "Invită colegi și le stabilește permisiunile." },
] as const;
export type PermKey = (typeof PERMISSIONS)[number]["key"];
export type Perms = Record<PermKey, boolean>;

export const ROLE_PRESETS: Record<ClientRole, Perms> = {
  client_admin: {
    perm_accounting: true, perm_view_financials: true, perm_hr: true,
    perm_view_salaries: true, perm_view_employee_pii: true, perm_manage_users: true,
  },
  client_operational: {
    perm_accounting: true, perm_view_financials: false, perm_hr: true,
    perm_view_salaries: false, perm_view_employee_pii: false, perm_manage_users: false,
  },
};

export type Profile = {
  id: string; email: string; full_name: string; phone: string | null;
  internal_role: InternalRole | null; is_active: boolean;
};
export type Company = { id: string; name: string; cui: string | null; reg_com: string | null; address: string | null; is_archived: boolean };
export type Member = Perms & { company_id: string; user_id: string; role: ClientRole; created_at: string };

export type DocCategory = {
  code: string; area: Area; direction: Direction; label: string; hint: string | null; sensitive_default: boolean; sort: number;
};
export type RequestField = {
  name: string; label: string; type: "text" | "textarea" | "date" | "month" | "year" | "select" | "employee";
  required?: boolean; options?: string[];
};
export type RequestType = {
  code: string; area: Area; label: string; description: string | null; sla_days: number;
  sensitive: boolean; fields: RequestField[]; sort: number; is_active: boolean;
};
export type DocumentRow = {
  id: string; company_id: string; area: Area; direction: Direction; category: string;
  period_year: number; period_month: number; file_name: string; storage_path: string; size_bytes: number;
  mime_type: string | null; note: string | null; status: WorkStatus; sensitive: boolean;
  employee_id: string | null; request_id: string | null; uploaded_by: string | null;
  created_at: string; deleted_at: string | null;
};
export type RequestRow = {
  id: string; company_id: string; area: Area; type_code: string; title: string;
  details: Record<string, string>; message: string | null; status: WorkStatus; sensitive: boolean;
  employee_id: string | null; assigned_to: string | null; due_at: string | null;
  created_by: string | null; created_at: string; closed_at: string | null;
};
export type Employee = {
  id: string; company_id: string; last_name: string; first_name: string; job_title: string | null;
  department: string | null; contract_no: string | null; contract_date: string | null; contract_type: string | null;
  work_hours: number | null; hire_date: string | null; end_date: string | null;
  status: "activ" | "suspendat" | "incetat"; email: string | null; phone: string | null;
};
export const EMPLOYEE_STATUS_LABEL = { activ: "Activ", suspendat: "Suspendat", incetat: "Încetat" } as const;

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: Record<string, string> } | null;
