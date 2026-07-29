-- 0015_push_subscription.sql — 웹 푸시 구독
--
-- 알림 채널을 문자·알림톡이 아니라 **PWA 웹 푸시**로 간다.
-- 발신번호도 사업자 등록도 건당 요금도 없고, 보호자 앱이 이미 PWA다.
-- (iOS 는 홈 화면에 추가된 상태에서만 푸시가 온다 — 그래서 설치 안내가 곧 알림 설정이다)
--
-- 한 사람이 여러 기기를 쓴다(폰·태블릿·데스크탑). 구독은 기기마다 하나씩 쌓인다.
-- 브라우저가 주는 endpoint 가 곧 기기 식별자라 그걸 unique 로 둔다.

create table push_subscription (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  failed_at  timestamptz          -- 만료(410) 확인 시각. 정리 대상
);
create index push_subscription_user_idx on push_subscription (user_id);

alter table push_subscription enable row level security;

-- 자기 구독만 보고 지운다. 발송은 서버가 service_role 없이 직접 조회하지 않고,
-- 리포트를 보내는 서버 액션이 대상 보호자를 찾아 발송한다(DEFINER 아님 — 직원 권한으로 조회).
create policy push_sub_own_select on push_subscription for select using (user_id = auth.uid());
create policy push_sub_own_insert on push_subscription for insert with check (user_id = auth.uid());
create policy push_sub_own_delete on push_subscription for delete using (user_id = auth.uid());

-- 발송 경로: 직원이 리포트를 보낼 때 그 환자의 보호자 구독을 찾아야 하는데,
-- 위 정책상 남의 구독은 못 읽는다. 구독을 전부 열어 주는 대신 필요한 것만 주는 함수를 둔다.
create or replace function push_targets_for_patient(p_patient_id uuid)
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
  join patient pt on pt.owner_id = pr.owner_id
  where pt.id = p_patient_id and pr.role = 'owner' and s.failed_at is null;
end
$$;

revoke all on function push_targets_for_patient(uuid) from public;
grant execute on function push_targets_for_patient(uuid) to authenticated;

-- 브라우저가 410/404 를 주면 그 기기는 끝난 구독이다. 지우지 않고 표시만 해 둔다.
create or replace function mark_push_failed(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update push_subscription set failed_at = now() where id = p_id;
end
$$;
revoke all on function mark_push_failed(uuid) from public;
grant execute on function mark_push_failed(uuid) to authenticated;
