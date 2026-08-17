"use client";

import { useEffect, useRef, useState } from "react";
import { answerAsVetForTest, ask, type Triage, type Turn } from "./actions";
import { HOSPITAL_PHONE } from "@/lib/hospital";

/**
 * 샘플 채팅 — 물어보면 그 자리에서 답한다(주치의 확인 단계 없음).
 *
 * **질문 버튼이 먼저다.** 빈 입력칸만 두면 보호자는 무엇을 물어도 되는지 몰라서 안 쓴다.
 * 대화가 시작된 뒤에도 버튼을 남겨 둔다 — 두 번째 질문이 더 안 나온다.
 *
 * ⚠️ **탭은 없다.** 입원 중일 때 「입원 중 문의 / 평소 문의」로 갈라 놨었는데 없앴다 —
 * 보호자에게 자기 질문을 분류하게 시키는 것 자체가 부담이고, 무엇보다
 * **틀린 방에서 물으면 그 방의 규칙이 적용된다.** 병동 얘기인지 평소 얘기인지는
 * 문장을 읽으면 알 수 있어서 서버가 정한다(`actions.ts` 의 ADMISSION_TAB).
 */
export function ChatBox({
  patientId,
  patientName,
  suggestions,
  admittedAt,
  asOf = null,
  testMode = false,
}: {
  patientId: string;
  patientName: string;
  suggestions: string[];
  /** 입원 중이면 첫 화면 문구가 달라진다. 탭을 만들지는 않는다 */
  admittedAt: string | null;
  /** 직원 시나리오 테스트에서만 들어온다. 보호자 화면은 언제나 null */
  asOf?: string | null;
  /** ⚠️ 테스트 전용. 켜져 있으면 `ask_vet` 밑에 직원이 직접 답을 쓰는 칸이 뜬다 */
  testMode?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [triage, setTriage] = useState<Triage | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vetDraft, setVetDraft] = useState("");
  const [vetSending, setVetSending] = useState(false);
  const [vetDone, setVetDone] = useState(false);
  const threadId = useRef(crypto.randomUUID());
  const endRef = useRef<HTMLDivElement>(null);
  const vetDialog = useRef<HTMLDialogElement>(null);

  // ⚠️ **`ask_vet` 이 나오면 창이 저절로 뜬다.** 지금 이걸 눌러 보는 사람은 직원이고,
  // 답 하나 보려고 다른 창에서 「오늘 할 일」로 들어갔다 오게 하면 그 흐름을 끝까지 안 본다.
  // 넘긴 자리에서 바로 쓰게 한다.
  useEffect(() => {
    if (testMode && triage === "ask_vet" && !pending && !vetDone) vetDialog.current?.showModal();
  }, [testMode, triage, pending, vetDone]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const next: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(next);
    setDraft("");
    setTriage(null);
    setError(null);
    setVetDone(false);
    setPending(true);
    const res = await ask(patientId, threadId.current, next, asOf);
    setPending(false);
    if (res.ok) {
      setTurns([...next, { role: "assistant", text: res.text }]);
      setTriage(res.triage);
    } else setError(res.error);
  }

  return (
    <>
      {turns.length === 0 && (
        <div className="portal-card">
          <div style={{ fontWeight: 800 }}>
            {admittedAt
              ? `${patientName}는 지금 입원 중이에요`
              : `${patientName}에 대해 물어보세요`}
          </div>
          <p className="portal-tile-sub" style={{ margin: "6px 0 0" }}>
            {admittedAt ? (
              <>
                {admittedAt} 입원. 병동 상황은 담당 선생님이 직접 확인해서 알려드려요.
                <br />
                평소 궁금하신 것도 여기서 그대로 물어보시면 됩니다.
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
          {(triage === "now" || triage === "tomorrow") && !pending && (
            <a className={`chat-call${triage === "now" ? " urgent" : ""}`} href={`tel:${HOSPITAL_PHONE}`}>
              📞 병원에 전화하기 {HOSPITAL_PHONE}
            </a>
          )}
          {/* 사람에게 넘긴 질문. 전화 버튼을 대신 두지 않는다 —
              기다려 달라고 해 놓고 전화 버튼을 띄우면 기다리라는 말이 아니게 된다.
              대신 답이 여기로 온다는 것과, 급해지면 그때 전화하라는 것만 남긴다. */}
          {triage === "ask_vet" && !pending && (
            <>
              <div className="chat-waiting">
                <b>담당 선생님께 전달했어요</b>
                <span>
                  답이 오면 이 대화에 그대로 올라와요. 그 사이에 상태가 나빠지면 기다리지 마시고{" "}
                  <a href={`tel:${HOSPITAL_PHONE}`}>{HOSPITAL_PHONE}</a> 로 전화 주세요.
                </span>
              </div>
              {/* 창을 닫아 버렸으면 다시 열 수 있어야 한다 */}
              {testMode && !vetDone && (
                <button type="button" className="vet-reopen" onClick={() => vetDialog.current?.showModal()}>
                  🩺 직원 답변 달기
                </button>
              )}
            </>
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

      {/* ⚠️ **테스트 전용 팝업.** 저장되는 행은 「오늘 할 일」로 답한 것과 완전히 같다
          (`answer_chat` · `model='staff'`) — 테스트용 샛길로 다른 모양의 데이터를 만들지 않는다.
          ⚠️ 닫힌 `<dialog>` 에 `display` 를 강제하면 화면에 그대로 깔린다. CSS 는 `[open]` 에만. */}
      <dialog ref={vetDialog} className="vet-sheet">
        <form
          method="dialog"
          className="vet-sheet-box"
          onSubmit={async (e) => {
            e.preventDefault();
            const text = vetDraft.trim();
            if (!text || vetSending) return;
            setVetSending(true);
            const res = await answerAsVetForTest(patientId, threadId.current, text);
            setVetSending(false);
            if (!res.ok) { setError(res.error); vetDialog.current?.close(); return; }
            setVetDone(true);
            setVetDraft("");
            setTurns((t) => [...t, { role: "assistant", text }]);
            vetDialog.current?.close();
          }}
        >
          <div className="vet-sheet-head">
            <b>🩺 담당 선생님께 넘어온 질문입니다</b>
            <button type="button" onClick={() => vetDialog.current?.close()} aria-label="닫기">✕</button>
          </div>
          <p className="vet-sheet-q">{turns.filter((t) => t.role === "user").slice(-1)[0]?.text}</p>
          <textarea
            value={vetDraft}
            onChange={(e) => setVetDraft(e.target.value)}
            rows={4}
            autoFocus
            placeholder="예) 사진 보니 절개선은 붙어 있고 주변만 붉은 정도입니다. 내일 오전에 한 번 보겠습니다."
            disabled={vetSending}
          />
          <p className="vet-sheet-note">⚠️ 쓰신 그대로 보호자에게 갑니다. AI 가 다듬지 않습니다.</p>
          <button type="submit" className="vet-sheet-send" disabled={vetSending || !vetDraft.trim()}>
            {vetSending ? "보내는 중…" : "보호자에게 답변 보내기"}
          </button>
        </form>
      </dialog>
    </>
  );
}
