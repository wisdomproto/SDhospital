/**
 * 「선생님께 여쭤본 것」 — 넘긴 질문과 사람이 쓴 답을 짝지어 준다.
 *
 * 대화 한 줄짜리 테이블에서 읽어낸다(따로 저장하지 않는다 — `0032_chat_pending.sql` 참고).
 *   넘김 = assistant + triage 'ask_vet'
 *   답   = 그 뒤 같은 타래의 assistant + model 'staff'
 *
 * ⚠️ **한 타래에서 두 번 넘길 수 있다.** 그때 답은 **가장 최근에 열린 넘김**에 붙는다.
 *    (같은 타래의 첫 넘김에 붙이면 오래된 질문에 새 답이 달린다.)
 */
export type ChatRow = {
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  triage: string | null;
  model: string | null;
  created_at: string;
};

export type VetQuestion = {
  threadId: string;
  question: string;
  askedAt: string;
  /** 사람이 쓴 답. null 이면 아직 기다리는 중 */
  answer: string | null;
  answeredAt: string | null;
};

/** `rows` 는 시간 오름차순이어야 한다 */
export function pairVetQuestions(rows: ChatRow[]): VetQuestion[] {
  const out: VetQuestion[] = [];
  const lastUser = new Map<string, string>();
  // 타래별로 아직 답이 안 붙은 넘김의 위치
  const open = new Map<string, number>();

  for (const r of rows) {
    if (r.role === "user") {
      lastUser.set(r.thread_id, r.content);
      continue;
    }
    if (r.triage === "ask_vet") {
      out.push({
        threadId: r.thread_id,
        question: lastUser.get(r.thread_id) ?? "",
        askedAt: r.created_at,
        answer: null,
        answeredAt: null,
      });
      open.set(r.thread_id, out.length - 1);
    } else if (r.model === "staff") {
      const i = open.get(r.thread_id);
      if (i !== undefined) {
        out[i].answer = r.content;
        out[i].answeredAt = r.created_at;
        open.delete(r.thread_id);
      }
    }
  }
  // 최근 것이 위로
  return out.reverse();
}
