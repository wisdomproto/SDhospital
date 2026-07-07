-- supabase/tests/rls.sql
-- Local run (with Docker/psql):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Asserts a referring_vet sees only their referred patient and an owner
-- sees only their own pet. Rolls back all seed data at the end.

begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'vetA@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ownerX@example.com');

insert into referring_hospital (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Hospital A'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Hospital B');

insert into owner (id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Owner X'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Owner Y');

insert into patient (id, owner_id, referring_hospital_id, name) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Pet-Referred-by-A'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pet-Referred-by-B');

insert into profile (id, role, referring_hospital_id, owner_id) values
  ('11111111-1111-1111-1111-111111111111', 'referring_vet', 'aaaaaaaa-0000-0000-0000-000000000001', null),
  ('22222222-2222-2222-2222-222222222222', 'owner', null, 'bbbbbbbb-0000-0000-0000-000000000001');

-- impersonate vet A (referred by Hospital A)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from patient;
  if n <> 1 then raise exception 'vetA should see exactly 1 patient, saw %', n; end if;
  perform 1 from patient where name = 'Pet-Referred-by-A';
  if not found then raise exception 'vetA must see their referred patient'; end if;
  perform 1 from patient where name = 'Pet-Referred-by-B';
  if found then raise exception 'vetA must NOT see Hospital B patient'; end if;
end $$;

-- impersonate owner X
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from patient;
  if n <> 1 then raise exception 'ownerX should see exactly 1 patient, saw %', n; end if;
  perform 1 from patient where owner_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if not found then raise exception 'ownerX must see their own pet'; end if;
end $$;

reset role;
select 'RLS TESTS PASSED' as result;
rollback;
