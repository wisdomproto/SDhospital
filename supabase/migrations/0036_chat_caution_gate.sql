-- 0036_chat_caution_gate.sql — `patient_caution` 을 채팅에 연결하는 문
--
-- 진료기록을 사람이 읽어 모은 「그 집의 사정」 55건(30명)이 `patient_caution` 에 있는데
-- 채팅이 못 읽고 있었다. 그래서 채팅은 하루한테 「안 아파하면 괜찮습니다」라고 말할 수 있고,
-- 진솜한테 「1차 병원에 연락해 보세요」라고 말할 수 있다 — 둘 다 정확히 반대다.
--
-- ⚠️ **경계선은 내용이 아니라 종류로 긋는다.**
--   `context` 38건 → 채팅이 읽는다. **진료 원문(`visit.note`)과 같은 규칙** — 읽되 인용하지 않는다.
--                    진료 원문에도 이미 재수술비·타원 이름·공동화장이 그대로 들어 있고,
--                    69명 전수에서 유출 0건으로 확인했다. 여기만 새 규칙을 만들면 앞뒤가 안 맞는다.
--   `confirm` 17건 → **읽히지 않는다. 그 아이는 채팅을 잠근다.**
--                    「사망이 거의 확실하나 확정 문구가 없다」를 읽은 채팅은 두 방향 다 위험하다.
--                    살아 있는 것처럼 답해도 사고고 떠난 것처럼 답해도 사고다.
--
-- ⚠️ **보호자에게 여는 것은 참·거짓 하나뿐이다.** 본문을 돌려주는 함수를 만들면
--    보호자가 브라우저에서 RPC 를 직접 불러 비용 협의·안락사 언급을 그대로 읽는다.
--    본문은 서버가 service-role 로만 읽고 컨텍스트에만 넣는다 (`lib/chat/context.ts`).
create or replace function chat_locked(p_patient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from patient_caution c join patient p on p.id = c.patient_id
     where c.patient_id = p_patient
       and c.kind = 'confirm'
       and c.resolved_at is null
       and (
         current_role_name() = 'staff'
         or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
       )
  );
$$;

revoke all on function chat_locked(uuid) from public;
grant execute on function chat_locked(uuid) to authenticated;

comment on function chat_locked(uuid) is
  '생사가 기록으로 확정되지 않은 아이인가. 보호자에게 여는 것은 이 참·거짓 하나뿐이고 본문은 절대 나가지 않는다.';
