-- 실제 보호자를 가리키는 칸 (2026-08-13)
--
-- 원장님 EMR 106명을 데모로 넣으면서, 보호자 계정을 106개 만들지 않기로 했다.
-- 그래서 **`owner_id` 는 데모 보호자 계정 하나**를 가리킨다 — RLS 가 지나가는 통로일 뿐이다.
-- 진짜 보호자(이름·연락처·주소·보호자번호)는 `owner` 에 그대로 있고 여기서 가리킨다.
--
-- ⚠️ **두 칸이 다른 것을 뜻한다.** `owner_id` 는 "누가 이 앱에서 볼 수 있나",
-- `emr_owner_id` 는 "실제로 누구의 아이인가". 데모라서 갈린 것이고,
-- 보호자 계정을 실제로 발급하면 둘이 같아진다.

alter table patient add column if not exists emr_owner_id uuid references owner(id) on delete set null;
create index if not exists patient_emr_owner_idx on patient (emr_owner_id);
