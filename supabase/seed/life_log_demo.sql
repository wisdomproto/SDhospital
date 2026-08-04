-- life_log_demo.sql — 시연용 생활기록 (슈슈, 90일치)
--
-- 이야기가 있어야 화면이 설명된다: **최근 3주부터 식욕이 떨어지고 기운이 없다.**
-- 그래서 일별로는 잘 안 보이고 주별·월별로 보면 추세가 드러난다 — 알갱이를 셋으로 나눈 이유가 그것이다.
-- 사료를 18일 전에 바꿨고 9일 전에 이름 모를 것을 하나 더 주기 시작했다.
-- 채팅 문 1이 보는 "최근 2주 안에 바뀐 것"에 뒤엣것만 걸린다.
--
-- ⚠️ **운영 DB에 넣지 말 것.** 되돌리기: life_log_demo_rollback.sql

delete from life_intake where id::text like 'a0000000%';
delete from life_log where id::text like 'a0000000%';

insert into life_log (id, patient_id, logged_on, appetite, stool, energy, weight_kg, note)
select
  ('a0000000-0000-4000-8000-' || lpad(d::text, 12, '0'))::uuid,
  '438e9b38-5eec-5664-a31b-72a5244bcf3d',
  current_date - d,
  case when d < 21 and random() < .55 then 'little'
       when d < 21 and random() < .35 then 'some'
       when random() < .12 then 'some' else 'well' end,
  case when d < 10 and random() < .4 then 'loose'
       when random() < .08 then 'none' else 'normal' end,
  case when d < 14 and random() < .45 then 'low' else 'normal' end,
  round((4.30 - (90 - d) * 0.004 + (random() - .5) * 0.04)::numeric, 2),
  case when d = 5 then '새벽에 두 번 토했어요' when d = 18 then '사료를 바꿨어요' else null end
from generate_series(0, 89) d
where random() < 0.8;   -- 매일 적지는 않는다. 빠진 날이 있는 게 실제 모습이다

-- 사료·간식·이름 없는 것 — **구분해서 넣지 않는다.** 한 목록이다.
insert into life_intake (id, patient_id, label, started_on, stopped_on) values
  ('a0000000-1000-4000-8000-000000000001', '438e9b38-5eec-5664-a31b-72a5244bcf3d', '로얄캐닌 인도어',    current_date - 400, current_date - 18),
  ('a0000000-1000-4000-8000-000000000002', '438e9b38-5eec-5664-a31b-72a5244bcf3d', '힐스 c/d 멀티케어',  current_date - 18,  null),
  ('a0000000-1000-4000-8000-000000000003', '438e9b38-5eec-5664-a31b-72a5244bcf3d', '츄르 (하루 한 개)',  current_date - 200, null),
  -- 보호자는 약 이름을 모른다. 실제로는 **사진으로 등록**하지만 SQL 로는 Storage 파일을 못 만든다.
  -- ⚠️ 그렇다고 label 도 photo_path 도 없는 행을 넣으면 안 된다 —
  --    앱의 addIntake 가 막는 상태라 화면에 '''이름 없는 칩'''이 떠서 아무도 못 알아본다.
  ('a0000000-1000-4000-8000-000000000004', '438e9b38-5eec-5664-a31b-72a5244bcf3d', '○○동물병원에서 받은 약', current_date - 9, null);
