-- supabase/seed/demo_history.sql — 시연용 재방문 이력 (3~8년치)
--
-- ⚠️ DEMO ONLY. 운영 DB에 넣지 말 것.
--
-- 기존 회차는 지우지 않는다. 그 앞에 회차를 붙이고 번호만 날짜순으로 다시 매긴다.
-- 한 줄씩 손으로 쓰지 않고 환자별 "질환 스토리"(주 증상·코멘트 배열, 체중 시작/끝,
-- 방문 횟수)만 적고 DB가 펼치게 한다 — 3년치를 손으로 쓰면 30분 뒤에 그만두게 된다.
--
-- 이 시드가 화면에 만들어 내는 것:
--   · 지난 방문 대비 변화 (직전 회차 주 증상 + 체중 증감)
--   · 병원별 의뢰 흐름 (최근 90일 vs 직전 90일) + 해맑은동물병원 "의뢰 끊김"
--   · 미환송 몇 건 · 보호자 앱 안읽음 · 과거 입원과 바이털 그래프
--
-- 시드 데이터는 전부 id 가 'd0000000-' 로 시작한다. 되돌리기는 demo_history_rollback.sql.
-- 기준일 2026-07-29 · 최근 90일 = 2026-04-30 이후

begin;

select setseed(0.42);

-- ── 1. 조용해진 1차 병원 (의뢰 끊김 배지용) ────────────────────
insert into referring_hospital (id, name, contact) values
  ('d0000000-0000-4000-8000-000000000001', '해맑은동물병원', '031-000-0000')
on conflict (id) do nothing;

insert into owner (id, name, contact) values
  ('d0000000-0000-4000-8000-000000000101', '정수민', '010-0000-0001'),
  ('d0000000-0000-4000-8000-000000000102', '박서준', '010-0000-0002')
on conflict (id) do nothing;

insert into patient (id, owner_id, referring_hospital_id, name, species, breed, sex, birth_date, chart_no) values
  ('d0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000101',
   'd0000000-0000-4000-8000-000000000001', '콩이', '강아지', '비숑프리제', '중성화 수컷', '2019-03-08', 'D-2001'),
  ('d0000000-0000-4000-8000-000000000202', 'd0000000-0000-4000-8000-000000000102',
   'd0000000-0000-4000-8000-000000000001', '나비', '고양이', '코리안숏헤어', '중성화 암컷', '2015-09-21', 'D-2002')
on conflict (id) do nothing;

-- ── 2. 환자별 질환 스토리 ──────────────────────────────────────
-- sd/ed = 첫 방문 ~ 마지막 시드 방문, n = 회차 수, w0/w1 = 체중 시작/끝(그 사이는 보간).
-- ccs/cms 는 회차마다 돌아가며 쓰인다 — 만성 환자는 같은 문제로 반복 내원한다.
create temp table story(pid uuid, sd date, ed date, n int, w0 numeric, w1 numeric, ccs text[], cms text[]) on commit drop;

insert into story values
('93d4fb54-181d-5278-a6e4-c7711d006d08','2018-04-14','2026-05-05',28,5.10,3.85,
 array['건강검진','다음다뇨 및 체중 감소','신장 수치 재검','구내염 및 식욕 저하','피하수액 처치'],
 array['정기 검진으로 피검사와 초음파를 함께 봤어요','물 마시는 양이 늘어 신장 검사를 진행했어요','수액 치료 후 신장 수치를 다시 확인했어요','입안 염증 때문에 밥을 잘 못 먹어 치료했어요','수액을 맞고 컨디션이 조금 올라왔어요']),

('691ed873-8d98-5172-9287-1ebbdba0b7b3','2019-03-22','2026-05-18',24,5.80,6.28,
 array['건강검진','우측 눈 각막궤양','귀 긁음 및 외이염','치석 및 잇몸 염증','경부 종괴 확인'],
 array['정기 검진에서 큰 이상은 없었어요','오른쪽 눈에 상처가 확인되어 안약 치료를 시작했어요','귀가 빨갛게 부어 있어 약을 넣고 소독했어요','잇몸이 부어 있어 스케일링을 권해드렸어요','목 아래 만져지는 혹을 확인해 세침검사를 했어요']),

