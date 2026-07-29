-- 0018_notice.sql — 병원 소식 (공지·이벤트·광고)
--
-- 보호자 앱 첫 화면이다. 리포트는 진료가 있어야 생기지만 소식은 병원이 언제든 낼 수 있고,
-- **진료가 없는 달에도 앱을 열 이유**를 만드는 건 이쪽이다 (검진 시즌, 예방접종 안내, 이벤트).
--
-- 기간(starts_on/ends_on)을 두는 이유: 지난 이벤트가 계속 걸려 있으면 그 자체가 신뢰를 깎는다.
-- 내리는 걸 사람이 기억해야 하는 구조는 반드시 실패한다 — 날짜가 지나면 RLS 가 알아서 감춘다.

create table notice (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  link_url   text,
  link_label text,
  starts_on  date not null default current_date,
  ends_on    date,                       -- null = 계속 노출
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index notice_window_idx on notice (starts_on desc);

alter table notice enable row level security;

create policy notice_staff_all on notice for all
  using (current_role_name() = 'staff')
  with check (current_role_name() = 'staff');

-- 외부 역할은 **기간 안에 있는 것만** 읽는다. 예약 발행과 자동 종료가 정책 한 줄로 끝난다.
create policy notice_read_active on notice for select
  using (
    current_role_name() in ('owner', 'referring_vet')
    and starts_on <= (now() at time zone 'Asia/Seoul')::date
    and (ends_on is null or ends_on >= (now() at time zone 'Asia/Seoul')::date)
  );
