-- 원장님이 채팅 검토본(`/deck/sd-chat-eval-*.html`)에서 문답마다 달아 둔 코멘트.
--
-- ⚠️ 그 화면은 **로그인 전 공개 페이지**다(`proxy.ts` 의 `/deck/` 예외).
--    그래서 쓰기를 열려면 방법이 하나뿐이다 — **DEFINER 함수**.
--    표 자체에는 insert 정책을 만들지 않는다. 아무도 직접 못 쓰고 이 함수로만 들어온다.
-- ⚠️ **주소를 아는 사람은 누구나 쓸 수 있다.** 원장님이 그걸 알고 고르신 길이라(2026-08-18)
--    막지 않고 대신 **한 번에 500건·글자수 상한**을 함수 안에 박았다. 읽기는 직원만 된다.
--    (익명으로 확인함: 쓰기 200 / 읽기 `[]`)
create table if not exists chat_review_comment (
  id            uuid primary key default gen_random_uuid(),
  -- 리포트의 `data-k` 와 같은 값 = 차트번호|시나리오|질문. 다시 보내면 덮어쓴다.
  item_key      text not null unique,
  chart_no      text not null,
  scenario      text,
  question      text,
  chat_answer   text,
  comment       text not null,
  submitted_at  timestamptz not null default now()
);

create index if not exists chat_review_comment_chart_idx on chat_review_comment (chart_no);

alter table chat_review_comment enable row level security;

-- 읽는 건 직원만. 쓰기 정책은 **일부러 없다** — 아래 함수로만 들어온다.
drop policy if exists chat_review_staff_read on chat_review_comment;
create policy chat_review_staff_read on chat_review_comment
  for select using (current_role_name() = 'staff');

-- 로컬(localStorage)에 쌓아 둔 코멘트를 한 번에 올린다.
-- 같은 문답에 다시 쓰면 덮어쓴다 — 여러 번 눌러도 쌓이지 않는다.
create or replace function submit_chat_review(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception '배열이 아니다';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception '한 번에 500건까지';
  end if;

  insert into chat_review_comment
    (item_key, chart_no, scenario, question, chat_answer, comment)
  select
    left(x->>'k', 600),
    left(coalesce(nullif(btrim(x->>'chart'), ''), split_part(x->>'k', '|', 1)), 20),
    left(x->>'scenario', 40),
    left(x->>'question', 600),
    left(x->>'answer', 4000),
    left(x->>'comment', 4000)
  from jsonb_array_elements(p_items) x
  where coalesce(btrim(x->>'k'), '') <> ''
    and coalesce(btrim(x->>'comment'), '') <> ''
  on conflict (item_key) do update set
    comment      = excluded.comment,
    chat_answer  = excluded.chat_answer,
    question     = excluded.question,
    scenario     = excluded.scenario,
    submitted_at = now();

  get diagnostics n = row_count;
  return n;
end
$fn$;

revoke all on function submit_chat_review(jsonb) from public;
grant execute on function submit_chat_review(jsonb) to anon, authenticated;

comment on table chat_review_comment is
  '원장님 채팅 검토 코멘트. 공개 검토본에서 DEFINER(submit_chat_review)로만 들어온다.';

-- ── 읽어 오기 (0041 로 따로 올렸다가 여기 합침) ──────────────────────────────
-- 검토본을 **다른 컴퓨터에서 열어도** 앞서 쓴 코멘트가 보이게 한다.
-- ⚠️ 표의 select 는 직원만이라 익명 세션은 못 읽는다. 쓰기와 같은 방식으로 — DEFINER 하나.
-- ⚠️ 돌려주는 건 `item_key` 와 코멘트뿐이다. 질문·채팅 답은 페이지가 이미 갖고 있다.
-- ⚠️ 읽기를 여는 것이 새 노출은 아니다 — **그 페이지엔 이미 환자 113명의 진료 원문이 있다.**
--    진짜 해결은 이 화면을 로그인 뒤로 옮기는 것이고, 그건 따로 남아 있다.
create or replace function get_chat_review()
returns table (item_key text, comment text)
language sql
security definer
set search_path = public
as $fn$
  select c.item_key, c.comment from chat_review_comment c order by c.submitted_at;
$fn$;

revoke all on function get_chat_review() from public;
grant execute on function get_chat_review() to anon, authenticated;
