"use client";

import { useState, useTransition } from "react";
import { requestImages } from "./actions";

/**
 * 의료영상 — 요청하기 전 상태.
 *
 * ⚠️ **무엇을 찍었는지는 알려주고, 영상은 안 보여준다.** 검사 요약("X-ray 2건")은
 * 원래도 보호자에게 나가던 것이고, 그것마저 감추면 요청할 게 있는 줄도 모른다.
 */
export function ImageRequest({
  patientId,
  visitId,
  summary,
  requested,
}: {
  patientId: string;
  visitId: string;
  summary: string[];
  /** 이미 요청해 둔 회차인가 */
  requested: boolean;
}) {
  const [sent, setSent] = useState(requested);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (sent) {
    return (
      <p className="portal-tile-sub" style={{ margin: 0 }}>
        ✓ 요청하셨어요. <b>담당의가 확인한 뒤 보내드립니다.</b>
      </p>
    );
  }

  return (
    <>
      <p className="portal-tile-sub" style={{ margin: "0 0 12px" }}>
        {summary.length > 0 ? summary.join(" · ") : "촬영한 영상이 있어요"}
      </p>
      <button
        type="button"
        className="btn-primary"
        style={{ width: "100%" }}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await requestImages(patientId, visitId);
            // 낙관적으로 바꾸지 않는다 — 이건 병원에 일을 시키는 버튼이라
            // 실제로 접수됐을 때만 "요청하셨어요"가 떠야 한다.
            if (r.ok) setSent(true);
            else setErr(r.error);
          })
        }
      >
        {pending ? "요청하는 중…" : "영상 보내주세요"}
      </button>
      {err && (
        <p className="portal-tile-sub" style={{ margin: "8px 0 0", color: "var(--danger, #dc2626)" }}>
          {err}
        </p>
      )}
      <p className="portal-tile-sub" style={{ margin: "10px 0 0" }}>
        영상은 <b>담당의가 확인한 뒤</b> 보내드려요. 궁금한 점은 진료 때 함께 봐 주세요.
      </p>
    </>
  );
}
