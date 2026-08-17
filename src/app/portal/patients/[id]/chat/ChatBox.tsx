"use client";

import { useEffect, useRef, useState } from "react";
import { ask, type Mode, type Triage, type Turn } from "./actions";
import { HOSPITAL_PHONE } from "@/lib/hospital";

type Convo = { turns: Turn[]; triage: Triage | null; threadId: string; draft: string };
const empty = (): Convo => ({ turns: [], triage: null, threadId: crypto.randomUUID(), draft: "" });

/**
 * 샘플 채팅 — 물어보면 그 자리에서 답한다(주치의 확인 단계 없음).
 *
 * **질문 버튼이 먼저다.** 빈 입력칸만 두면 보호자는 무엇을 물어도 되는지 몰라서 안 쓴다.
 * 대화가 시작된 뒤에도 버튼을 남겨 둔다 — 두 번째 질문이 더 안 나온다.
 *
 * **입원 중이면 위에 탭이 둘로 갈린다.** 아이가 병원에 있는 동안 묻는 것과
 * 평소에 묻는 것은 답이 아예 다르다. ⚠️ 그렇다고 입원 모드로 **가둬 두지는 않는다** —
 * 입원 중에도 "퇴원하면 사료 뭐 먹여요" 를 물을 데가 있어야 한다.
 * 두 대화는 각자 따로 쌓인다(스레드가 다르다).
 */
export function ChatBox({
  patientId,
  patientName,
  suggestions,
  admittedAt,
  admissionSuggestions,
  asOf = null,
}: {
  patientId: string;
  patientName: string;
  suggestions: string[];
  admittedAt: string | null;
  admissionSuggestions: string[];
  /** 직원 시나리오 테스트에서만 들어온다. 보호자 화면은 언제나 null */
  asOf?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(admittedAt ? "admission" : "general");
  const [convos, setConvos] = useState<Record<Mode, Convo>>({
    admission: empty(),
    general: empty(),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const c = convos[mode];
  const qs = mode === "admission" ? admissionSuggestions : suggestions;
  const patch = (m: Mode, v: Partial<Convo>) =>
    setConvos((prev) => ({ ...prev, [m]: { ...prev[m], ...v } }));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [c.turns, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const at = mode; // 답이 오는 사이에 탭을 바꿔도 원래 탭에 붙어야 한다
    const next: Turn[] = [...convos[at].turns, { role: "user", text: q }];
    patch(at, { turns: next, draft: "", triage: null });
    setError(null);
    setPending(true);
    const res = await ask(patientId, convos[at].threadId, at, next, asOf);
    setPending(false);
    if (res.ok) patch(at, { turns: [...next, { role: "assistant", text: res.text }], triage: res.triage });
    else setError(res.error);
  }

  return (
    <>
      {admittedAt && (
        <div className="chat-modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "admission"}
            className={mode === "admission" ? "active" : ""}
            onClick={() => setMode("admission")}
          >
            입원 중 문의
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "general"}
            className={mode === "general" ? "active" : ""}
            onClick={() => setMode("general")}
          >
            평소 문의
          </button>
        </div>
      )}

      {c.turns.length === 0 && (
        <div className="portal-card">
          <div style={{ fontWeight: 800 }}>
            {mode === "admission"
              ? `${patientName}는 지금 입원 중이에요`
              : `${patientName}에 대해 물어보세요`}
          </div>
          <p className="portal-tile-sub" style={{ margin: "6px 0 0" }}>
            {mode === "admission" ? (
              <>
                {admittedAt} 입원. 병동 상황은 담당 선생님이 직접 확인해서 알려드려요.
                <br />
                여기서 남기시면 담당자에게 전달됩니다.
              </>
            ) : (
              <>
                {patientName}의 진료 기록과 다이어리를 같이 읽고 답해요. 진단은 하지 않고{" "}
                <b>지금 가야 하는지</b>를 알려드려요.
              </>
            )}
          </p>
        </div>
      )}

      {c.turns.length > 0 && (
        <div className="chat-log">
          {c.turns.map((t, i) => (
            <div key={i} className={`chat-bubble ${t.role}`}>
              {t.text}
            </div>
          ))}
          {pending && (
            <div className="chat-bubble assistant chat-typing">
              {patientName}의 기록을 읽고 있어요…
            </div>
          )}
          {(c.triage === "now" || c.triage === "tomorrow") && !pending && (
            <a className={`chat-call${c.triage === "now" ? " urgent" : ""}`} href={`tel:${HOSPITAL_PHONE}`}>
              📞 병원에 전화하기 {HOSPITAL_PHONE}
            </a>
          )}
          {/* 사람에게 넘긴 질문. 전화 버튼을 대신 두지 않는다 —
              기다려 달라고 해 놓고 전화 버튼을 띄우면 기다리라는 말이 아니게 된다.
              대신 답이 여기로 온다는 것과, 급해지면 그때 전화하라는 것만 남긴다. */}
          {c.triage === "ask_vet" && !pending && (
            <div className="chat-waiting">
              <b>담당 선생님께 전달했어요</b>
              <span>
                답이 오면 이 대화에 그대로 올라와요. 그 사이에 상태가 나빠지면 기다리지 마시고{" "}
                <a href={`tel:${HOSPITAL_PHONE}`}>{HOSPITAL_PHONE}</a> 로 전화 주세요.
              </span>
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
          {c.turns.length ? "이런 것도 물어보실 수 있어요" : "이런 걸 물어보실 수 있어요"}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {qs.map((q) => (
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
          send(c.draft);
        }}
      >
        <input
          value={c.draft}
          onChange={(e) => patch(mode, { draft: e.target.value })}
          placeholder="직접 물어보기"
          disabled={pending}
          aria-label="질문"
        />
        <button type="submit" disabled={pending || !c.draft.trim()}>
          보내기
        </button>
      </form>

      <p className="portal-tile-sub" style={{ margin: "2px 2px 0" }}>
        급한 문의는 병원으로 전화 주세요. 이 답변은 진단이 아니에요.
      </p>
    </>
  );
}
