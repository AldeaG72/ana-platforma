-- =====================================================================
-- 02 · Angajați, documente, solicitări, comentarii, istoric, notificări
-- =====================================================================

-- ------------------------------------------------------------ nomenclatoare
create table public.document_categories (
  code              text primary key,
  area              public.work_area not null,
  direction         public.doc_direction not null,
  label             text not null,
  hint              text,
  sensitive_default boolean not null default false,
  sort              int not null default 0
);

create table public.request_types (
  code        text primary key,
  area        public.work_area not null,
  label       text not null,
  description text,
  sla_days    int not null default 3,          -- termen de răspuns, în zile lucrătoare
  sensitive   boolean not null default false,
  fields      jsonb not null default '[]'::jsonb,  -- definiția formularului
  sort        int not null default 0,
  is_active   boolean not null default true
);

-- ------------------------------------------------------------------ angajați
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  last_name     text not null,
  first_name    text not null,
  job_title     text,
  department    text,
  contract_no   text,
  contract_date date,
  contract_type text,                -- nedeterminată / determinată
  work_hours    numeric(4,1) default 8,
  hire_date     date,
  end_date      date,
  status        text not null default 'activ' check (status in ('activ', 'suspendat', 'incetat')),
  email         text,
  phone         text,
  created_at    timestamptz not null default now()
);
create index employees_company_idx on public.employees (company_id, status);

-- date cu caracter personal, separate pentru a putea fi protejate distinct
create table public.employee_private (
  employee_id  uuid primary key references public.employees (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  cnp          text,
  id_series    text,
  id_number    text,
  id_issued_by text,
  id_expiry    date,
  birth_date   date,
  address      text,
  updated_at   timestamptz not null default now()
);
create index employee_private_company_idx on public.employee_private (company_id);

-- ---------------------------------------------------------------- solicitări
create table public.requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  area        public.work_area not null,
  type_code   text not null references public.request_types (code),
  title       text not null default '',
  details     jsonb not null default '{}'::jsonb,
  message     text,
  status      public.work_status not null default 'trimis',
  sensitive   boolean not null default false,
  employee_id uuid references public.employees (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  due_at      date,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create index requests_company_idx on public.requests (company_id, area, status, created_at desc);
create index requests_assigned_idx on public.requests (assigned_to, status);

-- ----------------------------------------------------------------- documente
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  area          public.work_area not null,
  direction     public.doc_direction not null,
  category      text not null references public.document_categories (code),
  period_year   int not null check (period_year between 2000 and 2100),
  period_month  int not null check (period_month between 1 and 12),
  file_name     text not null,
  storage_path  text not null unique,
  size_bytes    bigint not null default 0,
  mime_type     text,
  note          text,
  status        public.work_status not null default 'trimis',
  sensitive     boolean not null default false,
  employee_id   uuid references public.employees (id) on delete set null,
  request_id    uuid references public.requests (id) on delete set null,
  uploaded_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid references public.profiles (id) on delete set null
);
create index documents_period_idx on public.documents (company_id, area, period_year, period_month, category);
create index documents_request_idx on public.documents (request_id);
create index documents_employee_idx on public.documents (employee_id);

-- ---------------------------------------------- comentarii + istoric statusuri
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  request_id  uuid references public.requests (id) on delete cascade,
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  body        text not null check (length(btrim(body)) between 1 and 5000),
  created_at  timestamptz not null default now(),
  check (num_nonnulls(document_id, request_id) = 1)
);
create index comments_document_idx on public.comments (document_id, created_at);
create index comments_request_idx on public.comments (request_id, created_at);