('aaf5a252-8aa8-54a8-b14f-70ff5c6a1d9b','2020-05-08','2026-04-25',20,4.10,4.40,
 array['건강검진','우측 항문낭 부위 부종','설사 및 식욕 저하','슬개골 검진','피부 발적'],
 array['정기 검진과 예방접종을 함께 진행했어요','항문 옆이 부어 고름을 빼내고 소독했어요','묽은 변이 이어져 장 검사를 했어요','뒷다리 무릎 상태를 확인했어요','배 쪽 피부가 붉어져 약을 처방했어요']),

('7cafac5d-bd88-58a3-a2e0-5d5c5baf3df0','2021-06-11','2026-05-16',16,4.90,5.55,
 array['건강검진','야간 기침 및 천식 재발','구토 반복','예방접종','체중 관리 상담'],
 array['정기 검진에서 전반적으로 양호했어요','밤 기침 때문에 흉부 촬영을 했어요','구토가 잦아 위장 검사를 진행했어요','예방접종을 마쳤고 특별한 반응은 없었어요','체중이 늘어 사료량을 함께 조정했어요']),

('f0a37423-d4a2-5eab-a1f5-ef4a208d0e44','2020-02-19','2026-05-08',18,3.70,3.95,
 array['건강검진','슬개골 탈구 재검','구토 및 식욕 부진','귀 청소 및 외이염','치과 검진'],
 array['정기 검진과 심장 청진을 함께 봤어요','뒷다리 무릎 상태를 다시 확인했어요','구토가 이어져 복부 촬영을 했어요','귀 안쪽을 청소하고 약을 넣었어요','치석이 많아 스케일링 상담을 드렸어요']),

('438e9b38-5eec-5664-a31b-72a5244bcf3d','2018-09-05','2026-04-12',26,5.20,4.55,
 array['건강검진','기침 및 식욕 저하','구내염 관리','체중 감소 확인','흉부 재촬영'],
 array['정기 검진으로 피검사를 진행했어요','기침이 잦아 흉부 촬영을 했어요','입안 염증을 치료하고 약을 처방했어요','체중이 줄어 원인 검사를 진행했어요','폐 상태를 다시 촬영해 비교했어요']),

('3e828a4c-141e-5dc7-8952-356558021540','2019-07-16','2026-05-14',22,5.00,3.90,
 array['건강검진','간헐적 구토','체중 감소 지속','식욕 저하','복부 초음파 재검'],
 array['정기 검진과 예방접종을 진행했어요','구토가 잦아 복부 초음파를 봤어요','체중이 계속 줄어 정밀 검사를 했어요','밥을 잘 안 먹어 식욕 촉진 치료를 했어요','위벽 상태를 다시 확인했어요']),

('ba94f3a3-5f57-5fbb-925a-65d9f183d2a2','2022-05-24','2026-04-27',14,3.80,4.05,
 array['건강검진','만성 외이염','턱밑 부종','콧물 및 재채기','귀 배양 검사'],
 array['정기 검진에서 큰 이상은 없었어요','귀 상태를 확인하고 약을 바꿨어요','턱 아래가 부어 농을 제거했어요','콧물이 이어져 상부호흡기 검사를 했어요','귀 균 검사 결과에 맞춰 약을 조정했어요']),

('14563388-ba20-54f1-aac4-151dc06324b9','2022-08-30','2026-04-30',12,2.60,2.85,
 array['건강검진','뒷다리 파행','설사 및 소화기 증상','예방접종','슬개골 재검'],
 array['정기 검진과 심장 청진을 함께 봤어요','다리를 절어 촬영하고 소염제를 처방했어요','묽은 변이 이어져 장 관리 약을 드렸어요','예방접종을 마쳤어요','무릎 상태를 다시 확인했어요']),

