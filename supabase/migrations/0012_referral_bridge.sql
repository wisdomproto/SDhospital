-- 0012_referral_bridge.sql — 레퍼럴 브릿지 (1차병원 회신·환송·접근 로그)
--
-- 진행 상태는 컬럼으로 저장하지 않는다. 이미 있는 사실에서 파생된다:
--   진료중 = closed_at is null / 입원중 = admission.status / 퇴원 = discharged_at
-- 저장하면 실제 상태와 어긋나는 순간이 반드시 온다. 유일하게 파생할 수 없는 것이
-- "환송했는가" 라서 그것만 컬럼으로 둔다.

alter table visit add column if not exists referral_note text;      -- 1차병원에 보내는 회신 소견
alter table visit add column if not exists referred_back_at timestamptz;

create index if not exists visit_referral_pending_idx
  on visit (closed_at) where referred_back_at is null;

-- ── 접근 로그 ────────────────────────────────────────────────
-- "누가 언제 어떤 환자 기록을 열었는지" 는 1차병원에게 데이터를 열어주는 조건이자
-- 의료정보 취급의 기본이다. 외부 역할은 직접 쓸 수 없으므로 DEFINER 함수로만 남긴다.
create table access_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  actor_role text not null,
  patient_id uuid references patient(id) on delete cascade,
  target     text not null,     -- 'patient' | 'visit' | 'admission' | 'consent'
  target_id  uuid,
  at         timestamptz not null default now()
);
create index access_log_patient_idx on access_log (patient_id, at desc);
create index access_log_actor_idx on access_log (actor_id, at desc);

alter table access_log enable row level security;

-- 직원만 읽는다. 외부 역할은 자기 열람 기록도 조회하지 않는다(로그 자체가 감사 대상).
create policy access_log_staff_read on access_log for select
  using (current_role_name() = 'staff');

create or replace function log_access(
  p_patient_id uuid,
  p_target     text,
  p_target_id  uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into access_log (actor_id, actor_role, patient_id, target, target_id)
  values (auth.uid(), coalesce(current_role_name(), 'unknown'), p_patient_id, p_target, p_target_id);
end
$$;

revoke all on function log_access(uuid, text, uuid) from public;
grant execute on function log_access(uuid, text, uuid) to authenticated;
