-- 0008_visit_report.sql — 회차 리포트 (보호자에게 나가는 기본 리포트)
--
-- 리포트는 회차당 정확히 1건이므로 별도 테이블 대신 visit 의 컬럼으로 둔다.
-- (별도 테이블이면 unique 제약 + RLS 정책 + 조인이 늘어나는데 얻는 게 없다)
--
-- 본문 대부분(진단·처방·영상)은 이미 회차에 있다. 수의사가 새로 넣는 것은 코멘트 한 줄뿐이고,
-- 나머지는 발송 시점에 시스템이 조립한다.

alter table visit
  add column if not exists report_comment text,
  add column if not exists report_sent_at  timestamptz,
  add column if not exists report_read_at   timestamptz;

-- "오늘 할 일" 목록이 미발송 회차만 훑는다 → 부분 인덱스
create index if not exists visit_report_pending_idx
  on visit (visit_date desc) where report_sent_at is null;

-- 보호자는 visit 에 대해 읽기 전용이므로, 열람 표시는 DEFINER 함수로만 가능하게 한다.
-- (초대 수락 redeem_invite 와 같은 패턴)
create or replace function mark_visit_report_read(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update visit v
  set report_read_at = now()
  from patient p
  where v.id = p_visit_id
    and p.id = v.patient_id
    and v.report_sent_at is not null   -- 발송된 리포트만
    and v.report_read_at is null       -- 최초 열람 시각만 기록
    and current_role_name() = 'owner'
    and p.owner_id = current_owner_id();
end
$$;

revoke all on function mark_visit_report_read(uuid) from public;
grant execute on function mark_visit_report_read(uuid) to authenticated;
