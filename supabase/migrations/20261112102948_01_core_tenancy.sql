-- =====================================================================
-- 01 · Nucleu multi-tenant: profiluri, firme, membri, arondări, invitații
-- =====================================================================

create schema if not exists private;
grant usage on schema private to authenticated, anon;

create type public.internal_role as enum ('super_admin', 'contabil', 'specialist_hr');
create type public.client_role   as enum ('client_admin', 'client_operational');
create type public.work_area     as enum ('accounting', 'hr');
create type public.work_status   as enum ('trimis', 'in_lucru', 'necesita_clarificari', 'finalizat', 'anulat');
create type public.doc_direction as enum ('de_la_client', 'de_la_gana');

-- ---------------------------------------------------------------- tabele
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text not null default '',
  phone         text,
  internal_role public.internal_role,          -- null = utilizator client
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  cui         text,
  reg_com     text,
  address     text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.company_members (
  company_id             uuid not null references public.companies (id) on delete cascade,
  user_id                uuid not null references public.profiles (id) on delete cascade,
  role                   public.client_role not null default 'client_operational',
  perm_manage_users      boolean not null default false,
  perm_accounting        boolean not null default true,   -- acces modul Contabilitate (încărcare, solicitări)
  perm_hr                boolean not null default true,   -- acces modul HR & Payroll
  perm_view_financials   boolean not null default false,  -- balanțe, profit, dashboard financiar
  perm_view_salaries     boolean not null default false,  -- state, fluturași, date salariale
  perm_view_employee_pii boolean not null default false,  -- CNP, act de identitate, adresă
  created_at             timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.staff_assignments (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index staff_assignments_user_idx on public.staff_assignments (user_id);

create table public.invitations (
  id                     uuid primary key default gen_random_uuid(),   -- joacă și rol de token
  kind                   text not null check (kind in ('client', 'staff', 'resetare')),
  email                  text not null,
  full_name              text not null default '',
  company_id             uuid references public.companies (id) on delete cascade,
  role                   public.client_role,
  perm_manage_users      boolean not null default false,
  perm_accounting        boolean not null default true,
  perm_hr                boolean not null default true,
  perm_view_financials   boolean not null default false,
  perm_view_salaries     boolean not null default false,
  perm_view_employee_pii boolean not null default false,
  internal_role          public.internal_role,
  invited_by             uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  expires_at             timestamptz not null default now() + interval '14 days',
  accepted_at            timestamptz,
  revoked_at             timestamptz,
  check (kind <> 'client' or (company_id is not null and role is not null and internal_role is null)),
  check (kind <> 'staff'  or (internal_role is not null and company_id is null))
);
create index invitations_company_idx on public.invitations (company_id);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  company_id uuid references public.companies (id) on delete cascade,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_company_idx on public.audit_log (company_id, created_at desc);

-- ------------------------------------------------- funcții de autorizare
create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.is_active and p.internal_role = 'super_admin');
$$;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = (select auth.uid()) and p.is_active and p.internal_role is not null);
$$;

-- personal intern arondat firmei (indiferent de zonă)
create or replace function private.is_staff_of(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
      and (p.internal_role = 'super_admin'
           or (p.internal_role is not null and exists (
                 select 1 from public.staff_assignments s
                 where s.company_id = cid and s.user_id = p.id))));
$$;

-- personal intern arondat firmei ȘI cu rol potrivit zonei
create or replace function private.is_staff_for(cid uuid, area public.work_area) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
      and (p.internal_role = 'super_admin'
           or (((area = 'accounting' and p.internal_role = 'contabil')
             or (area = 'hr' and p.internal_role = 'specialist_hr'))
               and exists (select 1 from public.staff_assignments s
                           where s.company_id = cid and s.user_id = p.id))));
$$;

create or replace function private.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members m
    join public.profiles p on p.id = m.user_id
    join public.companies c on c.id = m.company_id
    where m.company_id = cid and m.user_id = (select auth.uid()) and p.is_active and not c.is_archived);
$$;

create or replace function private.member_perm(cid uuid, perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case perm
             when 'manage_users'      then m.perm_manage_users
             when 'accounting'        then m.perm_accounting
             when 'hr'                then m.perm_hr
             when 'view_financials'   then m.perm_view_financials
             when 'view_salaries'     then m.perm_view_salaries
             when 'view_employee_pii' then m.perm_view_employee_pii
             else false end
    from public.company_members m
    join public.profiles p on p.id = m.user_id
    join public.companies c on c.id = m.company_id
    where m.company_id = cid and m.user_id = (select auth.uid()) and p.is_active and not c.is_archived
  ), false);
$$;

-- acces la o zonă (modul) a firmei
create or replace function private.can_access_area(cid uuid, area public.work_area) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff_for(cid, area) or private.member_perm(cid, area::text);
$$;

-- acces la datele sensibile ale zonei (financiare / salariale)
create or replace function private.can_view_sensitive(cid uuid, area public.work_area) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff_for(cid, area)
      or (private.member_perm(cid, area::text)
          and private.member_perm(cid, case area when 'accounting' then 'view_financials' else 'view_salaries' end));
