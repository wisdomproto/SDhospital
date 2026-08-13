-- 그 집의 사정 (2026-08-13)
--
-- 진료기록 106명분을 사람이 직접 읽으면서 나온 것들이다. **진료 내용이 아니다.**
-- 병명은 visit.note 에 있다. 여기 들어가는 건 그 기록을 읽어야만 알 수 있는 **맥락**이다 —
--
--   "이 집은 2년째 병원에 못 온다"            → 「내원하세요」가 통하지 않는다
--   "이 아이는 앞발 감각이 없다"                → 「안 아파해요」가 정상이다
--   "보호자가 나이를 이유로 수술을 원치 않는다"  → 검사·수술을 권하면 안 된다
--   "새끼를 전부 잃었다"                        → 출산 이야기를 꺼내면 안 된다
--   "양쪽 다 수술했다"                          → 어느 쪽인지 반드시 물어야 한다
--
-- ⚠️ **사망은 여기 넣지 않는다.** 그건 patient.note 에 이미 있고, 컨텍스트가 맨 앞에서 읽는다.
-- 여기는 「살아 있지만 조심해야 하는 것」이다.
--
-- ⚠️ **직원만 본다.** 보호자에게 보이면 안 되는 문장이 섞여 있다
-- (비용 상담, 1차 병원과의 정보 비공유, 안락사 고려 언급 등).
-- 채팅 컨텍스트가 이걸 읽게 만들지는 **아직 하지 않았다** — 원장님과 전략을 정한 뒤에 연결한다.

create table patient_caution (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  -- 'confirm'  사람이 확인해야 답할 수 있는 것 (생사·현재 상태 불명 등)
  -- 'context'  답할 때 알고 있어야 하는 그 집의 사정
  kind text not null default 'context' check (kind in ('confirm', 'context')),
  body text not null,
  -- 어디서 나왔나. 나중에 "이 문장 어디서 왔지" 를 되짚는 유일한 방법
  source text not null default '진료기록 추출',
  resolved_at timestamptz,          -- 확인이 끝나면 여기에 시각. 지우지 않는다
  resolved_note text,
  created_at timestamptz not null default now()
);
create index on patient_caution (patient_id);
create index on patient_caution (kind) where resolved_at is null;

alter table patient_caution enable row level security;

-- ⚠️ 직원만. 보호자·1차병원 정책을 **의도적으로 만들지 않는다.**
create policy caution_staff_all on patient_caution for all
  using (current_role_name() = 'staff')
  with check (current_role_name() = 'staff');

comment on table patient_caution is
  '진료기록을 읽어야만 알 수 있는 그 집의 사정. 직원 전용. 채팅 연결은 전략 확정 후.';
