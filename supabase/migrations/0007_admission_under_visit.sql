-- 0007_admission_under_visit.sql
-- 입원은 "다른 종류의 방문"이 아니라 진료 회차(visit)에 딸린 별도 기록이다.
-- 입원하러 온 환자도 진료 기록이 먼저 생기므로, admission 은 항상 visit 아래에 붙는다.
--
-- patient_id 는 남겨 둔다. 기존 조회/RLS 가 전부 그 컬럼을 쓰고 있고,
-- 복합 외래키로 "admission.patient_id = 그 visit 의 patient_id" 를 DB 가 강제하므로
-- 값이 어긋날 수 없다. 애플리케이션 코드에 정합성을 맡기지 않는다.

alter table visit add constraint visit_id_patient_uniq unique (id, patient_id);

alter table admission add column if not exists visit_id uuid;

-- 기존 입원 백필: 같은 환자의 회차 중 입원일에 가장 가까운 회차(입원일 이전 우선)에 붙인다
update admission a
set visit_id = (
  select v.id
  from visit v
  where v.patient_id = a.patient_id
  order by (v.visit_date <= a.admitted_at) desc, abs(v.visit_date - a.admitted_at)
  limit 1
)
where a.visit_id is null;

alter table admission alter column visit_id set not null;

alter table admission add constraint admission_visit_fk
  foreign key (visit_id, patient_id) references visit (id, patient_id) on delete cascade;

create index if not exists admission_visit_id_idx on admission (visit_id);
