-- =====================================================================
-- 04 · Stocare fișiere, invitații / conturi, remindere checklist
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------- Storage
-- Cale: {company_id}/{accounting|hr}/{an}/{luna}/{uuid}-{nume-fisier}
insert into storage.buckets (id, name, public, file_size_limit)
values ('documente', 'documente', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create or replace function private.path_company(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then return null;
end $$;

create or replace function private.path_area(p text) returns public.work_area
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p, '/', 2)::public.work_area;
exception when others then return null;
end $$;

create policy documente_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documente'
              and private.path_company(name) is not null and private.path_area(name) is not null
              and private.can_access_area(private.path_company(name), private.path_area(name)));

-- citire: doar dacă rândul din public.documents este vizibil (RLS-ul lui se aplică aici)
-- sau dacă este un fișier abia încărcat de utilizatorul curent
create policy documente_select on storage.objects for select to authenticated
  using (bucket_id = 'documente'
         and (owner_id = (select auth.uid())::text
              or exists (select 1 from public.documents d where d.storage_path = name)));

-- ștergere: doar echipa Gana arondată
create policy documente_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documente'
         and private.is_staff_for(private.path_company(name), private.path_area(name)));

-- ---------------------------------------------------------- Invitații
create or replace function private.invitation_info(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare inv public.invitations; cname text;
begin
  select * into inv from public.invitations where id = p_token;
  if inv.id is null then return jsonb_build_object('valid', false, 'reason', 'Invitația nu există.'); end if;
  if inv.accepted_at is not null then return jsonb_build_object('valid', false, 'reason', 'Invitația a fost deja folosită.'); end if;
  if inv.revoked_at is not null then return jsonb_build_object('valid', false, 'reason', 'Invitația a fost anulată.'); end if;
  if inv.expires_at < now() then return jsonb_build_object('valid', false, 'reason', 'Invitația a expirat.'); end if;
  select name into cname from public.companies where id = inv.company_id;
  return jsonb_build_object(
    'valid', true, 'kind', inv.kind, 'email', inv.email, 'full_name', inv.full_name, 'company_name', cname,
    'has_account', exists (select 1 from auth.users u where lower(u.email) = lower(inv.email)));
end $$;

create or replace function private.accept_invitation(p_token uuid, p_password text, p_full_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare inv public.invitations; existing uuid; uid uuid; v_email text;
begin
  select * into inv from public.invitations where id = p_token for update;
  if inv.id is null or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at < now() then
    raise exception 'Invitația nu mai este valabilă.';
  end if;
  v_email := lower(btrim(inv.email));
  select id into existing from auth.users where lower(email) = v_email;

  if inv.kind = 'resetare' then
    if existing is null then raise exception 'Contul nu există.'; end if;
    if p_password is null or length(p_password) < 10 then raise exception 'Parola trebuie să aibă cel puțin 10 caractere.'; end if;
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now()
    where id = existing;
    uid := existing;
  else
    if existing is null then
      if p_password is null or length(p_password) < 10 then raise exception 'Parola trebuie să aibă cel puțin 10 caractere.'; end if;
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, recovery_token, email_change_token_new, email_change,
                              email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', v_email,
              extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
              '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
              '', '', '', '', '', '', '', '');
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', v_email, 'email_verified', true),
              'email', now(), now(), now());
      insert into public.profiles (id, email, full_name)
      values (uid, v_email, coalesce(nullif(btrim(p_full_name), ''), inv.full_name, ''));
    else
      if (select auth.uid()) is distinct from existing then
        raise exception 'Există deja un cont cu acest email. Autentifică-te, apoi deschide din nou linkul invitației.';
      end if;
      uid := existing;
    end if;

    if inv.kind = 'client' then
      insert into public.company_members (company_id, user_id, role, perm_manage_users, perm_accounting, perm_hr,
                                          perm_view_financials, perm_view_salaries, perm_view_employee_pii)
      values (inv.company_id, uid, inv.role, inv.perm_manage_users, inv.perm_accounting, inv.perm_hr,
              inv.perm_view_financials, inv.perm_view_salaries, inv.perm_view_employee_pii)
      on conflict (company_id, user_id) do update set
        role = excluded.role, perm_manage_users = excluded.perm_manage_users,
        perm_accounting = excluded.perm_accounting, perm_hr = excluded.perm_hr,
        perm_view_financials = excluded.perm_view_financials, perm_view_salaries = excluded.perm_view_salaries,
        perm_view_employee_pii = excluded.perm_view_employee_pii;
    else
      update public.profiles set internal_role = inv.internal_role where id = uid;
    end if;
  end if;

  update public.invitations set accepted_at = now() where id = inv.id;
  insert into public.audit_log (company_id, actor_id, action, entity, entity_id, details)
  values (inv.company_id, uid, 'invitatie_acceptata', 'invitations', inv.id::text,
          jsonb_build_object('tip', inv.kind, 'email', v_email));
  return jsonb_build_object('ok', true, 'email', v_email, 'kind', inv.kind, 'company_id', inv.company_id);
