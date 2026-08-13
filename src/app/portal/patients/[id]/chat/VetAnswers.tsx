"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { VetQuestion } from "@/lib/chat/vet-questions";

/**
 * 선생님께 넘긴 질문과 그 답.
 *
 * ⚠️ **기다리는 게 있을 때만 새로고침한다.** 답이 다 온 화면을 계속 두드릴 이유가 없다.
 * 알림은 넣지 않는다 — 이 앱의 규칙이다. 대신 열어 두면 답이 조용히 올라온다.
 */
export function VetAnswers({ items }: { items: VetQuestion[] }) {
  const router = useRouter();
  const waiting = items.some((q) => !q.answer);

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [waiting, router]);

  if (items.length === 0) return null;

  return (
    <div className="portal-card" style={{ display: "grid", gap: 12 }}>
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