create table public.status_history (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.companies (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  request_id  uuid references public.requests (id) on delete cascade,
  from_status public.work_status,
  to_status   public.work_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  changed_at  timestamptz not null default now()
);
create index status_history_document_idx on public.status_history (document_id);
create index status_history_request_idx on public.status_history (request_id);

-- ---------------------------------------------------------------- notificări
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  group_key  text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

-- ------------------------------------------------- dashboard financiar lunar
create table public.financial_snapshots (
  company_id   uuid not null references public.companies (id) on delete cascade,
  period_year  int not null,
  period_month int not null check (period_month between 1 and 12),
  revenue      numeric(14,2) not null default 0,
  expenses     numeric(14,2) not null default 0,
  profit       numeric(14,2) not null default 0,
  taxes_due    numeric(14,2) not null default 0,
  note         text,
  updated_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (company_id, period_year, period_month)
);

-- ------------------------------------------------------------ checklist lunar
create table public.checklist_template_items (
  id            int generated always as identity primary key,
  area          public.work_area not null,
  label         text not null,
  category_code text references public.document_categories (code),
  due_day       int check (due_day between 1 and 31),
  sort          int not null default 0
);

create table public.checklist_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  area          public.work_area not null,
  label         text not null,
  category_code text references public.document_categories (code),
  due_day       int check (due_day between 1 and 31),   -- ziua din luna următoare perioadei
  is_active     boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);
create index checklist_items_company_idx on public.checklist_items (company_id, area);

create table public.checklist_entries (
  item_id      uuid not null references public.checklist_items (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  area         public.work_area not null,
  period_year  int not null,
  period_month int not null check (period_month between 1 and 12),
  state        text not null check (state in ('bifat', 'nu_e_cazul')),
  note         text,
  marked_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  marked_at    timestamptz not null default now(),
  primary key (item_id, period_year, period_month)
);
create index checklist_entries_company_idx on public.checklist_entries (company_id, period_year, period_month);

-- =================================================================== RLS
alter table public.document_categories      enable row level security;
alter table public.request_types            enable row level security;
alter table public.employees                enable row level security;
alter table public.employee_private         enable row level security;
alter table public.requests                 enable row level security;
alter table public.documents                enable row level security;
alter table public.comments                 enable row level security;
alter table public.status_history           enable row level security;
alter table public.notifications            enable row level security;
alter table public.financial_snapshots      enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.checklist_items          enable row level security;
alter table public.checklist_entries        enable row level security;

revoke all on public.document_categories, public.request_types, public.employees, public.employee_private,
              public.requests, public.documents, public.comments, public.status_history, public.notifications,
              public.financial_snapshots, public.checklist_template_items, public.checklist_items,
              public.checklist_entries from anon, authenticated;

grant select on public.document_categories, public.request_types, public.checklist_template_items to authenticated;
grant update (label, description, sla_days, sensitive, is_active) on public.request_types to authenticated;
grant select, insert, update, delete on public.employees, public.employee_private to authenticated;
grant select, insert, update on public.requests, public.documents to authenticated;
grant select, insert on public.comments to authenticated;
grant select on public.status_history to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update on public.financial_snapshots to authenticated;
grant select, insert, update, delete on public.checklist_items to authenticated;
grant select, insert, update, delete on public.checklist_entries to authenticated;

-- nomenclatoare
create policy doc_categories_select on public.document_categories for select to authenticated using (true);
create policy request_types_select on public.request_types for select to authenticated using (true);
create policy request_types_update on public.request_types for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
create policy checklist_template_select on public.checklist_template_items for select to authenticated using (true);

-- angajați
create policy employees_select on public.employees for select to authenticated
  using (private.can_access_area(company_id, 'hr'));
create policy employees_insert on public.employees for insert to authenticated
  with check (private.is_staff_for(company_id, 'hr'));
create policy employees_update on public.employees for update to authenticated
  using (private.is_staff_for(company_id, 'hr')) with check (private.is_staff_for(company_id, 'hr'));
create policy employees_delete on public.employees for delete to authenticated
  using (private.is_staff_for(company_id, 'hr'));

create policy employee_private_select on public.employee_private for select to authenticated
  using (private.is_staff_for(company_id, 'hr')
         or (private.member_perm(company_id, 'hr') and private.member_perm(company_id, 'view_employee_pii')));
create policy employee_private_insert on public.employee_private for insert to authenticated
  with check (private.is_staff_for(company_id, 'hr'));
create policy employee_private_update on public.employee_private for update to authenticated
  using (private.is_staff_for(company_id, 'hr')) with check (private.is_staff_for(company_id, 'hr'));
create policy employee_private_delete on public.employee_private for delete to authenticated
  using (private.is_staff_for(company_id, 'hr'));

-- solicitări
create policy requests_select on public.requests for select to authenticated
  using (private.can_access_area(company_id, area)
         and (not sensitive or private.can_view_sensitive(company_id, area)));
create policy requests_insert on public.requests for insert to authenticated
  with check (created_by = (select auth.uid()) and private.can_access_area(company_id, area));
create policy requests_update on public.requests for update to authenticated
  using (private.can_access_area(company_id, area)
         and (not sensitive or private.can_view_sensitive(company_id, area)))
  with check (private.can_access_area(company_id, area));

-- documente
create policy documents_select on public.documents for select to authenticated
  using (private.can_access_area(company_id, area)
         and (not sensitive or private.can_view_sensitive(company_id, area))
         and (deleted_at is null or private.is_staff_for(company_id, area)));
create policy documents_insert on public.documents for insert to authenticated
  with check (uploaded_by = (select auth.uid())
              and (private.is_staff_for(company_id, area)
                   or (private.member_perm(company_id, area::text) and direction = 'de_la_client')));
create policy documents_update on public.documents for update to authenticated
  using (private.can_access_area(company_id, area)
         and (not sensitive or private.can_view_sensitive(company_id, area))
         and (deleted_at is null or private.is_staff_for(company_id, area)))
  with check (private.can_access_area(company_id, area));

-- comentarii și istoric: vizibile dacă elementul-părinte este vizibil (RLS-ul părintelui se aplică în subinterogare)
create policy comments_select on public.comments for select to authenticated
  using ((document_id is not null and exists (select 1 from public.documents d where d.id = document_id))
      or (request_id  is not null and exists (select 1 from public.requests  r where r.id = request_id)));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid())
    and ((document_id is not null and exists (select 1 from public.documents d where d.id = document_id and d.company_id = comments.company_id))
      or (request_id  is not null and exists (select 1 from public.requests  r where r.id = request_id  and r.company_id = comments.company_id))));

