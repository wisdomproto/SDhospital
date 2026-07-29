-- 0017_admission_report_ready.sql — 입원 리포트: 작성과 발송을 나눈다
--
-- 병동에서 입력하는 사람과 보호자에게 내보낼지 판단하는 사람이 다르다.
-- 식사·배변·바이털·사진은 간호사가 채우고, "이걸 보호자에게 보내도 되는가"는 수의사가 정한다.
-- 지금까지는 병동 화면의 버튼 하나가 곧 발송이라 그 판단 단계가 아예 없었다.
--
--   ready_at  = 간호사가 "발송 준비 완료"를 누른 시각 → 수의사에게 알림이 간다
--   sent_at   = 수의사가 확인하고 보호자에게 내보낸 시각
--
-- 수의사가 직접 입력하는 경우도 있으니 준비를 건너뛰고 바로 보낼 수도 있다.

alter table admission_report add column if not exists ready_at timestamptz;
alter table admission_report add column if not exists ready_by uuid references auth.users(id);

-- "확인 대기" 목록용
create index if not exists admission_report_ready_idx
  on admission_report (report_date) where ready_at is not null and sent_at is null;

-- 직원 알림 대상. 병원 규모가 작아 전 직원에게 보낸다 —
-- 담당의를 지정하는 순간 그 사람이 쉬는 날 리포트가 멈춘다.
create or replace function push_targets_staff()
returns table (id uuid, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_role_name(), '') <> 'staff' then
    raise exception 'staff only';
  end if;

  return query
  select s.id, s.endpoint, s.p256dh, s.auth
  from push_subscription s
  join profile pr on pr.id = s.user_id
  where pr.role = 'staff' and s.failed_at is null;
end
$$;

revoke all on function push_targets_staff() from public;
grant execute on function push_targets_staff() to authenticated;
