"use client";

import { useEffect, useRef, useState } from "react";
import { ask, type Turn } from "./actions";

/**
 * 샘플 채팅 — 물어보면 그 자리에서 답한다(주치의 확인 단계 없음).
 *
 * **질문 버튼이 먼저다.** 빈 입력칸만 두면 보호자는 무엇을 물어도 되는지 몰라서 안 쓴다.
 * 대화가 시작된 뒤에도 버튼을 남겨 둔다 — 두 번째 질문이 더 안 나온다.
 */
export function ChatBox({
  patientId,
  patientName,
  suggestions,
}: {
  patientId: string;
  patientName: string;
  suggestions: string[];
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const next: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(next);
    setDraft("");
    setError(null);
    setPending(true);
    const res = await ask(patientId, next);
    setPending(false);
    if (res.ok) setTurns([...next, { role: "assistant", text: res.text }]);
    else setError(res.error);
  }

  return (
    <>
      {turns.length === 0 && (
        <div className="portal-card">
          <div style={{ fontWeight: 800 }}>{patientName}에 대해 물어보세요</div>
          <p className="portal-tile-sub" style={{ margin: "6px 0 0" }}>
            {patientName}의 진료 기록과 다이어리를 같이 읽고 답해요.
            진단은 하지 않고 <b>지금 가야 하는지</b>를 알려드려요.
          </p>
        </div>
      )}

      {turns.length > 0 && (
        <div className="chat-log">
          {turns.map((t, i) => (
            <div key={i} className={`chat-bubble ${t.role}`}>
              {t.text}
            </div>
          ))}
          {pending && (
            <div className="chat-bubble assistant chat-typing">
              {patientName}의 기록을 읽고 있어요…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <div className="portal-card" style={{ borderColor: "#e2b4b4", color: "#a33" }}>
          {error}
        </div>
      )}

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>
          {turns.length ? "이런 것도 물어보실 수 있어요" : "이런 걸 물어보실 수 있어요"}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              className="chat-sample chat-ask"
              disabled={pending}
              onClick={() => send(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="직접 물어보기"
          disabled={pending}
          aria-label="질문"
        />
        <button type="submit" disabled={pending || !draft.trim()}>
          보내기
        </button>
      </form>

      <p className="portal-tile-sub" style={{ margin: "2px 2px 0" }}>
        급한 문의는 병원으로 전화 주세요. 이 답변은 진단이 아니에요.
      </p>
    </>
  );
}
