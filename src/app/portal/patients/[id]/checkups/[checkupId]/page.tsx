import { createClient } from "@/lib/supabase/server";
import { loadCheckup, previousValues } from "@/lib/checkup/load";
import { VERDICT_LABEL, ownerPhrase, parseNumeric } from "@/lib/checkup/evaluate";
import { RefreshOnRead } from "@/app/portal/RefreshOnRead";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * 보호자용 검진 결과.
 *
 * **수치를 앞세우지 않는다.** BUN 44.2 를 먼저 보여주면 검색부터 하게 된다.
 * 먼저 "무엇을 확인해야 하는가"를 말하고, 숫자는 접어 둔 채 원하는 사람만 펼친다.
 * 담당의 소견은 원문 그대로 — 우리가 줄이면 그 문장의 책임을 병원이 진다.
 */
export default async function PortalCheckup({
  params,
}: {
  params: Promise<{ id: string; checkupId: string }>;
}) {
  const { id, checkupId } = await params;
  const supabase = await createClient();
  const c = await loadCheckup(supabase, checkupId);
  if (!c || c.patientId !== id) notFound();

  const justRead = c.sentAt != null && c.readAt == null;
  if (justRead) await supabase.rpc("mark_checkup_read", { p_checkup_id: checkupId });

  const prev = await previousValues(supabase, id, c.checkedOn);

  // 확인이 필요한 항목만 먼저 모은다
  const flagged = c.sections.flatMap((s) =>
    s.values
      .filter((v) => v.eval.verdict !== "normal" && v.eval.verdict !== "unknown")
      .map((v) => ({ section: s.title, v }))
  );

  return (
    <>
      <RefreshOnRead when={justRead} />
      <Link href={`/portal/patients/${id}/visits`} className="portal-tile-sub" style={{ textDecoration: "none" }}>
        ← 진료 기록
      </Link>

      <div>
        <div style={{ fontSize: "1.25rem", fontWeight: 900 }}>건강검진 결과</div>
        <div className="portal-tile-sub">
          {c.checkedOn}
          {c.vetName ? ` · ${c.vetName} 선생님` : ""}
        </div>
      </div>

      <div className={`portal-card${flagged.length ? " tile-new" : ""}`}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          {flagged.length === 0 ? "확인이 필요한 항목은 없었어요" : `확인이 필요한 항목 ${flagged.length}가지`}
        </div>
        {flagged.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {flagged.map(({ section, v }) => (
              <div key={`${section}-${v.item.key}-${v.side ?? ""}`} className={`daily-line ${v.eval.verdict === "watch" ? "alert" : "watch"}`}>
                <span className="k" style={{ width: 66 }}>{section}</span>
                <span className="v">{ownerPhrase(v.item.label, v.eval)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="portal-tile-sub" style={{ margin: 0 }}>
            검사한 항목이 모두 참고범위 안에 있었어요.
          </p>
        )}
      </div>

      {c.conclusion && (
        <div className="portal-card" style={{ borderLeft: "4px solid var(--brand, #2f7d6a)" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>담당의 소견</div>
          <p style={{ margin: 0, fontSize: ".95rem", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
            {c.conclusion}
          </p>
        </div>
      )}

      {c.recheckOn && (
        <div className="portal-card coupon">
          <div className="coupon-strip">
            <div style={{ fontWeight: 800, fontSize: ".95rem" }}>다음 확인 · {c.recheckOn}</div>
            {c.recheckNote && <div className="coupon-note">{c.recheckNote}</div>}
          </div>
          <p className="portal-tile-sub" style={{ margin: 0, textAlign: "center" }}>
            때가 되면 알림으로 다시 알려드릴게요.
          </p>
        </div>
      )}

      {c.sections.map((s) => (
        <details key={s.key} className="portal-card checkup-section">
          <summary>
            <span style={{ fontWeight: 800 }}>{s.title}</span>
            {s.outOfRange > 0 ? (
              <span className="pill-new">{s.outOfRange}</span>
            ) : (
              s.values.length > 0 && <span className="portal-tile-sub">정상</span>
            )}
          </summary>

          {s.note && (
            <p style={{ margin: "8px 0 0", fontSize: ".9rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {s.note}
            </p>
          )}

          {s.values.length > 0 && (
            <table className="checkup-table">
              <thead>
                <tr>
                  <th>항목</th>
                  <th>결과</th>
                  <th>참고범위</th>
                  {prev && <th>{prev.checkedOn.slice(0, 7)}</th>}
                </tr>
              </thead>
              <tbody>
                {s.values.map((v) => {
                  const before = prev?.byKey.get(`${s.key}.${v.item.key}`);
                  const beforeNum = before ? parseNumeric(before) : null;
                  const delta =
                    beforeNum != null && v.eval.numeric != null ? v.eval.numeric - beforeNum : null;
                  return (
                    <tr key={`${v.item.key}-${v.side ?? ""}`} className={v.eval.verdict}>
                      <td>
                        {v.item.label}
                        {v.side ? ` (${v.side === "L" ? "좌" : "우"})` : ""}
                        {v.item.unit ? <span className="unit"> {v.item.unit}</span> : null}
                      </td>
                      <td>
                        <b>{v.raw || "-"}</b>
                        {v.eval.verdict !== "unknown" && v.eval.verdict !== "normal" && (
                          <span className="vd"> {VERDICT_LABEL[v.eval.verdict]}</span>
                        )}
                      </td>
                      <td className="ref">
                        {v.eval.range?.min != null || v.eval.range?.max != null
                          ? `${v.eval.range?.min ?? ""}~${v.eval.range?.max ?? ""}`
                          : v.eval.range?.text ?? "-"}
                      </td>
                      {prev && (
                        <td className="ref">
                          {before ?? "-"}
                          {delta != null && delta !== 0 && (
                            <span className="unit"> {delta > 0 ? "▲" : "▼"}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </details>
      ))}

      <p className="portal-tile-sub" style={{ margin: 0 }}>
        수치는 검사 당시 상태·긴장·공복 여부에 따라 달라질 수 있어요. 궁금한 점은 병원으로 문의해 주세요.
      </p>
    </>
  );
}