create policy status_history_select on public.status_history for select to authenticated
  using ((document_id is not null and exists (select 1 from public.documents d where d.id = document_id))
      or (request_id  is not null and exists (select 1 from public.requests  r where r.id = request_id)));

-- notificări
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- dashboard financiar
create policy financial_select on public.financial_snapshots for select to authenticated
  using (private.can_view_sensitive(company_id, 'accounting'));
create policy financial_insert on public.financial_snapshots for insert to authenticated
  with check (private.is_staff_for(company_id, 'accounting'));
create policy financial_update on public.financial_snapshots for update to authenticated
  using (private.is_staff_for(company_id, 'accounting')) with check (private.is_staff_for(company_id, 'accounting'));

-- checklist
create policy checklist_items_select on public.checklist_items for select to authenticated
  using (private.can_access_area(company_id, area));
create policy checklist_items_insert on public.checklist_items for insert to authenticated
  with check (private.is_staff_for(company_id, area));
create policy checklist_items_update on public.checklist_items for update to authenticated
  using (private.is_staff_for(company_id, area)) with check (private.is_staff_for(company_id, area));
create policy checklist_items_delete on public.checklist_items for delete to authenticated
  using (private.is_staff_for(company_id, area));

create policy checklist_entries_select on public.checklist_entries for select to authenticated
  using (private.can_access_area(company_id, area));
create policy checklist_entries_insert on public.checklist_entries for insert to authenticated
  with check (private.can_access_area(company_id, area)
              and exists (select 1 from public.checklist_items i
                          where i.id = item_id and i.company_id = checklist_entries.company_id and i.area = checklist_entries.area));
create policy checklist_entries_update on public.checklist_entries for update to authenticated
  using (private.can_access_area(company_id, area)) with check (private.can_access_area(company_id, area));
create policy checklist_entries_delete on public.checklist_entries for delete to authenticated
  using (private.can_access_area(company_id, area));
