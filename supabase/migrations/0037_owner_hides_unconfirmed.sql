-- 생사가 확정되지 않은 아이는 보호자 앱에서 통째로 감춘다 (2026-08-17)
--
-- 0036 은 채팅 화면만 잠갔다. 그런데 그 아이의 진료 기록·리포트·사진은 그대로 보였다.
-- 「지금 어떻게 지내나요」에 답하지 않기로 해놓고 지난 리포트는 계속 보여 주는 건 앞뒤가 안 맞고,
-- 무엇보다 **앱에 그 아이가 살아 있는 것처럼 놓여 있는 것 자체가 답이 된다.**
--
-- 그래서 목록에서 빼는 게 아니라 **행을 안 보이게 한다.**
-- 화면에서 거르면 주소를 직접 열었을 때 그대로 나온다 — 그런 구멍을 이미 겪었다.
-- patient 이 안 보이면 visit·리포트·미디어·동의서 정책이 전부 patient 을 EXISTS 로 확인하므로
-- 그것들도 같이 사라진다. 한 군데만 고치면 된다.
--
-- ⚠️ **직원과 1차 병원은 그대로 본다.** 감추는 건 보호자 화면뿐이다.
-- ⚠️ **원장님이 `patient_caution.resolved_at` 을 채우면 그 순간 다시 보인다.**
drop policy patient_owner_read on patient;

create policy patient_owner_read on patient for select
  using (
    current_role_name() = 'owner'
    and owner_id = current_owner_id()
    and not exists (
      select 1 from patient_caution c
      where c.patient_id = patient.id
        and c.kind = 'confirm'
        and c.resolved_at is null
    )
  );

comment on policy patient_owner_read on patient is
  '보호자는 자기 아이만. 단 생사 미확정(confirm caution)인 아이는 감춘다 — 0037';
