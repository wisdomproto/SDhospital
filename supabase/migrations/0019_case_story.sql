-- 0019_case_story.sql — 치료 사례
--
-- 병원 블로그(sdamc.co.kr)에 치료 사례가 이미 수백 건 쌓여 있다. 보호자가 그걸 못 볼 뿐이다.
-- 우리 아이와 **같은 문제**로 치료받은 사례를 리포트 아래에 붙이면
-- "이 병원이 이걸 많이 한다"가 설명 없이 전달되고, 병원이 새로 쓸 글도 없다.
--
-- 본문을 복사해 오지 않고 **링크만 건다.** 글은 병원 것이고, 고치면 그쪽에서 고쳐진다.
-- 매칭은 태그로만 한다(`src/lib/case-stories.ts`) — AI 로 "비슷한 사례"를 고르면
-- 틀렸을 때 그 책임을 병원이 진다. 태그는 수의사가 직접 단다.

create table case_story (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  summary    text,
  url        text not null,
  tags       text[] not null default '{}',   -- 주 증상에 이 말이 들어 있으면 붙는다
  species    text,                            -- null = 종 무관
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index case_story_active_idx on case_story (active);

alter table case_story enable row level security;

create policy case_story_staff_all on case_story for all
  using (current_role_name() = 'staff')
  with check (current_role_name() = 'staff');

create policy case_story_read_active on case_story for select
  using (current_role_name() in ('owner', 'referring_vet') and active);