('aa9d2b5d-5fb4-5fc2-bfd6-36216faee9de','2019-11-12','2026-04-22',20,3.90,3.60,
 array['건강검진','심잡음 확인','기침 증가','심초음파 재검','치과 검진'],
 array['정기 검진으로 피검사와 청진을 했어요','심장 소리에 잡음이 들려 초음파를 봤어요','기침이 늘어 흉부를 촬영했어요','심장 상태를 다시 확인하고 약을 조정했어요','잇몸 상태를 확인하고 관리법을 안내드렸어요']),

('d0000000-0000-4000-8000-000000000201','2021-09-07','2026-03-19',12,4.80,5.35,
 array['건강검진','피부 소양감 지속','피부 재검','귀 외이염','예방접종'],
 array['정기 검진에서 전반적으로 양호했어요','가려움 때문에 피부 검사를 진행했어요','가려움이 줄고 털도 다시 자라고 있어요','귀가 빨개져 약을 넣었어요','예방접종을 마쳤어요']),

('d0000000-0000-4000-8000-000000000202','2020-04-18','2026-02-27',14,4.20,3.90,
 array['건강검진','혈뇨 및 빈뇨','방광염 재발','구토','신장 수치 확인'],
 array['정기 검진과 피검사를 진행했어요','소변에 피가 비쳐 검사했고 결석은 없었어요','방광염이 재발해 다시 치료했어요','구토가 있어 대증 치료를 했어요','신장 수치를 확인하고 식이를 조정했어요']);

-- ── 3. 회차 펼치기 ─────────────────────────────────────────────
insert into visit (id, patient_id, visit_date, note, chief_complaint, weight_kg,
                   report_comment, report_sent_at, report_read_at, closed_at,
                   referral_note, referred_back_at)
select
  ('d0000000-0000-4000-8000-' || lpad((1000000 + row_number() over (order by s.pid, g.i))::text, 12, '0'))::uuid,
  s.pid,
  d.vd,
  -- 주 증상과 검사·계획이 같은 주기로 돌면 목록에서 복붙처럼 보인다.
  -- 서로 다른 길이의 배열을 회차 번호로 돌려 조합을 흩뜨린다.
  E'S> 내원 사유 — ' || c.cc || E'\n - ' ||
    (array['보호자분 말씀으로는 며칠 전부터 증상이 있었다고 함','이전 처방약은 지시대로 급여 중',
           '식욕과 음수량은 평소와 비슷','최근 사료를 바꾼 이력 있음','지난 회차 이후 큰 변화 없이 지냄',
           '보호자분이 증상 영상 촬영해 오심','야간에 증상이 더 심하다고 함','타 병원 투약 이력 확인됨'])[1 + (g.i % 8)] ||
  E'\nO> ' ||
    (array['신체검사, CBC/혈청화학검사','신체검사, 방사선 촬영(흉복부)','신체검사, 복부 초음파',
           '신체검사, 요검사 및 요비중','신체검사, 청진 및 혈압 측정','신체검사, 세포 검사',
           '신체검사 단독, 추가 검사 미실시'])[1 + (g.i % 7)] ||
  E'\nA> ' || c.cc || E'\nP> ' ||
    (array['투약 후 2주 경과 관찰','약 처방, 이상 시 즉시 내원 안내','식이 조절 병행, 4주 뒤 재평가',
           '추가 검사 예정 (보호자 상의 후 결정)','현행 유지, 6개월 뒤 정기 재검',
           '의뢰 병원으로 환송, 경과 관찰 요청'])[1 + (g.i % 6)],
  c.cc,
  round((s.w0 + (s.w1 - s.w0) * (g.i - 1)::numeric / greatest(s.n - 1, 1) + (random() - 0.5)::numeric * 0.14)::numeric, 2),
  s.cms[1 + ((g.i - 1) % array_length(s.cms, 1))] ||
    (array['', E'\n다음 방문 때 경과를 다시 확인할게요', E'\n집에서 달라진 점이 있으면 알려주세요',
           E'\n처방된 약은 안내드린 대로 먹여주세요', E'\n오늘 결과는 전반적으로 안정적이었어요',
           E'\n같은 증상이 반복되면 조금 더 자세히 살펴볼게요'])[1 + (g.i % 6)],
  d.vd + time '18:20',
  case when random() < 0.85 then d.vd + time '20:40' end,   -- 15% 는 안 읽음
  d.vd + time '18:20',
  case when random() < 0.8 then c.cc || ' 관련 ' ||
    (array['검사 및 처치 완료했습니다. 경과 관찰 부탁드립니다.','치료 후 상태 안정되어 환송합니다. 재발 시 재의뢰 바랍니다.','추가 검사 결과 회신드립니다. 투약은 현행 유지 부탁드립니다.','경과 양호하여 정기 관리 부탁드립니다.'])[1 + (g.i % 4)] end,
  case when random() < 0.8 then d.vd + 1 + time '09:20' end