end $$;

-- funcțiile publice sunt simple porți (SECURITY INVOKER) către implementarea din schema privată
create or replace function public.invitation_info(p_token uuid) returns jsonb
language sql stable set search_path = '' as $$ select private.invitation_info(p_token); $$;

create or replace function public.accept_invitation(p_token uuid, p_password text default null, p_full_name text default null)
returns jsonb language sql set search_path = '' as $$ select private.accept_invitation(p_token, p_password, p_full_name); $$;

-- ------------------------------------------- Remindere pentru checklist
-- Termenul unui element (due_day) este ziua din luna următoare perioadei verificate.
create or replace function private.send_checklist_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Bucharest')::date;
  per date := (date_trunc('month', today) - interval '1 month')::date;
  last_day int := extract(day from (date_trunc('month', today) + interval '1 month - 1 day'))::int;
  it record; due date; days_left int;
  luni text[] := array['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'];
begin
  for it in
    select i.* from public.checklist_items i join public.companies c on c.id = i.company_id and not c.is_archived
    where i.is_active and i.due_day is not null
  loop
    due := make_date(extract(year from today)::int, extract(month from today)::int, least(it.due_day, last_day));
    days_left := due - today;
    continue when days_left not in (0, 2);
    continue when exists (select 1 from public.checklist_entries e
                          where e.item_id = it.id and e.period_year = extract(year from per)::int
                            and e.period_month = extract(month from per)::int);
    continue when it.category_code is not null and exists (
      select 1 from public.documents d
      where d.company_id = it.company_id and d.category = it.category_code and d.deleted_at is null
        and d.period_year = extract(year from per)::int and d.period_month = extract(month from per)::int);

    perform private.notify(it.company_id, it.area, false, null, 'reminder',
      case days_left when 0 then 'Termen astăzi: ' else 'Termen în 2 zile: ' end || it.label
        || ' (' || luni[extract(month from per)::int] || ' ' || extract(year from per)::int || ')',
      '/f/' || it.company_id || '/checklist?an=' || extract(year from per)::int || '&luna=' || extract(month from per)::int,
      'chk:' || it.id || ':' || per || ':' || days_left);
  end loop;
end $$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function private.invitation_info(uuid) to anon;
grant execute on function private.accept_invitation(uuid, text, text) to anon;
revoke execute on function private.send_checklist_reminders() from authenticated;

revoke all on function public.invitation_info(uuid) from public;
revoke all on function public.accept_invitation(uuid, text, text) from public;
grant execute on function public.invitation_info(uuid) to anon, authenticated;
grant execute on function public.accept_invitation(uuid, text, text) to anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('gana-remindere-checklist', '0 5 * * *', $$select private.send_checklist_reminders()$$);

