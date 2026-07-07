-- 0002_rls_helpers.sql — role helper functions (SECURITY DEFINER)

create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from profile where id = auth.uid()
$$;

create or replace function current_owner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select owner_id from profile where id = auth.uid()
$$;

create or replace function current_hospital_id() returns uuid
language sql stable security definer set search_path = public as $$
  select referring_hospital_id from profile where id = auth.uid()
$$;
