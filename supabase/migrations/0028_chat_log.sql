-- 채팅 대화 보관 (2026-08-11 원장 결정)
--
-- 두 가지 이유로 남긴다. 순서가 중요하다.
--  ① 증빙 — 채팅이 "1차 병원에서 보셔도 됩니다" 라고 했는데 그 아이가 잘못되면,
--     무엇을 언제 말했는지가 있어야 한다. 나중에 만들 수 없는 기록이다.
--  ② 주치의가 되는 재료 — EMR 에 절대 안 들어가는 것이 여기 쌓인다.
--     이 보호자가 어떤 사람인지, 그 아이가 무엇에 예민한지.
--     진료기록은 "무슨 병이었나" 를, 대화는 "이 집이 어떤 집인가" 를 남긴다.
--
-- ⚠️ **지우지 않는다.** 보호자가 지울 수 있으면 ①이 무너진다. 화면에서 감출 뿐이다.

create table chat_message (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  -- 한 번 앉아서 주고받은 덩어리. 카드를 갱신하는 단위이기도 하다
  thread_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- 답이 어느 문으로 나갔나. 나중에 세어 보려면 지금 남겨야 한다
  -- (사후에 문장을 다시 읽어 분류하면 그건 추정이지 기록이 아니다)
  -- ('asking' 은 0029 에서 더한다 — 이 파일은 실제로 적용된 그대로 둔다)
  triage text check (triage in ('now', 'tomorrow', 'primary', 'ask_vet', 'out_of_scope')),
  model text,
  -- 그때 무엇을 읽고 답했나. 프롬프트를 고친 뒤 "예전 답이 왜 저랬나" 를 되짚는 유일한 방법
  context_hash text,
  created_at timestamptz not null default now()
);
create index on chat_message (patient_id, created_at desc);
create index on chat_message (thread_id, created_at);

alter table chat_message enable row level security;

create policy chat_staff_all on chat_message for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');

-- 보호자는 **자기 아이 것만 읽는다.** 1차병원 원장은 뺐다 —
-- 진료기록과 달리 이건 보호자가 우리에게 한 사적인 말이다.
create policy chat_owner_read on chat_message for select
  using (
    current_role_name() = 'owner'
    and patient_id in (
      select pt.id from patient pt join profile pr on pr.id = auth.uid()
      where pt.owner_id = pr.owner_id
    )
  );

-- ⚠️ **보호자에게 insert 정책을 주지 않는다.** 생활기록과 다르다 —
-- 생활기록은 보호자가 쓴 자기 기록이지만, 여기엔 **우리가 한 말**이 같이 들어간다.
-- 정책으로 열면 보호자가 assistant 행을 직접 써넣을 수 있고, 그러면 증빙이 증빙이 아니다.
-- 쓰기는 아래 DEFINER 하나로만.
create or replace function log_chat(
  p_patient_id uuid,
  p_thread_id uuid,
  p_question text,
  p_answer text,
  p_triage text,
  p_model text,
  p_context_hash text
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- 자기 아이인지 여기서 확인한다. DEFINER 라 RLS 를 지나가므로 이 검사가 전부다.
  if not exists (
    select 1 from patient pt join profile pr on pr.id = auth.uid()
    where pt.id = p_patient_id and pt.owner_id = pr.owner_id
  ) then
    raise exception 'not your patient';
  end if;

  insert into chat_message (patient_id, thread_id, role, content, model, context_hash)
    values (p_patient_id, p_thread_id, 'user', p_question, null, p_context_hash);
  insert into chat_message (patient_id, thread_id, role, content, triage, model, context_hash)
    values (p_patient_id, p_thread_id, 'assistant', p_answer, p_triage, p_model, p_context_hash);
end; $$;

revoke all on function log_chat(uuid, uuid, text, text, text, text, text) from public;
grant execute on function log_chat(uuid, uuid, text, text, text, text, text) to authenticated;
