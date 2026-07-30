-- 0023_checkup.sql — 건강검진 결과서
--
-- 실제 결과서 5부를 보고 만들었다. **PDF 를 파싱하지 않는다** — 지금 그 PDF 는
-- 사람이 템플릿에 손으로 채워 만드는 것이라, 항목명·단위·제목이 결과서마다 흔들린다
-- (`cPL`/`PancreaticLipase`, 혈청화학 ALB 단위를 `umol/L` 로 적은 결과서도 있다).
-- 그래서 입력을 우리 화면에서 받고, 항목·단위·참고범위는 코드에 고정한다
-- (`src/lib/checkup/template.ts`). 결과서 출력은 우리가 만든다.
--
-- 검진도 "그날 병원에 와서 받은 것"이므로 **회차에 딸린다**(회차당 1건).
-- 값은 세로로 쌓는다 — 항목이 100개에 가깝고 검진마다 있는 항목이 다르다.
-- 컬럼으로 만들면 항목이 하나 늘 때마다 마이그레이션을 해야 한다.

create table checkup (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patient(id) on delete cascade,
  visit_id     uuid not null references visit(id) on delete cascade,
  checked_on   date not null default current_date,
  vet_name     text,
  conclusion   text,          -- 담당의 종합 소견 (결과서 뒤쪽 몇 페이지에 해당)
  recheck_on   date,          -- 결과서가 이미 알려주는 재검 시점. 지금은 아무도 안 챙긴다
  recheck_note text,
  sent_at      timestamptz,   -- 보호자 발송 (수의사가 누를 때만)
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  -- 검진의 환자와 회차의 환자가 어긋날 수 없게 (입원과 같은 방식)
  constraint checkup_visit_patient_fk
    foreign key (visit_id, patient_id) references visit(id, patient_id)
);
create unique index checkup_visit_uniq on checkup (visit_id);
create index checkup_recheck_idx on checkup (recheck_on) where recheck_on is not null;

create table checkup_value (
  id          uuid primary key default gen_random_uuid(),
  checkup_id  uuid not null references checkup(id) on delete cascade,
  section_key text not null,
  item_key    text not null,
  value       text,           -- 숫자만 오지 않는다: Negative · 음성 · 2+ · <1/HPF · Panting
  side        text,           -- 안과처럼 좌/우를 따로 적는 항목 ('L' | 'R')
  note        text,           -- 섹션 해석문 / 서술형 소견
  unique (checkup_id, section_key, item_key, side)
);
create index checkup_value_checkup_idx on checkup_value (checkup_id);

alter table checkup enable row level security;
alter table checkup_value enable row level security;

create policy checkup_staff_all on checkup for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy checkup_value_staff_all on checkup_value for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');

-- 보호자는 **발송된 것만** 본다 (리포트와 같은 규칙)
create policy checkup_owner_read on checkup for select
  using (
    current_role_name() = 'owner' and sent_at is not null
    and patient_id in (select pt.id from patient pt join profile pr on pr.id = auth.uid() where pt.owner_id = pr.owner_id)
  );
-- 1차병원 원장은 의료진이라 발송 여부와 무관하게 본다
create policy checkup_vet_read on checkup for select
  using (
    current_role_name() = 'referring_vet'
    and patient_id in (
      select pt.id from patient pt join profile pr on pr.id = auth.uid()
      where pt.referring_hospital_id = pr.referring_hospital_id
    )
  );

-- 값은 부모(checkup)의 가시성을 그대로 따른다
create policy checkup_value_external_read on checkup_value for select
  using (checkup_id in (select id from checkup));

create or replace function mark_checkup_read(p_checkup_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update checkup c set read_at = now()
  where c.id = p_checkup_id and c.sent_at is not null and c.read_at is null
    and c.patient_id in (
      select pt.id from patient pt join profile pr on pr.id = auth.uid()
      where pr.role = 'owner' and pt.owner_id = pr.owner_id
    );
end $$;
revoke all on function mark_checkup_read(uuid) from public;
grant execute on function mark_checkup_read(uuid) to authenticated;