from story s
cross join generate_series(1, 40) g(i)
cross join lateral (
  select least(s.ed, s.sd + ((s.ed - s.sd) * (g.i - 1) / greatest(s.n - 1, 1)) + (floor(random() * 15) - 7)::int)::date as vd
) d
cross join lateral (select s.ccs[1 + ((g.i - 1) % array_length(s.ccs, 1))] as cc) c
where g.i <= s.n;

-- 진료 기록 형식은 사람마다 다르다. 수의사들에게 물어보니 SOAP 는 잘 안 쓴다고 한다.
-- 데모가 한 형식만 보여주면 그게 곧 "이렇게 쓰라"는 말이 되므로 2/3 은 자유 노트로 둔다.
update visit v set note =
  coalesce(v.chief_complaint, '진료') || '으로 내원. ' ||
  (array['보호자분 말씀으로는 며칠 전부터 증상이 있었다고 함.','이전 처방약은 지시대로 급여 중이었음.',
         '식욕과 음수량은 평소와 비슷하다고 함.','최근 사료를 바꾼 이력 있음.',
         '지난 회차 이후 큰 변화 없이 지냈다고 함.','보호자분이 증상 영상을 촬영해 오심.',
         '야간에 증상이 더 심하다고 함.','타 병원 투약 이력 확인됨.'])[1 + (abs(hashtext(v.id::text || 's')) % 8)] ||
  E'\n' ||
  (array['신체검사와 기본 혈액검사 진행.','흉복부 방사선 촬영으로 확인.','복부 초음파로 확인.',
         '요검사와 요비중 확인.','청진과 혈압 측정 시행.','세포 검사 보냄.',
         '신체검사만 하고 추가 검사는 하지 않음.'])[1 + (abs(hashtext(v.id::text || 'o')) % 7)] || ' ' ||
  (array['투약 후 2주 경과 관찰하기로 함.','약 처방하고 이상 시 바로 내원하시도록 안내.',
         '식이 조절 병행, 4주 뒤 재평가 예정.','추가 검사는 보호자분과 상의 후 결정하기로 함.',
         '현행 유지, 6개월 뒤 정기 재검 안내.','의뢰 병원으로 환송, 경과 관찰 요청드림.'])[1 + (abs(hashtext(v.id::text || 'p')) % 6)]
 where v.id::text like 'd0000000%' and abs(hashtext(v.id::text)) % 3 <> 0;

-- 오래된 회차까지 미환송으로 남으면 "밀린 일"이 아니라 노이즈다. 4월 이전은 모두 환송 처리.
update visit set
  referral_note = coalesce(referral_note, coalesce(chief_complaint, '진료') || ' 관련 처치 완료했습니다. 경과 관찰 부탁드립니다.'),
  referred_back_at = visit_date + 1 + time '09:20'
 where id::text like 'd0000000%' and referred_back_at is null and visit_date < '2026-04-01';

-- ── 4. 과거 입원 · 바이털 · 일일 리포트 ────────────────────────
select setseed(0.17);

