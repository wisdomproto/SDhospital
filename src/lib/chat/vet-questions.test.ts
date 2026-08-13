import { describe, expect, it } from "vitest";
import { pairVetQuestions, type ChatRow } from "./vet-questions";

const row = (o: Partial<ChatRow> & Pick<ChatRow, "thread_id" | "role" | "content" | "created_at">): ChatRow => ({
  triage: null,
  model: null,
  ...o,
});

describe("pairVetQuestions", () => {
  it("넘긴 질문에 사람이 쓴 답을 붙인다", () => {
    const got = pairVetQuestions([
      row({ thread_id: "t1", role: "user", content: "약 걸러도 되나요?", created_at: "2026-08-13T01:00:00Z" }),
      row({ thread_id: "t1", role: "assistant", content: "여쭤보고 알려드릴게요", triage: "ask_vet", model: "claude-opus-5", created_at: "2026-08-13T01:00:05Z" }),
      row({ thread_id: "t1", role: "assistant", content: "오늘 한 번은 거르셔도 됩니다", model: "staff", created_at: "2026-08-13T03:00:00Z" }),
    ]);
    expect(got).toHaveLength(1);
    expect(got[0].question).toBe("약 걸러도 되나요?");
    expect(got[0].answer).toBe("오늘 한 번은 거르셔도 됩니다");
  });

  it("답이 없으면 기다리는 중으로 둔다", () => {
    const got = pairVetQuestions([
      row({ thread_id: "t1", role: "user", content: "사료 바꿔도 되나요?", created_at: "2026-08-13T01:00:00Z" }),
      row({ thread_id: "t1", role: "assistant", content: "여쭤볼게요", triage: "ask_vet", created_at: "2026-08-13T01:00:05Z" }),
    ]);
    expect(got[0].answer).toBeNull();
  });

  it("AI 가 그냥 답한 턴은 목록에 넣지 않는다", () => {
    const got = pairVetQuestions([
      row({ thread_id: "t1", role: "user", content: "숨을 가쁘게 쉬어요", created_at: "2026-08-13T01:00:00Z" }),
      row({ thread_id: "t1", role: "assistant", content: "지금 전화 주세요", triage: "now", created_at: "2026-08-13T01:00:05Z" }),
    ]);
    expect(got).toHaveLength(0);
  });

  it("⚠️ 한 타래에서 두 번 넘기면 답은 최근 것에 붙는다", () => {
    const got = pairVetQuestions([
      row({ thread_id: "t1", role: "user", content: "첫 질문", created_at: "2026-08-01T01:00:00Z" }),
      row({ thread_id: "t1", role: "assistant", content: "여쭤볼게요", triage: "ask_vet", created_at: "2026-08-01T01:00:05Z" }),
      row({ thread_id: "t1", role: "user", content: "둘째 질문", created_at: "2026-08-05T01:00:00Z" }),
      row({ thread_id: "t1", role: "assistant", content: "이것도 여쭤볼게요", triage: "ask_vet", created_at: "2026-08-05T01:00:05Z" }),
      row({ thread_id: "t1", role: "assistant", content: "둘째에 대한 답", model: "staff", created_at: "2026-08-05T04:00:00Z" }),
    ]);
    // 최근 것이 위 → [0] 이 둘째 질문
    expect(got[0].question).toBe("둘째 질문");
    expect(got[0].answer).toBe("둘째에 대한 답");
    expect(got[1].question).toBe("첫 질문");
    expect(got[1].answer).toBeNull();
  });

  it("타래가 다르면 서로 답이 섞이지 않는다", () => {
    const got = pairVetQuestions([
      row({ thread_id: "t1", role: "user", content: "입원 질문", created_at: "2026-08-13T01:00:00Z" }),
      row({ thread_id: "t1", role: "assistant", content: "여쭤볼게요", triage: "ask_vet", created_at: "2026-08-13T01:00:05Z" }),
      row({ thread_id: "t2", role: "user", content: "평소 질문", created_at: "2026-08-13T02:00:00Z" }),
      row({ thread_id: "t2", role: "assistant", content: "여쭤볼게요", triage: "ask_vet", created_at: "2026-08-13T02:00:05Z" }),
      row({ thread_id: "t2", role: "assistant", content: "t2 답", model: "staff", created_at: "2026-08-13T05:00:00Z" }),
    ]);
    expect(got.find((q) => q.question === "입원 질문")?.answer).toBeNull();
    expect(got.find((q) => q.question === "평소 질문")?.answer).toBe("t2 답");
  });
});