-- ------------------------------------------------------- Nomenclatoare
insert into public.document_categories (code, area, direction, label, hint, sensitive_default, sort) values
  ('facturi_emise',     'accounting', 'de_la_client', 'Facturi emise',               'Facturi către clienți', false, 10),
  ('facturi_primite',   'accounting', 'de_la_client', 'Facturi primite',             'Facturi de la furnizori, bonuri fiscale', false, 20),
  ('extrase_bancare',   'accounting', 'de_la_client', 'Extrase bancare',             'PDF, MT940 sau CSV', false, 30),
  ('registru_casa',     'accounting', 'de_la_client', 'Registru de casă',            null, false, 40),
  ('deconturi',         'accounting', 'de_la_client', 'Deconturi',                   'Deconturi de cheltuieli, ordine de deplasare', false, 50),
  ('gestiune_nir',      'accounting', 'de_la_client', 'Documente gestiune / NIR',    'NIR, bonuri de consum, inventar', false, 60),
  ('contracte',         'accounting', 'de_la_client', 'Contracte',                   'Contracte comerciale, de închiriere, leasing', false, 70),
  ('alte_contabilitate','accounting', 'de_la_client', 'Alte documente',              null, false, 80),
  ('balanta',           'accounting', 'de_la_gana',   'Balanță de verificare',       null, true, 110),
  ('situatie_taxe',     'accounting', 'de_la_gana',   'Situație taxe de plată',      null, true, 120),
  ('declaratii',        'accounting', 'de_la_gana',   'Declarații fiscale',          null, true, 130),
  ('fisa_partener',     'accounting', 'de_la_gana',   'Fișă partener',               null, true, 140),
  ('bilant',            'accounting', 'de_la_gana',   'Bilanț / situații financiare', null, true, 150),
  ('alte_rapoarte',     'accounting', 'de_la_gana',   'Alte rapoarte',               null, true, 160),
  ('pontaj',            'hr', 'de_la_client', 'Pontaj lunar',                'Șablonul Gana completat', false, 10),
  ('pontaj_justificative','hr','de_la_client','Documente justificative pontaj','Cereri de concediu, certificate medicale, alte acte', false, 20),
  ('dosar_angajare',    'hr', 'de_la_client', 'Dosar angajare',              'Act de identitate, studii, fișă de aptitudini', false, 30),
  ('documente_angajat', 'hr', 'de_la_client', 'Documente angajat',           null, false, 40),
  ('alte_hr',           'hr', 'de_la_client', 'Alte documente HR',           null, false, 50),
  ('stat_plata',        'hr', 'de_la_gana',   'State de plată',              null, true, 110),
  ('centralizator',     'hr', 'de_la_gana',   'Centralizatoare',             null, true, 120),
  ('fluturasi',         'hr', 'de_la_gana',   'Fluturași de salariu',        null, true, 130),
  ('contracte_acte',    'hr', 'de_la_gana',   'Contracte și acte adiționale','CIM, acte adiționale, decizii', true, 140),
  ('adeverinte',        'hr', 'de_la_gana',   'Adeverințe',                  null, false, 150),
  ('alte_hr_gana',      'hr', 'de_la_gana',   'Alte documente',              null, false, 160);

