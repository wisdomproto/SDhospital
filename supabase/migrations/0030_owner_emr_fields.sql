-- 보호자에 EMR 원본 필드를 더한다 (2026-08-13)
--
-- 실제 병원 데이터 106명을 넣으면서 담을 자리가 없던 둘 —
--   `emr_no`  진료기록 헤더의 「보호자번호」. 차트번호(patient.chart_no)와 **다른 번호**다.
--             한 보호자가 여러 아이를 키우면 아이마다 차트번호가 붙고 보호자번호는 하나다.
--   `address` 진료기록 헤더의 주소.
--
-- ⚠️ 둘 다 개인정보다. 보호자 화면에는 안 나가고 직원 EMR 에서만 쓴다 —
-- 기존 RLS 가 owner 를 직원 전용으로 이미 막고 있어 정책은 건드리지 않는다.

alter table owner add column if not exists emr_no text;
alter table owner add column if not exists address text;

create index if not exists owner_emr_no_idx on owner (emr_no);
