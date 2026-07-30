-- 0024_checkup_recheck.sql — 재검 알림
--
-- 결과서에는 이미 "3개월 뒤 재검" 이 적혀 있다. 그런데 그 종이는 서랍에 들어가고
-- 아무도 그날을 챙기지 않는다. 재검이 안 오는 이유는 필요 없어서가 아니라 잊어서다.
--
-- 보낸 날짜를 남기는 이유는 하나뿐이다 — **두 번 보내지 않기 위해서**.
-- 매일 도는 작업이라 이 컬럼이 없으면 재검일 이후 매일 같은 알림이 간다.
alter table checkup add column recheck_notified_at timestamptz;

-- 재검 알림은 사람이 아니라 스케줄러가 보낸다(로그인 세션이 없다). 그 경로는
-- service role 로 도는데, 죽은 구독을 표시하는 함수만 `authenticated` 전용이라
-- 알림이 실패해도 그 기기를 끄지 못한다. 함수 내용은 그대로 두고 실행 권한만 준다.
grant execute on function mark_push_failed(uuid) to service_role;
