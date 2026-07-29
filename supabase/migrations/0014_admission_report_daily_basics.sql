-- 0014_admission_report_daily_basics.sql — 입원 일일 리포트 단순화
--
-- 보호자가 매일 알고 싶은 건 딱 둘이다: 잘 먹었나, 잘 쌌나.
-- 체온 38.4 / 심박 96 같은 수치는 안심을 주지 못한다 — 검색해 보고 더 불안해진다.
-- 그래서 보호자 화면에서 바이털 그래프를 빼고, 대신 이 세 칸으로 바꾼다.
-- 수치는 계속 `vital` 에 쌓이고 의료진 화면에서만 본다.
--
-- 자유 텍스트가 아니라 정해진 선택지를 저장한다(`src/lib/admission-report.ts`).
-- 매일 나가는 문장이라 표현이 사람마다 다르면 그 자체가 불안 요소가 된다.

alter table admission_report add column if not exists feeding     text;  -- 식사
alter table admission_report add column if not exists elimination text;  -- 배변·배뇨
alter table admission_report add column if not exists special     text;  -- 특이사항 (있을 때만)
