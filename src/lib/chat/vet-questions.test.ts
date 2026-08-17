import { describe, expect, it } from "vitest";
import { freshAnswer, type VetQuestion, pairVetQuestions, type ChatRow } from "./vet-questions";

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

const q = (askedAt: string, answer: string | null): VetQuestion => ({
  threadId: askedAt, question: "물어본 것", askedAt, answer,
  answeredAt: answer ? askedAt : null,
});

describe("freshAnswer — 무엇을 「방금 도착」으로 볼 것인가", () => {
  it("들어와 보니 이미 있던 답은 알리지 않는다", () => {
    const seen = new Set(["1"]);
    expect(freshAnswer(seen, [q("1", "예전 답")])).toBeNull();
  });

  it("보고 있는 동안 붙은 답만 알린다", () => {
    const seen = new Set(["1"]);
    expect(freshAnswer(seen, [q("1", "예전 답"), q("2", "방금 온 답")])?.answer).toBe("방금 온 답");
  });

  it("아직 답이 없는 것은 도착이 아니다", () => {
    expect(freshAnswer(new Set(), [q("1", null)])).toBeNull();
  });

  it("아무것도 없으면 null", () => {
    expect(freshAnswer(new Set(), [])).toBeNull();
  });
});

describe("같은 타임스탬프 — log_chat 이 질문과 답을 한 번에 넣는다", () => {
  // ⚠️ 실제로 화면에 빈 말풍선이 떴다. 정렬이 답을 먼저 주면 질문을 못 찾는다.
  const T = "2026-08-17T04:22:41.173Z";
  const rows: ChatRow[] = [
    { thread_id: "t", role: "assistant", content: "여쭤보고 답을 드릴게요", triage: "ask_vet", model: "claude-opus-5", created_at: T },
    { thread_id: "t", role: "user", content: "내일 입원인데 오늘 밤부터 굶겨야 하나요?", triage: null, model: null, created_at: T },
  ];

  it("답이 먼저 와도 질문을 찾아낸다", () => {
    expect(pairVetQuestions(rows)[0].question).toBe("내일 입원인데 오늘 밤부터 굶겨야 하나요?");
  });

  it("순서가 반대여도 같은 결과", () => {
    expect(pairVetQuestions(rows.slice().reverse())[0].question).toBe(
      "내일 입원인데 오늘 밤부터 굶겨야 하나요?"
    );
  });
});
