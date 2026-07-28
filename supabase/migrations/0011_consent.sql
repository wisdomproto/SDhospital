-- 0011_consent.sql — 전자 동의서
--
-- 양식 본문은 코드(src/lib/consent/forms.ts)에 둔다. git 이 곧 버전 관리다.
-- DB 에는 서명 결과만 남기되, **서명 시점의 본문 전문(body_snapshot)** 을 함께 박아둔다.
-- 나중에 병원이 문구를 고쳐도 "그때 무엇에 동의했는지"가 그대로 남아야 증빙이 된다.

create table consent (
  id             uuid primary key default gen_random_uuid(),
  visit_id       uuid not null,
  patient_id     uuid not null,
  form_code      text not null,
  form_title     text not null,
  -- 발행 시 직원이 채우는 값 (진단, 처치, 퇴원사유 …)
  fields         jsonb not null default '{}'::jsonb,
  -- 보호자가 서명 전에 고른 항목 (CPR/DNR, 사진 게시 여부 …)
  answers        jsonb,
  body_snapshot  text,
  signer_name    text,
  -- 주민등록번호는 고유식별정보 — 앱에서 AES-256-GCM 으로 암호화한 값만 들어온다
  signer_rrn_enc text,
  -- 서명 이미지(PNG data URL). Storage 대신 행에 두는 이유:
  -- 보호자는 Storage 쓰기 권한이 없고, 서명은 증빙이라 기록과 붙어 있어야 한다.
  signature_png  text,
  signed_at      timestamptz,
  signed_ip      text,
  signed_ua      text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  -- 입원과 같은 방식: 동의서의 환자가 회차의 환자와 어긋날 수 없다
  foreign key (visit_id, patient_id) references visit (id, patient_id) on delete cascade
);
create index consent_visit_idx on consent (visit_id);
create index consent_patient_pending_idx on consent (patient_id) where signed_at is null;

alter table consent enable row level security;

create policy consent_staff_all on consent for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');

-- 보호자·의뢰병원은 읽기만. 서명은 아래 DEFINER 함수로만 가능하다.
create policy consent_external_read on consent for select
  using (exists (
    select 1 from patient p
    where p.id = consent.patient_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- 서명은 한 번만. 이미 서명된 건은 건드릴 수 없다.
create or replace function sign_consent(
  p_consent_id uuid,
  p_body       text,
  p_answers    jsonb,
  p_name       text,
  p_rrn_enc    text,
  p_signature  text,
  p_ip         text,
  p_ua         text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  update consent c
  set body_snapshot = p_body,
      answers       = p_answers,
      signer_name   = p_name,
      signer_rrn_enc = p_rrn_enc,
      signature_png = p_signature,
      signed_at     = now(),
      signed_ip     = p_ip,
      signed_ua     = p_ua
  from patient p
  where c.id = p_consent_id
    and p.id = c.patient_id
    and c.signed_at is null
    and (
      current_role_name() = 'staff'                                  -- 병원 태블릿에서 그 자리에서 받는 경우
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    );
  get diagnostics v_ok = row_count;
  return v_ok;
end
$$;

revoke all on function sign_consent(uuid, text, jsonb, text, text, text, text, text) from public;
grant execute on function sign_consent(uuid, text, jsonb, text, text, text, text, text) to authenticated;