with picked as (
  select v.id as visit_id, v.patient_id, v.visit_date, v.chief_complaint,
         row_number() over (partition by v.patient_id order by v.visit_date) as rn
  from visit v where v.id::text like 'd0000000%'
), chosen as (
  select *, 2 + (abs(hashtext(visit_id::text)) % 4) as days from picked where rn % 6 = 3
)
insert into admission (id, visit_id, patient_id, admitted_at, discharged_at, status, note)
select ('d0000000-0000-4000-8000-' || lpad((2000000 + row_number() over (order by visit_id))::text, 12, '0'))::uuid,
       visit_id, patient_id, visit_date, visit_date + days, 'discharged',
       chief_complaint || ' 로 ' || days || '일 입원'
from chosen;

insert into vital (id, admission_id, measured_at, temperature, heart_rate, resp_rate, feeding)
select ('d0000000-0000-4000-8000-' || lpad((3000000 + row_number() over (order by a.id, g.i))::text, 12, '0'))::uuid,
       a.id,
       a.admitted_at + (g.i / 2) + (case when g.i % 2 = 0 then time '09:00' else time '21:00' end),
       round((38.2 + (random() - 0.5) * 0.9)::numeric, 1),
       round((110 + random() * 50)::numeric)::int,
       round((24 + random() * 14)::numeric)::int,
       (array['잘 먹음','절반 섭취','거의 안 먹음','강제 급여'])[1 + (g.i % 4)]
from admission a cross join generate_series(0, 11) g(i)
where a.id::text like 'd0000000%' and a.admitted_at + (g.i / 2) <= a.discharged_at;

insert into admission_report (id, admission_id, report_date, comment, sent_at, read_at)
select ('d0000000-0000-4000-8000-' || lpad((4000000 + row_number() over (order by a.id, g.i))::text, 12, '0'))::uuid,
       a.id, a.admitted_at + g.i,
       (array['오늘은 컨디션이 조금 나아졌어요. 물도 스스로 마셨습니다.',
              '식사량이 어제보다 늘었어요. 체온도 정상 범위입니다.',
              '주사 치료를 잘 받았고 특별한 이상은 없었어요.',
              '오늘 검사 결과는 안정적이었어요. 내일 퇴원 여부를 상의드리겠습니다.'])[1 + (g.i % 4)],
       a.admitted_at + g.i + time '18:30',
       case when random() < 0.85 then a.admitted_at + g.i + time '21:00' end
from admission a cross join generate_series(0, 5) g(i)
where a.id::text like 'd0000000%' and a.admitted_at + g.i <= a.discharged_at;

-- ── 5. 기존(최신) 회차 채우기 ──────────────────────────────────
-- 두리·최댓국은 일부러 미발송/미환송으로 남긴다 — "오늘 할 일"과 미환송 배지가 비면 시연이 안 된다.

update visit set chief_complaint = '식욕 폐절 및 기력 저하', weight_kg = 3.72,
  report_comment = E'밥을 전혀 먹지 않고 숨어 있어 응급으로 내원하셨어요\n탈수가 있어 입원해 수액 치료를 시작했어요\n신장 수치는 지난 방문보다 조금 올라 있어요',
  report_notice = '면회는 오후 2시에서 5시 사이에 가능합니다.',
  report_sent_at = '2026-06-23 19:30+09'
 where id = 'b217fd2c-9d1b-5f43-89eb-6c63cf949557';

update visit set chief_complaint = '경부 종괴 급격한 크기 증가', weight_kg = 6.36,
  report_comment = E'목의 혹이 최근 한두 달 사이 빠르게 커졌어요\n크기는 7cm 정도이고 피하 출혈이 함께 확인됐어요\n수술로 제거하는 방향으로 준비하고 있어요',
  report_sent_at = '2026-07-04 18:50+09', report_read_at = '2026-07-04 21:10+09'
 where id = 'ec553d87-5a1b-5dbd-af85-556a66269c9d';

update visit set chief_complaint = '항문낭 누공 및 부종 지속', weight_kg = 4.25
 where id = 'e0fdc56f-3d65-5123-98ef-4f6497c73234';  -- 미발송 · 미환송

