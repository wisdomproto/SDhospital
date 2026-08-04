-- 0025_life_log.sql — 생활기록 (보호자가 남기는 평소)
--
-- 채팅의 나머지 절반이다. 진료 기록은 **우리에게 온 환자만** 있고, 1차 병원 환자로 넓히면
-- 그 아이들에게는 이것뿐이다. 문의 1위인 식욕 부진에 답할 수 없었던 이유도
-- 원인이 제각각이어서가 아니라 **평소를 몰라서**다.
--
-- 두 층으로 나눈다. 성격이 다르기 때문이다.
--   life_log    매일 바뀌는 것 — 식사·배변·활력·체중·복약·메모
--   life_intake 몇 달에 한 번 바뀌는 것 — 입에 들어가는 것 전부
--
-- ⚠️ **나누는 기준은 종류가 아니라 출처다.** 우리가 처방한 약은 이미 `prescription` 에 있으니
-- 보호자는 `meds` 로 체크만 하고, 그 밖에 입에 들어가는 건 사료·간식·과일·영양제·다른 병원 약을
-- **구분하지 않고 한 테이블**에 넣는다. 칸을 넷으로 나누면 "과일은 어디 넣나"가 생기고,
-- 그때부터 아무도 안 적는다.
--
-- ⚠️ **보호자가 쓰는 첫 테이블이다.** 다른 외부 역할 쓰기는 전부 DEFINER 함수를 거치는데
-- (`sign_consent`·`mark_*_read`), 그건 보호자가 **볼 수 없는 남의 행**을 고치기 때문이다.
-- 여기는 자기가 만든 자기 행이라 RLS 정책으로 충분하다. DEFINER 로 감싸도 검사는 똑같다.

create table life_log (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patient(id) on delete cascade,
  logged_on     date not null default current_date,
  -- 전부 선택이다. 하나만 골라도 저장된다 — 매일 다 채우게 하면 몇 주 만에 끊긴다.
  appetite      text,          -- src/lib/life-log.ts APPETITE
  stool         text,          -- STOOL
  energy        text,          -- ENERGY
  weight_kg     numeric(5,2),
  -- ⚠️ 집 체중계와 병원 저울은 값이 다르다. 섞이면 회차 리포트의 "지난 방문 대비"가 오염된다.
  weight_source text not null default 'home' check (weight_source in ('home', 'clinic')),
  meds          text,          -- MEDS — 우리 처방을 오늘 먹였는가
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 하루 한 행. 다시 열면 고치는 것이지 새로 쌓는 게 아니다.
  unique (patient_id, logged_on)
);
create index life_log_patient_idx on life_log (patient_id, logged_on desc);

-- 사진은 하루에 여러 장. 본문은 Storage 에 둔다 —
-- 매일 한 장씩만 쌓여도 3년이면 1,000장이라 컬럼에 base64 로 담으면 DB 가 감당하지 못한다.
-- 경로는 `life/<patient_id>/...` — `can_read_patient_file()` 이 두 번째 칸에서 환자를 읽는다.
create table life_photo (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patient(id) on delete cascade,
  log_id       uuid not null references life_log(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
create index life_photo_log_idx on life_photo (log_id);

-- 입에 들어가는 것. **바뀔 때만** 손대는 목록이라 날짜별로 쌓지 않는다.
-- 여기 행을 추가한 날이 곧 "그때부터 주기 시작했다"이고, 그래서
-- 설사·구토 문의에서 병원이 가장 많이 묻는 **"최근에 사료 바꾸셨나요"** 를 따로 물을 필요가 없다.
create table life_intake (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patient(id) on delete cascade,
  label       text,          -- 선택. 보호자는 약 이름을 모른다 — 사진이 본체다
  photo_path  text,          -- 약봉투·사료 포대. 찍으면 병원명·제품명·성분표가 다 들어온다
  started_on  date not null default current_date,
  stopped_on  date,          -- 끊으면 여기만 찍는다. 지우지 않는다 — 지난 원인을 되짚어야 한다
  created_at  timestamptz not null default now()
);
create index life_intake_patient_idx on life_intake (patient_id, started_on desc);

alter table life_log enable row level security;
alter table life_photo enable row level security;
alter table life_intake enable row level security;

-- 직원 --------------------------------------------------------------------
create policy life_log_staff_all on life_log for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy life_photo_staff_all on life_photo for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy life_intake_staff_all on life_intake for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');

-- 보호자 — 자기 반려동물만. 읽고 쓰고 고칠 수 있다 (자기가 만든 자기 기록이다) ----
create policy life_log_owner_all on life_log for all
  using (current_role_name() = 'owner' and patient_id in (select id from patient where owner_id = current_owner_id()))
  with check (current_role_name() = 'owner' and patient_id in (select id from patient where owner_id = current_owner_id()));
create policy life_photo_owner_all on life_photo for all
  using (current_role_name() = 'owner' and patient_id in (select id from patient where owner_id = current_owner_id()))
  with check (current_role_name() = 'owner' and patient_id in (select id from patient where owner_id = current_owner_id()));
create policy life_intake_owner_all on life_intake for all
  using (current_role_name() = 'owner' and patient_id in (select id from patient where owner_id = current_owner_id()))
  with check (current_role_name() = 'owner' and patient_id in (select id from patient where owner_id = current_owner_id()));

-- 1차 병원 원장 — 의료진이라 자기가 의뢰한 환자의 것은 전부 읽는다 (쓰지는 않는다) ----
create policy life_log_vet_read on life_log for select
  using (current_role_name() = 'referring_vet'
         and patient_id in (select id from patient where referring_hospital_id = current_hospital_id()));
create policy life_photo_vet_read on life_photo for select
  using (current_role_name() = 'referring_vet'
         and patient_id in (select id from patient where referring_hospital_id = current_hospital_id()));
create policy life_intake_vet_read on life_intake for select
  using (current_role_name() = 'referring_vet'
         and patient_id in (select id from patient where referring_hospital_id = current_hospital_id()));

-- Storage — 보호자가 **처음으로 파일을 올린다.**
-- 읽기는 `patient_files_external_read`(0005) 가 이미 열어 준다. 여기서 여는 건 쓰기뿐이고,
-- `life/` 로 시작하는 자기 반려동물 경로에만 넣을 수 있다.
create policy "life_files_owner_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'patient-files'
  and public.current_role_name() = 'owner'
  and name like 'life/%'
  and public.can_read_patient_file(name)
);

create or replace function touch_life_log() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger life_log_touch before update on life_log
  for each row execute function touch_life_log();
