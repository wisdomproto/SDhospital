-- 0037 은 조용히 아무것도 안 막고 있었다 (2026-08-17)
--
-- 정책 안에 `exists (select 1 from patient_caution ...)` 를 그대로 썼는데,
-- **정책 표현식 안의 서브쿼리도 그 테이블의 RLS 를 탄다.**
-- patient_caution 은 직원 전용이라 보호자 세션에서는 0건이 나오고,
-- 그래서 `not exists` 가 늘 참이 되어 **전원이 그대로 보였다.** 71명 그대로였다.
--
-- ⚠️ 이런 건 정책을 걸었다는 사실만으로는 절대 못 잡는다. 걸고 나서 **보호자 세션으로 세어 봐야 한다.**
create or replace function patient_unconfirmed(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from patient_caution c
    where c.patient_id = p_patient
      and c.kind = 'confirm'
      and c.resolved_at is null
  );
$$;

comment on function patient_unconfirmed(uuid) is
  '생사가 기록으로 확정되지 않은 아이인가. 정책 안에서 쓰려고 DEFINER 다 — 보호자는 patient_caution 을 못 읽는다';

revoke all on function patient_unconfirmed(uuid) from public;
grant execute on function patient_unconfirmed(uuid) to authenticated;

drop policy patient_owner_read on patient;

create policy patient_owner_read on patient for select
  using (
    current_role_name() = 'owner'
    and owner_id = current_owner_id()
    and not patient_unconfirmed(patient.id)
  );

comment on policy patient_owner_read on patient is
  '보호자는 자기 아이만. 단 생사 미확정(confirm caution)인 아이는 감춘다 — 0037·0038';
