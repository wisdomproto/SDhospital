"use client";

import { useEffect, useRef, useState } from "react";
import { pendingAnswers } from "./actions";
import { freshAnswer, type VetQuestion } from "@/lib/chat/vet-questions";

/**
 * 선생님께 넘긴 질문과 그 답.
 *
 * ⚠️ **기다리는 게 있을 때만 새로고침한다.** 답이 다 온 화면을 계속 두드릴 이유가 없다.
 * 알림은 넣지 않는다 — 이 앱의 규칙이다. 대신 열어 두면 답이 조용히 올라온다.
 */
export function VetAnswers({ patientId, items: initial }: { patientId: string; items: VetQuestion[] }) {
  const [items, setItems] = useState(initial);
  const [arrived, setArrived] = useState<VetQuestion | null>(null);
  // 이미 답이 와 있던 것은 「도착」이 아니다. 첫 렌더 시점을 기준으로 잡아 둔다.
  const seen = useRef(new Set(initial.filter((q) => q.answer).map((q) => q.askedAt)));
  const waiting = items.some((q) => !q.answer);

  // ⚠️ **`router.refresh()` 로는 안 됐다.** RSC 캐시 때문에 5초마다 두드려도 화면이 그대로였다
  // (실측: 답을 넣고 17초 뒤에도 「답변을 기다리는 중」). 서버 액션을 직접 부른다.
  // ⚠️ **기다리는 게 있을 때만 두드린다.** 답이 다 온 화면을 계속 물어볼 이유가 없다.
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const tick = async () => {
      const next = await pendingAnswers(patientId);
      if (!alive) return;
      // 화면을 보고 있는 동안 **새로 붙은 답**만 알린다
      const fresh = freshAnswer(seen.current, next);
      for (const q of next) if (q.answer) seen.current.add(q.askedAt);
      setItems(next);
      if (fresh) setArrived(fresh);
    };
    const t = setInterval(tick, 5_000);
    return () => { alive = false; clearInterval(t); };
  }, [waiting, patientId]);

  if (items.length === 0) return null;

  return (
    <div className="portal-card" style={{ display: "grid", gap: 12 }}>
      {arrived && (
        <div className="answer-toast" role="status">
          <div className="answer-toast-head">
            <b>담당 선생님 답변이 도착했어요</b>
            <button type="button" onClick={() => setArrived(null)} aria-label="닫기">✕</button>
          </div>
          <p>{arrived.answer}</p>
        </div>
      )}
      <div style={{ fontWeight: 800 }}>선생님께 여쭤본 것</div>
      {items.map((q) => (
        <div key={q.askedAt} style={{ display: "grid", gap: 6 }}>
          <div className="chat-bubble user" style={{ marginLeft: 0 }}>
            {q.question}
          </div>
          {q.answer ? (
            <>
              <div className="chat-bubble assistant">{q.answer}</div>
              <div className="portal-tile-sub" style={{ fontSize: ".78rem" }}>
                담당 선생님 답변 · {new Date(q.answeredAt!).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
              </div>
            </>
          ) : (
            <div className="chat-waiting">
              <b>답변을 기다리는 중이에요</b>
              <span>확인되는 대로 여기에 올라와요.</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