insert into public.request_types (code, area, label, description, sla_days, sensitive, sort, fields) values
  ('balanta_verificare', 'accounting', 'Balanță de verificare', 'Balanța pentru o lună închisă.', 3, true, 10,
   '[{"name":"luna","label":"Luna","type":"month","required":true}]'),
  ('fisa_partener', 'accounting', 'Fișă partener', 'Situația unui client sau furnizor.', 3, true, 20,
   '[{"name":"partener","label":"Partener (denumire / CUI)","type":"text","required":true},{"name":"de_la","label":"De la data","type":"date"},{"name":"pana_la","label":"Până la data","type":"date"}]'),
  ('situatie_taxe', 'accounting', 'Situație taxe de plată', 'Taxele și impozitele de plată pentru o lună.', 2, true, 30,
   '[{"name":"luna","label":"Luna","type":"month","required":true}]'),
  ('certificat_fiscal', 'accounting', 'Certificat de atestare fiscală', 'Obținerea certificatului de la ANAF.', 5, false, 40,
   '[{"name":"scop","label":"Scopul solicitării","type":"select","options":["Licitație","Bancă / finanțare","Vânzare active","Altul"],"required":true}]'),
  ('bilant', 'accounting', 'Bilanț', 'Situații financiare anuale sau interimare.', 5, true, 50,
   '[{"name":"an","label":"Anul","type":"year","required":true},{"name":"tip","label":"Tip","type":"select","options":["Anual","Semestrial","Interimar"]}]'),
  ('alta_contabilitate', 'accounting', 'Altă solicitare', 'Orice altă cerere pentru contabilitate.', 3, false, 90, '[]'),

  ('adeverinta_salariat', 'hr', 'Adeverință de salariat', 'Confirmă calitatea de angajat.', 2, false, 10,
   '[{"name":"angajat","label":"Angajat","type":"employee","required":true},{"name":"scop","label":"Necesară la","type":"text"}]'),
  ('adeverinta_medic', 'hr', 'Adeverință medic de familie', 'Adeverință de asigurat pentru medicul de familie.', 2, false, 20,
   '[{"name":"angajat","label":"Angajat","type":"employee","required":true}]'),
  ('adeverinta_venit', 'hr', 'Adeverință de venit', 'Veniturile pe ultimele 3, 6 sau 12 luni.', 2, true, 30,
   '[{"name":"angajat","label":"Angajat","type":"employee","required":true},{"name":"perioada","label":"Perioada","type":"select","options":["3 luni","6 luni","12 luni"],"required":true},{"name":"scop","label":"Necesară la","type":"text"}]'),
  ('pachet_incetare', 'hr', 'Pachet complet încetare / lichidare', 'Decizie de încetare, adeverință de vechime, extras Reges, notă de lichidare, adresă stagiu de cotizare.', 3, true, 40,
   '[{"name":"angajat","label":"Angajat","type":"employee","required":true},{"name":"data_incetarii","label":"Data încetării","type":"date","required":true},{"name":"temei","label":"Temei","type":"select","options":["Acordul părților (art. 55 lit. b)","Demisie (art. 81)","Expirarea termenului","Altul"],"required":true}]'),
  ('angajare_noua', 'hr', 'Angajare nouă (onboarding)', 'Date pentru întocmirea contractului individual de muncă. Atașează actele după trimitere.', 2, true, 50,
   '[{"name":"nume","label":"Nume și prenume","type":"text","required":true},{"name":"functie","label":"Funcția","type":"text","required":true},{"name":"data_inceput","label":"Data începerii activității","type":"date","required":true},{"name":"norma","label":"Norma (ore/zi)","type":"select","options":["8","6","4","2"],"required":true},{"name":"durata","label":"Durata contractului","type":"select","options":["Nedeterminată","Determinată"]},{"name":"salariu","label":"Salariu brut (lei)","type":"text","required":true}]'),
  ('modificare_cim', 'hr', 'Modificare contract (CIM)', 'Schimbare de salariu, funcție, normă sau alte clauze.', 2, true, 60,
   '[{"name":"angajat","label":"Angajat","type":"employee","required":true},{"name":"ce_se_modifica","label":"Ce se modifică","type":"select","options":["Salariu","Funcție","Normă","Durată","Loc de muncă","Altceva"],"required":true},{"name":"de_la","label":"Valabil de la","type":"date","required":true},{"name":"valoare_noua","label":"Noua valoare / detalii","type":"text","required":true}]'),
  ('incetare_cim', 'hr', 'Încetare contract (CIM)', 'Solicitare de încetare a unui contract.', 2, true, 70,
   '[{"name":"angajat","label":"Angajat","type":"employee","required":true},{"name":"data_incetarii","label":"Data încetării","type":"date","required":true},{"name":"temei","label":"Temei","type":"select","options":["Acordul părților (art. 55 lit. b)","Demisie (art. 81)","Expirarea termenului","Altul"],"required":true}]'),
  ('alta_hr', 'hr', 'Altă solicitare', 'Orice altă cerere pentru HR & Payroll.', 3, false, 90, '[]');

insert into public.checklist_template_items (area, label, category_code, due_day, sort) values
  ('accounting', 'Facturi emise',            'facturi_emise',   10, 10),
  ('accounting', 'Facturi primite',          'facturi_primite', 10, 20),
  ('accounting', 'Extrase bancare',          'extrase_bancare', 10, 30),
  ('accounting', 'Registru de casă',         'registru_casa',   10, 40),
  ('accounting', 'Deconturi',                'deconturi',       10, 50),
  ('accounting', 'Documente gestiune / NIR', 'gestiune_nir',    10, 60),
  ('hr',         'Pontaj lunar',             'pontaj',           3, 10),
  ('hr',         'Documente justificative pontaj', 'pontaj_justificative', 3, 20);