$$;

create or replace function private.can_see_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select pid = (select auth.uid())
      or private.is_staff()
      or exists (select 1 from public.company_members me
                 join public.company_members other on other.company_id = me.company_id
                 where me.user_id = (select auth.uid()) and other.user_id = pid)
      or exists (select 1 from public.company_members me
                 join public.staff_assignments s on s.company_id = me.company_id
                 where me.user_id = (select auth.uid()) and s.user_id = pid)
      or (exists (select 1 from public.company_members me where me.user_id = (select auth.uid()))
          and exists (select 1 from public.profiles p where p.id = pid and p.internal_role = 'super_admin'));
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.profiles          enable row level security;
alter table public.companies         enable row level security;
alter table public.company_members   enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.invitations       enable row level security;
alter table public.audit_log         enable row level security;

revoke all on public.profiles, public.companies, public.company_members,
              public.staff_assignments, public.invitations, public.audit_log from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, internal_role, is_active) on public.profiles to authenticated;
grant select, insert, update on public.companies to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
grant select, insert, delete on public.staff_assignments to authenticated;
grant select, insert on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;
grant select on public.audit_log to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (private.can_see_profile(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.is_super_admin())
  with check (id = (select auth.uid()) or private.is_super_admin());

create policy companies_select on public.companies for select to authenticated
  using (private.is_staff_of(id) or private.is_member(id));
create policy companies_insert on public.companies for insert to authenticated
  with check (private.is_super_admin());
create policy companies_update on public.companies for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

create policy members_select on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff_of(company_id)
         or private.member_perm(company_id, 'manage_users'));
create policy members_insert on public.company_members for insert to authenticated
  with check (private.is_super_admin());
create policy members_update on public.company_members for update to authenticated
  using (private.is_super_admin() or private.member_perm(company_id, 'manage_users'))
  with check (private.is_super_admin() or private.member_perm(company_id, 'manage_users'));
create policy members_delete on public.company_members for delete to authenticated
  using (private.is_super_admin()
         or (private.member_perm(company_id, 'manage_users') and user_id <> (select auth.uid())));

create policy assignments_select on public.staff_assignments for select to authenticated
  using (private.is_staff() or private.is_member(company_id));
create policy assignments_insert on public.staff_assignments for insert to authenticated
  with check (private.is_super_admin());
create policy assignments_delete on public.staff_assignments for delete to authenticated
  using (private.is_super_admin());

create policy invitations_select on public.invitations for select to authenticated
  using (private.is_super_admin()
         or (kind = 'client' and private.member_perm(company_id, 'manage_users')));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (invited_by = (select auth.uid())
              and (private.is_super_admin()
                   or (kind = 'client' and private.member_perm(company_id, 'manage_users'))));
create policy invitations_update on public.invitations for update to authenticated
  using (private.is_super_admin()
         or (kind = 'client' and private.member_perm(company_id, 'manage_users')))
  with check (private.is_super_admin()
         or (kind = 'client' and private.member_perm(company_id, 'manage_users')));

create policy audit_select on public.audit_log for select to authenticated
  using (private.is_super_admin() or (company_id is not null and private.is_staff_of(company_id)));

-- ------------------------------------------------------------ triggere
-- doar un Super Admin poate schimba rolul intern sau starea contului
create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.internal_role is distinct from old.internal_role or new.is_active is distinct from old.is_active)
     and (select auth.uid()) is not null and not private.is_super_admin() then
    raise exception 'Doar un Super Admin poate modifica rolul sau starea contului.';
  end if;
  if new.id = (select auth.uid()) and old.internal_role = 'super_admin'
     and (new.internal_role is distinct from 'super_admin' or not new.is_active) then
    raise exception 'Nu îți poți retrage singur drepturile de Super Admin.';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

-- un membru nu își poate modifica singur permisiunile; rămâne mereu un administrator
create or replace function private.guard_member_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.company_id <> old.company_id or new.user_id <> old.user_id then
      raise exception 'Firma și utilizatorul nu pot fi schimbate.';
    end if;
    if old.user_id = (select auth.uid()) and not private.is_super_admin() then
      raise exception 'Nu îți poți modifica propriile permisiuni.';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger members_guard before update on public.company_members
  for each row execute function private.guard_member_change();

create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb; cid uuid;
begin
  r := to_jsonb(coalesce(new, old));
  cid := nullif(r ->> 'company_id', '')::uuid;
  insert into public.audit_log (company_id, actor_id, action, entity, entity_id, details)
  values (cid, (select auth.uid()), lower(tg_op), tg_table_name,
          coalesce(r ->> 'id', r ->> 'user_id'),
          case tg_op when 'UPDATE' then jsonb_build_object('inainte', to_jsonb(old), 'dupa', to_jsonb(new)) else r end);
  return coalesce(new, old);
end $$;
create trigger members_audit after insert or update or delete on public.company_members
  for each row execute function private.audit_row();
create trigger assignments_audit after insert or delete on public.staff_assignments
  for each row execute function private.audit_row();
