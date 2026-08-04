-- 0026_life_log_intakes.sql — 그 날 실제로 준 것
--
-- `life_intake` 의 성격이 바뀐다: "지금 주고 있는 것"에서 **"선택지 목록"**으로.
-- 보호자는 매일 그 목록에서 골라 담고, 목록 자체는 가끔 추가·제거한다.
-- (제거는 `stopped_on` 을 찍는 것이라 지난 기록의 이름은 그대로 남는다.)
--
-- 조인 테이블 대신 배열을 쓴다 — 하루 한 행에 몇 개뿐이라 한 번의 update 로 끝나고,
-- 읽을 때도 life_log 한 번이면 된다. 목록에서 뺀 항목의 id 가 남아도
-- 화면에서 못 찾으면 그냥 안 보인다(조용히 실패하는 쪽이 안전하다).
alter table life_log add column intakes uuid[] not null default '{}';
