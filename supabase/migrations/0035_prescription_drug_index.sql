-- 0035_prescription_drug_index.sql — 채팅·회차 화면이 2초씩 걸리던 이유
--
-- `drug` 의 외부 읽기 정책은 약품 **한 행마다** 이렇게 묻는다:
--   "내 아이의 처방 중에 이 약을 쓴 게 있나" (prescription → visit → patient)
-- 그런데 `prescription.drug_id` 에 인덱스가 없어서 **약품 499행 × 처방 3,644행**을
-- 매번 훑었다. 실측 2,002ms — 돌아온 회차는 8건뿐인데.
--
-- ⚠️ **정책이 아니라 인덱스가 문제다.** 정책은 옳다(자기 아이가 받은 약만 이름을 본다).
-- 이런 「행마다 EXISTS」 정책을 쓸 때는 **그 EXISTS 가 짚는 컬럼에 인덱스가 있어야** 한다.
create index if not exists prescription_drug_id_idx on prescription (drug_id);
