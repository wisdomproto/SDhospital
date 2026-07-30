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

-- 회차 리포트 열람 표시 — 보호자는 자기 반려동물의 리포트만 읽음 처리할 수 있어야 한다
reset role;
insert into visit (id, patient_id, visit_date, report_sent_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', current_date, now()),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', current_date, now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select mark_visit_report_read('dddddddd-0000-0000-0000-000000000001');  -- 본인 반려동물
select mark_visit_report_read('dddddddd-0000-0000-0000-000000000002');  -- 남의 반려동물

reset role;
do $$
declare mine timestamptz; theirs timestamptz;
begin
  select report_read_at into mine   from visit where id = 'dddddddd-0000-0000-0000-000000000001';
  select report_read_at into theirs from visit where id = 'dddddddd-0000-0000-0000-000000000002';
  if mine is null then raise exception 'ownerX must be able to mark their own report read'; end if;
  if theirs is not null then raise exception 'ownerX must NOT mark another owner''s report read'; end if;
end $$;

-- 미발송 리포트는 열람 처리되지 않아야 한다
insert into visit (id, patient_id, visit_date) values
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', current_date);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select mark_visit_report_read('dddddddd-0000-0000-0000-000000000003');
reset role;
do $$
declare unsent timestamptz;
begin
  select report_read_at into unsent from visit where id = 'dddddddd-0000-0000-0000-000000000003';
  if unsent is not null then raise exception 'unsent report must not be markable as read'; end if;
end $$;

-- 입원 일일 리포트 열람 표시 — 회차 리포트와 같은 규칙
reset role;
insert into admission (id, visit_id, patient_id, admitted_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', current_date),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', current_date);
insert into admission_report (id, admission_id, report_date, comment, sent_at) values
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', current_date, 'X 경과', now()),
  ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002', current_date, 'Y 경과', now());
insert into admission_report (id, admission_id, report_date, comment) values
  ('ffffffff-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', current_date - 1, '미발송');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select mark_admission_report_read('ffffffff-0000-0000-0000-000000000001');
select mark_admission_report_read('ffffffff-0000-0000-0000-000000000002');
select mark_admission_report_read('ffffffff-0000-0000-0000-000000000003');

reset role;
do $$
declare mine timestamptz; theirs timestamptz; unsent timestamptz;
begin
  select read_at into mine   from admission_report where id = 'ffffffff-0000-0000-0000-000000000001';
  select read_at into theirs from admission_report where id = 'ffffffff-0000-0000-0000-000000000002';
  select read_at into unsent from admission_report where id = 'ffffffff-0000-0000-0000-000000000003';
  if mine is null then raise exception 'ownerX must mark their own daily report read'; end if;
  if theirs is not null then raise exception 'ownerX must NOT mark another owner''s daily report read'; end if;
  if unsent is not null then raise exception 'unsent daily report must not be markable as read'; end if;
end $$;

-- 접근 로그 — 외부 역할은 남길 수만 있고, 읽지도 고치지도 못한다
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select log_access('cccccccc-0000-0000-0000-000000000001', 'visit', 'dddddddd-0000-0000-0000-000000000001');

do $$
declare n int;
begin
  select count(*) into n from access_log;
  if n <> 0 then raise exception 'vetA must not read access_log, saw %', n; end if;
  begin
    insert into access_log (actor_role, target) values ('staff', 'forged');
    raise exception 'vetA must not insert into access_log directly';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$
declare r text;
begin
  select actor_role into r from access_log
   where patient_id = 'cccccccc-0000-0000-0000-000000000001' order by at desc limit 1;
  if r is distinct from 'referring_vet' then raise exception 'log_access must stamp the real role, got %', r; end if;
end $$;

-- 웹 푸시 구독 — 남의 기기로 알림을 보낼 수 있으면 안 된다
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into push_subscription (user_id, endpoint, p256dh, auth)
values ('22222222-2222-2222-2222-222222222222', 'https://example.test/ep-owner-x', 'k', 'a');

do $$
declare n int;
begin
  select count(*) into n from push_subscription;
  if n <> 1 then raise exception 'ownerX should see only their own subscription, saw %', n; end if;
  -- 발송용 함수는 직원 전용이다
  begin
    perform push_targets_for_patient('cccccccc-0000-0000-0000-000000000001');
    raise exception 'ownerX must not call push_targets_for_patient';
  exception when others then null;
  end;
end $$;

-- vetA 는 남의 구독을 볼 수도, 만들 수도 없다
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from push_subscription;
  if n <> 0 then raise exception 'vetA must not see push subscriptions, saw %', n; end if;
  begin
    insert into push_subscription (user_id, endpoint, p256dh, auth)
    values ('22222222-2222-2222-2222-222222222222', 'https://example.test/forged', 'k', 'a');
    raise exception 'vetA must not insert a subscription for another user';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 알림 대상은 소속으로만 잡힌다 — 남의 병원 환자 알림이 가면 그게 유출이다
reset role;
insert into push_subscription (user_id, endpoint, p256dh, auth)
values ('11111111-1111-1111-1111-111111111111', 'https://example.test/ep-vet-a', 'k', 'a');

do $$
declare mine int; theirs int; owners int;
begin
  -- Pet-Referred-by-A 는 Hospital A 의뢰 → vetA 기기가 잡혀야 한다
  select count(*) into mine from push_targets_for_hospital('cccccccc-0000-0000-0000-000000000001');
  -- Pet-Referred-by-B 는 Hospital B 의뢰 → vetA 는 잡히면 안 된다
  select count(*) into theirs from push_targets_for_hospital('cccccccc-0000-0000-0000-000000000002');
  -- 원장 구독이 보호자 알림 대상으로 새어 나가면 안 된다
  select count(*) into owners from push_targets_for_patient('cccccccc-0000-0000-0000-000000000001');
  if mine <> 1 then raise exception 'vetA device must be a target for their referred patient, got %', mine; end if;
  if theirs <> 0 then raise exception 'vetA must NOT be a target for Hospital B patient, got %', theirs; end if;
  if owners <> 1 then raise exception 'owner targets should be ownerX only, got %', owners; end if;
end $$;

-- 건강검진 — 보호자는 발송된 것만, 값도 부모의 가시성을 따라야 한다
reset role;
insert into checkup (id, patient_id, visit_id, checked_on, conclusion) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001', current_date, '종합 소견');
insert into checkup_value (checkup_id, section_key, item_key, value) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'chemistry', 'BUN', '44.2');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
declare n int; v int;
begin
  select count(*) into n from checkup;
  select count(*) into v from checkup_value;
  if n <> 0 then raise exception 'ownerX must not see an unsent checkup, saw %', n; end if;
  if v <> 0 then raise exception 'ownerX must not see values of an unsent checkup, saw %', v; end if;
end $$;

reset role;
update checkup set sent_at = now() where id = 'aaaaaaaa-1111-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select mark_checkup_read('aaaaaaaa-1111-4000-8000-000000000001');
do $$
declare n int; v int;
begin
  select count(*) into n from checkup;
  select count(*) into v from checkup_value;
  if n <> 1 then raise exception 'ownerX should see the sent checkup, saw %', n; end if;
  if v <> 1 then raise exception 'ownerX should see its values, saw %', v; end if;
end $$;

reset role;
do $$
declare r timestamptz;
begin
  select read_at into r from checkup where id = 'aaaaaaaa-1111-4000-8000-000000000001';
  if r is null then raise exception 'mark_checkup_read must stamp read_at'; end if;
end $$;

reset role;
select 'RLS TESTS PASSED' as result;
rollback;
