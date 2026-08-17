"use client";

import { useState } from "react";
import { polishVetAnswer } from "@/app/portal/patients/[id]/chat/actions";

/**
 * 답변 칸 + **다듬기**.
 *
 * 수의사는 차트에 쓰던 말투로 쓴다 — 「술부 부종 경미, 소독 BID」. 그건 보호자가 못 읽는다.
 * 그렇다고 매번 풀어 쓰라고 하면 **그 부담 때문에 답이 늦어지고**, 늦은 답이 이 제품의 원래 문제였다.
 *
 * ⚠️ **다듬기는 보내지 않는다. 칸을 채워 줄 뿐이다.** 「나가는 문장은 원장님이 승인한 것만」은
 * 다듬기에도 걸린다 — AI 가 고친 말이 확인 없이 나가면 그 규칙이 깨진다.
 * 읽어 보고 그대로 보내거나, 원문으로 되돌린다.
 */
export function AnswerBox() {
  const [text, setText] = useState("");
  /** 다듬기 전 원문. null 이면 아직 안 다듬은 것 — 되돌릴 게 없다 */
  const [original, setOriginal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: ".85rem" }}>
        {original === null ? (
          <>
            ⚠️ <b>쓰신 그대로 보호자에게 갑니다.</b> 차트에 쓰시듯 메모로 쓰셔도 되고,
            「다듬기」를 누르면 <b>말투만</b> 고쳐 이 칸에 다시 넣어 드립니다 — 내용·판단은 안 바꿉니다.
          </>
        ) : (
          <>
            ✨ 말투만 다듬었습니다. <b>읽어 보시고</b> 보내 주세요.{" "}
            <button
              type="button"
              onClick={() => { setText(original); setOriginal(null); }}
              style={{ border: 0, background: "none", padding: 0, font: "inherit", textDecoration: "underline", cursor: "pointer" }}
            >
              원문으로 되돌리기
            </button>
          </>
        )}
      </p>
      <textarea
        name="answer"
        rows={6}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="예) 술부 부종 경미, 발적 있으나 삼출물 없음. 넥칼라 유지, 소독 BID. 3일 뒤 재진."
        style={{ width: "100%", padding: 12, font: "inherit" }}
      />
      {err && <p style={{ margin: 0, color: "#a33", fontSize: ".85rem" }}>{err}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn primary" disabled={busy || !text.trim()}>
          보호자에게 보내기
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy || !text.trim()}
          onClick={async () => {
            const before = text;
            setBusy(true);
            const res = await polishVetAnswer(before);
            setBusy(false);
            if (!res.ok) return setErr(res.error);
            setErr(null);
            setOriginal(before);
            setText(res.text);
          }}
        >
          {busy ? "다듬는 중…" : "✨ 다듬기"}
        </button>
      </div>
    </>
  );
}
