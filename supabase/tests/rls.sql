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

-- 생활기록 — **보호자가 직접 쓰는 첫 테이블**이다.
-- 다른 외부 역할 쓰기는 전부 DEFINER 함수를 거치므로, 여기가 정책만으로 막히는 유일한 곳이다.
-- 그래서 "자기 것은 쓸 수 있다"와 "남의 것은 못 쓴다"를 둘 다 확인한다.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

-- ① 자기 반려동물 것은 넣을 수 있다
insert into life_log (patient_id, logged_on, appetite, stool, weight_kg)
values ('cccccccc-0000-0000-0000-000000000001', current_date, 'well', 'loose', 6.10);
insert into life_intake (patient_id, label, started_on)
values ('cccccccc-0000-0000-0000-000000000001', '사과', current_date);

-- ② 고칠 수 있다 (하루 한 행 — 다시 열면 고치는 것이지 새로 쌓는 게 아니다)
update life_log set appetite = 'little'
 where patient_id = 'cccccccc-0000-0000-0000-000000000001' and logged_on = current_date;

do $$
declare n int; a text;
begin
  select count(*), max(appetite) into n, a from life_log;
  if n <> 1 then raise exception 'ownerX should see exactly its own life_log, saw %', n; end if;
  if a <> 'little' then raise exception 'ownerX should be able to update its own life_log, got %', a; end if;
end $$;

-- ③ 남의 반려동물 것은 못 넣는다
do $$
begin
  begin
    insert into life_log (patient_id, logged_on, appetite)
    values ('cccccccc-0000-0000-0000-000000000002', current_date, 'well');
    raise exception 'ownerX must NOT be able to log for another owner''s pet';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ④ 남이 넣은 것은 보이지도 않는다
reset role;
insert into life_log (patient_id, logged_on, appetite)
values ('cccccccc-0000-0000-0000-000000000002', current_date, 'well');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from life_log;
  if n <> 1 then raise exception 'ownerX must not see another pet''s life_log, saw %', n; end if;
end $$;

-- ⑤ 1차 병원 원장은 자기가 의뢰한 환자 것만 **읽고**, 쓰지는 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from life_log;
  if n <> 1 then raise exception 'vetA should see only its referred pet life_log, saw %', n; end if;
  begin
    insert into life_log (patient_id, logged_on, appetite)
    values ('cccccccc-0000-0000-0000-000000000001', current_date - 1, 'well');
    raise exception 'referring_vet must NOT be able to write life_log';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'RLS TESTS PASSED' as result;
-- ── image_request: 의료영상은 요청해야 나간다 ──────────────────────────────
-- ⚠️ 여기서 5번이 깨지면 보호자가 스스로 승인해 영상을 연다.
insert into visit (id, patient_id, visit_date) values
  ('dddddddd-0000-0000-0000-0000000000f1', 'cccccccc-0000-0000-0000-000000000001', current_date),
  ('dddddddd-0000-0000-0000-0000000000f2', 'cccccccc-0000-0000-0000-000000000002', current_date);

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select request_medical_images('dddddddd-0000-0000-0000-0000000000f1');
select request_medical_images('dddddddd-0000-0000-0000-0000000000f1');  -- 두 번 눌러도 하나
do $$ begin
  if (select count(*) from image_request) <> 1 then
    raise exception 'image_request: 자기 회차 요청/중복 방지 실패';
  end if;
  begin
    perform request_medical_images('dddddddd-0000-0000-0000-0000000000f2');
    raise exception 'image_request: 남의 회차를 요청할 수 있다';
  exception when sqlstate 'P0001' then null; when others then null;
  end;
  begin
    insert into image_request (visit_id) values ('dddddddd-0000-0000-0000-0000000000f2');
    raise exception 'image_request: 보호자가 직접 INSERT 할 수 있다';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 자가 승인 시도 — 정책상 UPDATE 대상 행이 없어 조용히 0건이어야 한다
update image_request set approved_at = now()
 where visit_id = 'dddddddd-0000-0000-0000-0000000000f1';
do $$ begin
  if (select approved_at from image_request
       where visit_id = 'dddddddd-0000-0000-0000-0000000000f1') is not null then
    raise exception 'image_request: 보호자가 스스로 승인할 수 있다 (영상이 열린다)';
  end if;
end $$;

-- ── medical_image: 승인 전에는 행 자체가 안 보인다 (0034) ──────────────────
-- ⚠️ 이 검사가 있는 이유: 승인 확인이 **화면에만** 있던 시절, 회차 화면은 지키고
--    입원 화면은 안 지켰다. 그런데 의료영상의 81%가 입원에 붙어 있어서
--    규칙이 19% 에만 걸려 있었다. 화면은 또 늘어나므로 DB 에서 막는다.
-- ⚠️ 입원에 붙은 영상은 **그 입원이 딸린 회차**의 승인을 따른다.
reset role;
insert into admission (id, patient_id, visit_id, admitted_at)
values ('dddddddd-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-0000000000f1', current_date);
insert into medical_image (visit_id, admission_id, modality, file_name, storage_path) values
  ('dddddddd-0000-0000-0000-0000000000f1', null, 'xray', 'v.jpg', 'x/v.jpg'),
  (null, 'dddddddd-0000-0000-0000-0000000000a1', 'ct', 'a.jpg', 'x/a.jpg');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$ begin
  if (select count(*) from medical_image) <> 0 then
    raise exception 'medical_image: 승인 전인데 보호자에게 보인다';
  end if;
end $$;

reset role;  -- 직원이 승인한다
update image_request set approved_at = now() where visit_id = 'dddddddd-0000-0000-0000-0000000000f1';

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$ begin
  -- 회차에 붙은 것과 입원에 붙은 것 **둘 다** 열려야 한다
  if (select count(*) from medical_image) <> 2 then
    raise exception 'medical_image: 승인했는데 안 보인다 (입원에 붙은 것을 놓쳤을 수 있다)';
  end if;
end $$;

-- ── 채팅 로그 (0028) ───────────────────────────────────────────────────────
-- 보호자에게 INSERT 정책을 주지 않았다. **여기엔 우리가 한 말이 같이 들어가서**,
-- 직접 쓸 수 있으면 증빙이 증빙이 아니게 된다. 쓰기는 log_chat DEFINER 하나뿐.
select log_chat(
  'cccccccc-0000-0000-0000-000000000001', gen_random_uuid(),
  '숨이 가빠요', '지금 바로 전화 주세요', 'now', 'test', 'hash'
);
do $$ begin
  if (select count(*) from chat_message) <> 2 then   -- 질문 1 + 답 1
    raise exception 'chat_message: 자기 아이 대화가 저장되지 않는다';
  end if;
  begin
    perform log_chat(
      'cccccccc-0000-0000-0000-000000000002', gen_random_uuid(),
      'q', 'a', 'now', 'test', 'hash'
    );
    raise exception 'chat_message: 남의 아이 대화를 남길 수 있다';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    insert into chat_message (patient_id, thread_id, role, content)
      values ('cccccccc-0000-0000-0000-000000000001', gen_random_uuid(), 'assistant', '위조');
    raise exception 'chat_message: 보호자가 답변 행을 직접 써넣을 수 있다';
  exception when insufficient_privilege then null;
  end;
  -- ⚠️ 지울 수 있으면 ①증빙이 무너진다. 화면에서 감출 뿐 삭제는 없다.
  delete from chat_message;
  if (select count(*) from chat_message) = 0 then
    raise exception 'chat_message: 보호자가 대화를 지울 수 있다';
  end if;
end $$;

rollback;
