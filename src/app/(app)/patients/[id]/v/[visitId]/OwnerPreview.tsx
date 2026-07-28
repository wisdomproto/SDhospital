"use client";
import { useRef, useState } from "react";
import { buildOwnerReport, type OwnerReport, type ReportPatient, type ReportVisit } from "@/lib/owner-report";

/**
 * 보내기 전에 보호자가 볼 화면을 그대로 띄운다.
 * "보냈는데 이런 내용인 줄 몰랐다" 를 막는 게 목적이라, 저장된 값이 아니라
 * 지금 폼에 입력된 값으로 조립한다. 그래서 미리보기는 클라이언트에서 만든다.
 */
export function OwnerPreview({
  patient,
  visitDate,
  prev,
  alreadySent,
  className = "btn btn-secondary",
  label = "보호자 전송 미리보기",
}: {
  patient: ReportPatient;
  visitDate: string;
  prev: ReportVisit | null;
  alreadySent: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [report, setReport] = useState<OwnerReport | null>(null);

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const val = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";
    const w = parseFloat(val("weight_kg"));
    setReport(
      buildOwnerReport(
        patient,
        {
          visit_date: visitDate,
          chief_complaint: val("chief_complaint"),
          weight_kg: Number.isFinite(w) ? w : null,
          report_comment: val("comment"),
          report_notice: val("report_notice"),
        },
        prev
      )
    );
    ref.current?.showModal();
  };

  return (
    <>
      <button type="button" className={className} onClick={open}>
        {label}
      </button>

      <dialog ref={ref} className="preview-dialog">
        {report && (
          <>
            <div className="preview-head">
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>보호자 전송 미리보기</h2>
              <button type="button" className="portal-iconbtn" aria-label="닫기" onClick={() => ref.current?.close()}>
                ✕
              </button>
            </div>

            <div className="preview-body">
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="avatar-chip" style={{ width: 38, height: 38, fontSize: 20 }}>
                  {patient.species === "고양이" ? "🐱" : "🐶"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.35 }}>{report.title}</div>
                  <div className="muted" style={{ fontSize: ".84rem", marginTop: 2 }}>{report.profile}</div>
                </div>
              </div>

              {report.changes.length > 0 && (
                <section className="preview-box">
                  <div className="preview-box-title">지난 방문 대비 {patient.name}의 변화</div>
                  <ul className="preview-list">
                    {report.changes.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </section>
              )}

              <section>
                <div className="preview-box-title">{patient.name}의 상태예요</div>
                {report.states.length > 0 ? (
                  <ul className="preview-list">
                    {report.states.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                ) : (
                  <p className="muted" style={{ fontSize: ".88rem", margin: "6px 0 0" }}>
                    담당의 코멘트가 비어 있습니다. 이대로는 보낼 수 없습니다.
                  </p>
                )}
              </section>

              {report.notice && (
                <section>
                  <div className="preview-box-title">추가 안내 사항이에요</div>
                  <p style={{ margin: "6px 0 0", fontSize: ".92rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {report.notice}
                  </p>
                </section>
              )}

              <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
                진료 원문과 처방 상세는 보호자에게 나가지 않습니다. 사진·검사 목록은 보호자 앱에서 함께 보입니다.
              </p>
            </div>

            <div className="preview-foot">
              <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
                수정
              </button>
              <button name="send" value="1" className="btn btn-primary" disabled={report.states.length === 0}>
                {alreadySent ? "다시 보내기" : "전송"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
