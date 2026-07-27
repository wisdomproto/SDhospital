-- 0009_admission_report.sql
--   1) 입원 일일 리포트 (입원 1건에 하루 1건 → 회차 리포트와 달리 별도 테이블)
--   2) 진료 종료 표시 (visit.closed_at) — "오늘 할 일" 목록이 리포트 보낼 회차를 고르는 기준

-- 1) 입원 일일 리포트 ---------------------------------------------------------
create table admission_report (
  id            uuid primary key default gen_random_uuid(),
  admission_id  uuid not null references admission(id) on delete cascade,
  report_date   date not null default current_date,
  comment       text,
  sent_at       timestamptz,
  read_at       timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (admission_id, report_date)   -- 하루 한 건
);
create index admission_report_admission_idx on admission_report (admission_id, report_date desc);

-- 사진·바이털은 복사하지 않는다. 이미 media(admission_id) / vital(admission_id) 에 있고
-- 리포트는 report_date 기준으로 그날 것을 조립해서 보여준다.

alter table admission_report enable row level security;

create policy adm_report_staff_all on admission_report for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');

create policy adm_report_external_read on admission_report for select
  using (exists (
    select 1 from admission a join patient p on p.id = a.patient_id
    where a.id = admission_report.admission_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- 보호자는 읽기 전용이므로 열람 표시는 DEFINER 함수로만 (회차 리포트와 같은 방식)
create or replace function mark_admission_report_read(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update admission_report r
  set read_at = now()
  from admission a join patient p on p.id = a.patient_id
  where r.id = p_report_id
    and a.id = r.admission_id
    and r.sent_at is not null
    and r.read_at is null
    and current_role_name() = 'owner'
    and p.owner_id = current_owner_id();
end
$$;

revoke all on function mark_admission_report_read(uuid) from public;
grant execute on function mark_admission_report_read(uuid) to authenticated;

-- 2) 진료 종료 표시 -----------------------------------------------------------
-- 종료된 회차만 "리포트 보낼 것"으로 올라온다. 종료 전에는 아직 진료 중이다.
alter table visit add column if not exists closed_at timestamptz;

-- 이미 있던 회차는 지난 진료이므로 종료된 것으로 본다 (미발송 목록이 과거로 폭발하지 않게)
update visit set closed_at = created_at where closed_at is null;

create index if not exists visit_report_todo_idx
  on visit (closed_at) where report_sent_at is null;
