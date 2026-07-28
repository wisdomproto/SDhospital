-- 0013_visit_chief_complaint.sql — 주 증상·체중·추가 안내
--
-- 보호자 리포트의 "지난 방문 대비 변화"를 만들려면 회차를 한 줄로 요약한 값이
-- 있어야 한다. 진료 원문(note)을 요약하는 건 AI가 필요하지만, 주 증상 한 줄과
-- 체중은 수의사가 어차피 적는 값이라 그걸 그대로 쓴다 — 조립은 전부 기계적이다.

alter table visit add column if not exists chief_complaint text;   -- C.C. 한 줄
alter table visit add column if not exists weight_kg numeric(5,2); -- 내원 시 체중
alter table visit add column if not exists report_notice text;     -- 보호자 추가 안내사항
