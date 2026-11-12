-- =====================================================================
-- 03 · Reguli de flux: validări, SLA, alocare automată, istoric, notificări
-- =====================================================================

create or replace function private.add_workdays(d date, n int) returns date
language plpgsql immutable set search_path = '' as $$
declare r date := d; left_days int := greatest(n, 0);
begin
  while left_days > 0 loop
    r := r + 1;
    if extract(isodow from r) < 6 then left_days := left_days - 1; end if;
  end loop;
  return r;
end $$;

create or replace function private.status_label(s public.work_status) returns text
language sql immutable set search_path = '' as $$
  select case s when 'trimis' then 'Trimis' when 'in_lucru' then 'În lucru'
                when 'necesita_clarificari' then 'Necesită clarificări'
                when 'finalizat' then 'Finalizat' else 'Anulat' end;
$$;

-- Trimite o notificare în aplicație către „cealaltă parte”:
-- dacă autorul este din echipa Gana -> utilizatorii firmei cu drept de acces;
-- dacă autorul este client -> personalul arondat zonei (sau Super Admin, dacă nu e nimeni arondat).
create or replace function private.notify(
  p_company uuid, p_area public.work_area, p_sensitive boolean, p_actor uuid,
  p_kind text, p_title text, p_link text, p_group_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_internal boolean; company_name text;
begin
  select (internal_role is not null) into actor_internal from public.profiles where id = p_actor;
  select name into company_name from public.companies where id = p_company;

  insert into public.notifications (user_id, company_id, kind, title, body, link, group_key)
  select r.user_id, p_company, p_kind, p_title, company_name, p_link, p_group_key
  from (
    -- către client
    select m.user_id
    from public.company_members m join public.profiles p on p.id = m.user_id and p.is_active
    where coalesce(actor_internal, true) and m.company_id = p_company
      and case p_area when 'accounting' then m.perm_accounting else m.perm_hr end
      and (not p_sensitive or case p_area when 'accounting' then m.perm_view_financials else m.perm_view_salaries end)
    union
    -- către personalul arondat
    select s.user_id
    from public.staff_assignments s join public.profiles p on p.id = s.user_id and p.is_active
    where not coalesce(actor_internal, true) and s.company_id = p_company
      and ((p_area = 'accounting' and p.internal_role = 'contabil') or (p_area = 'hr' and p.internal_role = 'specialist_hr'))
    union
    -- fără personal arondat -> Super Admin
    select p.id
    from public.profiles p
    where not coalesce(actor_internal, true) and p.is_active and p.internal_role = 'super_admin'
      and not exists (
        select 1 from public.staff_assignments s join public.profiles sp on sp.id = s.user_id and sp.is_active
        where s.company_id = p_company
          and ((p_area = 'accounting' and sp.internal_role = 'contabil') or (p_area = 'hr' and sp.internal_role = 'specialist_hr')))
  ) r
  where r.user_id is distinct from p_actor
    and (p_group_key is null or not exists (
          select 1 from public.notifications n
          where n.user_id = r.user_id and n.group_key = p_group_key and n.read_at is null
            and n.created_at > now() - interval '30 minutes'));
end $$;

-- ------------------------------------------------------------ solicitări
create or replace function private.requests_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.request_types; uid uuid := (select auth.uid()); staff boolean;
begin
  staff := uid is null or private.is_staff_for(new.company_id, new.area);

  if tg_op = 'INSERT' then
    select * into t from public.request_types where code = new.type_code;
    if t.code is null or not t.is_active then raise exception 'Tip de solicitare necunoscut.'; end if;
    if t.area <> new.area then raise exception 'Tipul solicitării nu aparține acestei zone.'; end if;
    new.sensitive := t.sensitive;
    if new.sensitive and uid is not null and not private.can_view_sensitive(new.company_id, new.area) then
      raise exception 'Nu ai permisiunea de a trimite acest tip de solicitare.';
    end if;
    if coalesce(btrim(new.title), '') = '' then new.title := t.label; end if;
    if not staff then new.status := 'trimis'; end if;
    new.due_at := coalesce(new.due_at, private.add_workdays(current_date, t.sla_days));
    if new.employee_id is not null and not exists (
         select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then
      raise exception 'Angajatul nu aparține acestei firme.';
    end if;
    -- alocare automată către persoana arondată firmei pe zona respectivă
    if new.assigned_to is null then
      select s.user_id into new.assigned_to
      from public.staff_assignments s join public.profiles p on p.id = s.user_id and p.is_active
      where s.company_id = new.company_id
        and ((new.area = 'accounting' and p.internal_role = 'contabil') or (new.area = 'hr' and p.internal_role = 'specialist_hr'))
      order by s.created_at limit 1;
    end if;
  else
    if not staff and (to_jsonb(new) - 'status' - 'updated_at' - 'closed_at')
                 is distinct from (to_jsonb(old) - 'status' - 'updated_at' - 'closed_at') then
      raise exception 'Poți modifica doar statusul solicitării.';
    end if;
    if new.company_id <> old.company_id or new.area <> old.area or new.type_code <> old.type_code then
      raise exception 'Firma, zona și tipul solicitării nu pot fi schimbate.';
    end if;
    new.updated_at := now();
  end if;

  new.closed_at := case when new.status in ('finalizat', 'anulat') then coalesce(new.closed_at, now()) else null end;
  return new;
end $$;
create trigger requests_before_write before insert or update on public.requests
  for each row execute function private.requests_before_write();

create or replace function private.requests_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := coalesce((select auth.uid()), new.created_by); link text;
begin
  link := '/f/' || new.company_id || '/solicitari/' || new.id;
  if tg_op = 'INSERT' then
    insert into public.status_history (company_id, request_id, from_status, to_status, changed_by)
    values (new.company_id, new.id, null, new.status, uid);
    perform private.notify(new.company_id, new.area, new.sensitive, uid, 'solicitare', 'Solicitare nouă: ' || new.title, link);
  elsif new.status is distinct from old.status then
    insert into public.status_history (company_id, request_id, from_status, to_status, changed_by)
    values (new.company_id, new.id, old.status, new.status, uid);
    perform private.notify(new.company_id, new.area, new.sensitive, uid, 'status',
      new.title || ' → ' || private.status_label(new.status), link);
  end if;
  return new;
end $$;
create trigger requests_after_write after insert or update on public.requests
  for each row execute function private.requests_after_write();

-- -------------------------------------------------------------- documente
create or replace function private.documents_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.document_categories; r public.requests; uid uuid := (select auth.uid()); staff boolean;
begin
  staff := uid is null or private.is_staff_for(new.company_id, new.area);

  if tg_op = 'INSERT' then
    select * into c from public.document_categories where code = new.category;
    if c.code is null or c.area <> new.area or c.direction <> new.direction then
      raise exception 'Categoria nu corespunde zonei sau sensului documentului.';
    end if;
    if new.storage_path not like new.company_id || '/' || new.area || '/%' then
      raise exception 'Calea fișierului nu corespunde firmei.';
    end if;
    if not staff then
      new.status := 'trimis';
      new.sensitive := c.sensitive_default;
      new.deleted_at := null; new.deleted_by := null;
    end if;
    if new.request_id is not null then
      select * into r from public.requests where id = new.request_id;
      if r.id is null or r.company_id <> new.company_id or r.area <> new.area then
        raise exception 'Solicitarea nu aparține acestei firme.';
      end if;
      new.sensitive := new.sensitive or r.sensitive;
      new.employee_id := coalesce(new.employee_id, r.employee_id);
    end if;
    if new.employee_id is not null and not exists (
         select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then
      raise exception 'Angajatul nu aparține acestei firme.';
    end if;
  else
    if not staff and (to_jsonb(new) - 'status' - 'updated_at')
                 is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception 'Doar echipa Gana poate modifica sau șterge documente. Poți schimba doar statusul.';
    end if;
    if new.company_id <> old.company_id or new.area <> old.area or new.direction <> old.direction then
      raise exception 'Firma, zona și sensul documentului nu pot fi schimbate.';
    end if;
    if new.storage_path <> old.storage_path and new.storage_path not like new.company_id || '/' || new.area || '/%' then
      raise exception 'Calea fișierului nu corespunde firmei.';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger documents_before_write before insert or update on public.documents
  for each row execute function private.documents_before_write();

create or replace function private.documents_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := coalesce((select auth.uid()), new.uploaded_by); link text; cat_label text; seg text;
begin
  seg := case new.area when 'accounting' then 'contabilitate' else 'hr' end;
  link := '/f/' || new.company_id || '/documente/' || new.id;
  select label into cat_label from public.document_categories where code = new.category;

  if tg_op = 'INSERT' then
    insert into public.status_history (company_id, document_id, from_status, to_status, changed_by)
    values (new.company_id, new.id, null, new.status, uid);
    if new.request_id is not null then
      perform private.notify(new.company_id, new.area, new.sensitive, uid, 'document',
        'Fișier nou atașat solicitării: ' || new.file_name,
        '/f/' || new.company_id || '/solicitari/' || new.request_id);
    else
      -- încărcările multiple produc o singură notificare per categorie și lună
      perform private.notify(new.company_id, new.area, new.sensitive, uid, 'document',
        case new.direction when 'de_la_gana' then 'Document disponibil: ' else 'Documente încărcate: ' end
          || cat_label || ' (' || lpad(new.period_month::text, 2, '0') || '.' || new.period_year || ')',
        '/f/' || new.company_id || '/' || seg || '/documente?an=' || new.period_year || '&luna=' || new.period_month,
        'doc:' || new.company_id || ':' || new.category || ':' || new.period_year || '-' || new.period_month
          || ':' || new.sensitive);
    end if;
  else
    if new.status is distinct from old.status then
      insert into public.status_history (company_id, document_id, from_status, to_status, changed_by)
      values (new.company_id, new.id, old.status, new.status, uid);
      perform private.notify(new.company_id, new.area, new.sensitive, uid, 'status',
        new.file_name || ' → ' || private.status_label(new.status), link);
    end if;
    if new.deleted_at is distinct from old.deleted_at or new.storage_path <> old.storage_path then
      insert into public.audit_log (company_id, actor_id, action, entity, entity_id, details)
      values (new.company_id, (select auth.uid()),
              case when new.deleted_at is not null and old.deleted_at is null then 'stergere'
                   when new.storage_path <> old.storage_path then 'inlocuire' else 'restaurare' end,
              'documents', new.id::text,
              jsonb_build_object('fisier_vechi', old.file_name, 'fisier_nou', new.file_name,
                                 'cale_veche', old.storage_path, 'cale_noua', new.storage_path));
    end if;
  end if;
  return new;
end $$;
create trigger documents_after_write after insert or update on public.documents
  for each row execute function private.documents_after_write();

-- -------------------------------------------------------------- comentarii
create or replace function private.comments_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d public.documents; r public.requests;
begin
  if new.request_id is not null then
    select * into r from public.requests where id = new.request_id;
    perform private.notify(r.company_id, r.area, r.sensitive, new.author_id, 'comentariu',
      'Comentariu nou: ' || r.title, '/f/' || r.company_id || '/solicitari/' || r.id);
  else
    select * into d from public.documents where id = new.document_id;
    perform private.notify(d.company_id, d.area, d.sensitive, new.author_id, 'comentariu',
      'Comentariu nou: ' || d.file_name, '/f/' || d.company_id || '/documente/' || d.id);
  end if;
  return new;
end $$;
create trigger comments_after_insert after insert on public.comments
  for each row execute function private.comments_after_insert();

-- ------------------------------------- firmă nouă -> checklist din șablon
create or replace function private.companies_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.checklist_items (company_id, area, label, category_code, due_day, sort)
  select new.id, t.area, t.label, t.category_code, t.due_day, t.sort from public.checklist_template_items t;
  return new;
end $$;
create trigger companies_after_insert after insert on public.companies
  for each row execute function private.companies_after_insert();

-- coloana company_id/area din checklist_entries trebuie să corespundă elementului
create or replace function private.checklist_entries_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select i.company_id, i.area into new.company_id, new.area from public.checklist_items i where i.id = new.item_id;
  new.marked_at := now();
  return new;
end $$;
create trigger checklist_entries_before_write before insert or update on public.checklist_entries
  for each row execute function private.checklist_entries_before_write();

create or replace function private.employee_private_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select e.company_id into new.company_id from public.employees e where e.id = new.employee_id;
  new.updated_at := now();
  return new;
end $$;
create trigger employee_private_before_write before insert or update on public.employee_private
  for each row execute function private.employee_private_before_write();

create or replace function private.financial_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end $$;
create trigger financial_before_write before insert or update on public.financial_snapshots
  for each row execute function private.financial_before_write();

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