update visit set chief_complaint = '여행 후 파행', weight_kg = 5.62,
  report_comment = E'다리를 절어 앞뒤 다리를 모두 촬영했어요\n입원해서 통증 조절을 하며 경과를 보고 있어요',
  report_sent_at = '2026-07-03 19:00+09',
  referral_note = '파행 원인 감별 위해 입원 관찰 중입니다. 결과 나오는 대로 회신드리겠습니다.',
  referred_back_at = '2026-07-04 09:30+09'
 where id = 'ce5fbb3b-c264-551e-a25a-914bd7ffc9d3';

update visit set chief_complaint = '반복 구토 및 식욕 부진', weight_kg = 3.85,
  report_comment = E'구토가 반복되어 내시경 검사를 진행했어요\n위에서 면봉 3개를 찾아 모두 제거했어요\n오늘부터 물부터 조금씩 먹여보겠습니다',
  report_notice = '집에서 면봉과 실 종류는 손이 닿지 않는 곳에 두세요.',
  report_sent_at = '2026-06-24 20:10+09', report_read_at = '2026-06-24 22:00+09',
  referral_note = '위 내 이물(면봉 3개) 내시경으로 제거했습니다. 회복 양호하며 1주 뒤 재진 부탁드립니다.',
  referred_back_at = '2026-06-26 09:00+09'
 where id = 'ded78bf0-d6d0-5f5e-b3df-f3acd4389788';

update visit set chief_complaint = '흉수 및 폐침윤 확인', weight_kg = 4.20,
  referral_note = '흉수 배액 후 호흡 안정되었습니다. 폐침윤 원인 감별 진행 중이며 결과 회신드리겠습니다.',
  referred_back_at = '2026-06-02 09:40+09'
 where id = 'c98630e6-f4bc-5fb9-bc0e-6f8d96ad8ce1';

update visit set chief_complaint = '위 종양 확인', weight_kg = 3.55,
  report_comment = E'위에 종양이 확인되어 조직 검사를 진행했어요\n체중이 계속 줄고 있어 입원해 영양 관리를 함께 하고 있어요',
  report_notice = '검사 결과는 나오는 대로 바로 안내드리겠습니다.',
  report_sent_at = '2026-06-30 19:20+09'
 where id = 'e6949ff8-6bf4-5736-ab83-48b7568d51d5';

update visit set chief_complaint = '턱밑 부종 재발', weight_kg = 4.12
 where id = '16556891-1d9d-5523-8f52-3ee8b4bd4f76';  -- 미발송 · 미환송

update visit set chief_complaint = '활동량 저하 및 소화기 증상', weight_kg = 2.78,
  report_comment = E'다리 약을 중단한 뒤 활동량이 줄어 다시 확인했어요\n소화기 증상이 함께 있어 검사를 진행했습니다',
  report_sent_at = '2026-06-16 18:40+09', report_read_at = '2026-06-16 20:00+09',
  referral_note = '약 중단 후 증상 변화 확인했습니다. 소화기 검사 결과 회신드리겠습니다.',
  referred_back_at = '2026-06-17 09:20+09'
 where id = '817b0cf4-f25c-5037-ac17-b94b60b9060b';

update visit set chief_complaint = '기침 심화 및 호흡곤란', weight_kg = 3.48,
  report_notice = '집에서 잘 때 호흡수를 세어 적어주시면 큰 도움이 됩니다.',
  referral_note = 'MMVD stage C로 진행하여 이뇨제 및 강심제 시작했습니다. 안정 후 재의뢰 없이 정기 관리 부탁드립니다.',
  referred_back_at = '2026-06-11 09:00+09'
 where id = '82093d97-d5bc-52b3-bc5e-246a7c469dcb';

-- ── 6. 회차 번호는 날짜순으로 다시 매긴다 ──────────────────────
with n as (
  select id, row_number() over (partition by patient_id order by visit_date, created_at) as rn from visit
)
update visit v set visit_no = n.rn from n where n.id = v.id;

commit;
