-- 0016_push_targets_for_hospital.sql — 1차병원 원장 알림 대상
--
-- 원장이 매일 우리 사이트에 들어와서 확인할 리가 없다. 밀어야 한다.
-- 보호자와 같은 웹 푸시를 쓰되(원장 화면도 같은 앱이다), 대상만 다르게 찾는다.
-- 보호자는 `patient.owner_id`, 원장은 `patient.referring_hospital_id` 로 이어진다.

create or replace function push_targets_for_hospital(p_patient_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_role_name(), '') <> 'staff' then
    raise exception 'staff only';
  end if;

  return query
  select s.id, s.endpoint, s.p256dh, s.auth
  from push_subscription s
  join profile pr on pr.id = s.user_id
  join patient pt on pt.referring_hospital_id = pr.referring_hospital_id
  where pt.id = p_patient_id and pr.role = 'referring_vet' and s.failed_at is null;
end
$$;

revoke all on function push_targets_for_hospital(uuid) from public;
grant execute on function push_targets_for_hospital(uuid) to authenticated;
