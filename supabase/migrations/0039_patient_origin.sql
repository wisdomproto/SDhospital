-- 의뢰받은 아이냐, 우리 단골이냐 (2026-08-18)
--
-- ⚠️ **`referring_hospital_id` 로는 못 가른다.** 그 칸이 채워진 건 데모 12명뿐이고,
-- 진료기록에서 옮겨 온 실제 의뢰 환자들은 대부분 비어 있다. 없는 걸 있는 것처럼 쓰면
-- 「의뢰 아님」이 68명으로 나온다 — 실제로 그렇게 나왔다.
--
-- 이 구분이 필요한 이유는 화면이 아니라 **채팅 규칙이 갈리기 때문**이다:
-- 「경미하면 1차 병원으로 돌려보낸다」가 단골에게는 성립하지 않는다. **우리가 그 1차다.**
-- 실제로 리봉이한테 「의뢰해 주신 1차 병원에 연락하라」고 나갔다 — 있지도 않은 병원이다.
create type patient_origin as enum ('referral', 'regular');

alter table patient add column origin patient_origin not null default 'referral';

comment on column patient.origin is
  'referral=1차 병원이 의뢰한 아이 · regular=우리가 1차인 단골. 채팅의 「1차로 돌려보내기」가 regular 에는 안 통한다';

-- 이미 알고 있던 예외 하나 — 진료기록을 읽다 나온 것이라 사정에도 적혀 있다
update patient set origin = 'regular'
where id in (
  select patient_id from patient_caution
  where body like '%레퍼 환자가 아니다%' or body like '%우리가 1차 역할%'
);
