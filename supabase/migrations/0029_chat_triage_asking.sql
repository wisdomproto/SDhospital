-- triage 에 'asking' 을 더한다 (2026-08-11)
--
-- 0028 을 적용한 **뒤에** 「되묻고 끝내는 턴」이 생겼다.
-- 애매한 문의를 억지로 넷 중 하나에 밀어 넣던 게 "대뜸 예약 잡으라"는 답의 원인이었고,
-- 그걸 고치면서 분류를 미루는 값이 필요해졌다.
--
-- ⚠️ 그 사이 `asking` 으로 답한 대화는 **저장되지 않았다.** 답은 나갔고 로그만 빠졌다
-- (`log_chat` 실패는 서버 로그로만 남는다 — 보호자 화면을 막지 않는 게 우선이라).
-- 되묻는 턴은 실제로 흔해서, 안 고치면 "몇 번 만에 분류됐나" 를 영영 셀 수 없다.

alter table chat_message drop constraint chat_message_triage_check;
alter table chat_message add constraint chat_message_triage_check
  check (triage in ('now', 'tomorrow', 'primary', 'ask_vet', 'asking', 'out_of_scope'));
