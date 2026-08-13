-- 채팅이 사람에게 넘긴 질문 (2026-08-13 원장 결정)
--
-- AI 가 애매하면 지어내지 말고 **기다려 달라고 하고 사람에게 넘긴다.**
-- 그 「넘김」을 위한 새 테이블은 만들지 않는다 — 대화가 이미 기록이고,
-- 넘긴 사실도 그 안에 있다. 테이블을 하나 더 두면 대화와 넘김이 어긋날 자리가 생긴다.
--
--   넘김  = triage 가 'ask_vet' 인 우리 쪽 메시지
--   답변  = 그 뒤에 같은 타래에 들어온 model='staff' 메시지 (직원이 직접 쓴 것)
--   대기중 = 넘겼는데 아직 그 뒤에 직원 답이 없는 것
--
-- ⚠️ security_invoker — 뷰가 RLS 를 우회하면 안 된다.
-- 보호자는 chat_message 정책 그대로 자기 아이 것만, 직원은 전부 본다.

create view chat_pending with (security_invoker = on) as
select
  a.id,
  a.patient_id,
  a.thread_id,
  a.created_at as asked_at,
  q.content     as question,       -- 보호자가 실제로 물은 말
  a.content     as holding_reply,  -- 「여쭤보고 답드릴게요」 라고 나간 말
  p.name        as patient_name,
  p.species     as patient_species
from chat_message a
join patient p on p.id = a.patient_id
-- 그 넘김 직전의 보호자 질문. 없을 수는 없지만 left 로 둔다 (없다고 목록에서 사라지면 안 된다)
left join lateral (
  select u.content
  from chat_message u
  where u.thread_id = a.thread_id and u.role = 'user' and u.created_at <= a.created_at
  order by u.created_at desc
  limit 1
) q on true
where a.triage = 'ask_vet'
  and not exists (
    select 1 from chat_message s
    where s.thread_id = a.thread_id
      and s.model = 'staff'
      and s.created_at > a.created_at
  );

comment on view chat_pending is
  'AI 가 답을 못 정하고 사람에게 넘긴 질문 중 아직 답이 안 나간 것. 오늘 할 일에 뜬다.';

-- 직원이 답을 쓸 때 쓴다. chat_message 에 직원 쓰기 정책이 이미 있어 DEFINER 는 필요 없지만,
-- **model='staff' 를 앱이 정하게 두지 않는다** — 그 값이 곧 「사람이 답했다」의 근거다.
create or replace function answer_chat(
  p_patient_id uuid,
  p_thread_id uuid,
  p_answer text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if current_role_name() <> 'staff' then
    raise exception 'staff only';
  end if;
  insert into chat_message (patient_id, thread_id, role, content, model)
    values (p_patient_id, p_thread_id, 'assistant', p_answer, 'staff');
end; $$;

revoke all on function answer_chat(uuid, uuid, text) from public;
grant execute on function answer_chat(uuid, uuid, text) to authenticated;
