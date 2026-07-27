import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateVisit, updatePrescription, deletePrescription, deleteFile, saveVisitReport, toggleVisitClosed } from "./actions";
import { PrescriptionForm } from "./PrescriptionForm";
import { ImageUpload, MediaUpload } from "./FileUpload";
import { createAdmission } from "../../admissions/actions";
import { DataTable } from "@/components/DataTable";
import { signedUrl } from "@/lib/storage";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function VisitDetail({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id: patientId, visitId } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note, closed_at, report_comment, report_sent_at, report_read_at")
    .eq("id", visitId)
    .single();
  if (!v) notFound();

  const [{ data: drugs }, { data: rxs }, { data: images }, { data: mediaRows }, { data: admissions }] =
    await Promise.all([
      supabase.from("drug").select("id, name").order("name"),
      supabase
        .from("prescription")
        .select("id, drug_id, dose, frequency, duration")
        .eq("visit_id", visitId),
      supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("visit_id", visitId),
      supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
      supabase
        .from("admission")
        .select("id, admitted_at, discharged_at, status")
        .eq("visit_id", visitId)
        .order("admitted_at", { ascending: false }),
    ]);

  const drugList = drugs ?? [];
  const admissionList = admissions ?? [];
  const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
  const imageLinks = await Promise.all(
    (images ?? []).map(async (i) => ({ ...i, url: await signedUrl(i.storage_path) }))
  );
  const mediaLinks = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({ ...m, url: await signedUrl(m.storage_path) }))
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">진료 회차</p>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {v.visit_date} {v.visit_no != null ? `· ${v.visit_no}회차` : ""}
            {v.closed_at ? (
              <span className="pill success">진료 종료</span>
            ) : (
              <span className="pill warning">진료 중</span>
            )}
          </h1>
        </div>
        <form action={toggleVisitClosed.bind(null, patientId, v.id, !v.closed_at)}>
          <button className={v.closed_at ? "btn btn-ghost btn-sm" : "btn btn-secondary btn-sm"}>
            {v.closed_at ? "진료 중으로 되돌리기" : "진료 종료"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">회차 정보</h2></div>
        <form action={updateVisit.bind(null, patientId, v.id)} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="날짜">
              <input type="date" name="visit_date" defaultValue={v.visit_date} className={inputClass} />
            </FormField>
            <FormField label="회차">
              <input name="visit_no" inputMode="numeric" defaultValue={v.visit_no ?? ""} className={inputClass} />
            </FormField>
          </div>
          <FormField label="진료 내용">
            <textarea name="note" rows={6} defaultValue={v.note ?? ""} className={inputClass} />
          </FormField>
          <div><SubmitButton>저장</SubmitButton></div>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">보호자 리포트</h2>
          {v.report_sent_at ? (
            v.report_read_at ? (
              <span className="pill success">읽음 · {fmt(v.report_read_at)}</span>
            ) : (
              <span className="pill">발송됨 · {fmt(v.report_sent_at)}</span>
            )
          ) : (
            <span className="pill warning">미발송</span>
          )}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          진단·처방·영상은 이 회차 내용에서 자동으로 조립됩니다. 코멘트 한 줄만 적어주세요.
        </p>
        <form action={saveVisitReport.bind(null, patientId, v.id)} style={{ display: "grid", gap: 12 }}>
          <FormField label="담당의 코멘트">
            <textarea
              name="comment"
              rows={3}
              defaultValue={v.report_comment ?? ""}
              placeholder="예) 오늘 촬영 결과 슬개골 3기입니다. 다음 주 수술 상담 예정이며 당분간 계단은 피해주세요."
              className={inputClass}
            />
          </FormField>
          <div style={{ display: "flex", gap: 8 }}>
            <SubmitButton>임시 저장</SubmitButton>
            <button name="send" value="1" className="btn btn-primary">
              {v.report_sent_at ? "다시 보내기" : "보호자에게 보내기"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">입원</h2>
          <span className="pill muted">{admissionList.length}건</span>
        </div>
        <DataTable
          headers={["입원일", "퇴원일", "상태", ""]}
          empty="이 회차에 입원 기록이 없습니다."
          rows={admissionList.map((a) => [
            a.admitted_at,
            a.discharged_at ?? "-",
            a.status === "admitted" ? (
              <span key="s" className="pill warning">입원중</span>
            ) : (
              <span key="s" className="pill success">퇴원</span>
            ),
            <Link key="o" href={`/patients/${patientId}/a/${a.id}`} className="link-btn">열기 →</Link>,
          ])}
        />
        <details style={{ marginTop: 12 }}>
          <summary><span className="btn btn-secondary btn-sm">+ 입원 시작</span></summary>
          <form
            action={createAdmission.bind(null, patientId, v.id)}
            style={{ display: "grid", gap: 12, maxWidth: 460, marginTop: 12 }}
          >
            <FormField label="입원일"><input type="date" name="admitted_at" className={inputClass} /></FormField>
            <FormField label="비고"><input name="note" className={inputClass} /></FormField>
            <SubmitButton>입원 시작</SubmitButton>
          </form>
        </details>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">처방</h2>
          <span className="pill muted">{(rxs ?? []).length}건</span>
        </div>
        {(rxs ?? []).length === 0 ? (
          <div className="empty-state">처방이 없습니다.</div>
        ) : (
          <div>
            <div className="row-head rx-row" style={{ borderBottom: "1px solid var(--line)" }}>
              <span>약품</span><span>용량</span><span>용법</span><span>기간</span><span></span><span></span>
            </div>
            {(rxs ?? []).map((r) => (
              <form key={r.id} action={updatePrescription.bind(null, patientId, v.id, r.id)} className="rx-row">
                <select name="drug_id" defaultValue={r.drug_id} className={inputClass}>
                  {drugList.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <input name="dose" defaultValue={r.dose ?? ""} placeholder="용량" className={inputClass} />
                <input name="frequency" defaultValue={r.frequency ?? ""} placeholder="용법" className={inputClass} />
                <input name="duration" defaultValue={r.duration ?? ""} placeholder="기간" className={inputClass} />
                <button className="btn btn-secondary btn-sm">저장</button>
                <button formAction={deletePrescription.bind(null, patientId, v.id, r.id)} className="btn btn-danger btn-sm">삭제</button>
              </form>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: ".85rem", color: "var(--muted)" }}>처방 추가</p>
          <PrescriptionForm patientId={patientId} visitId={v.id} drugs={drugList} />
        </div>
      </div>

      <div className="quickadd-grid">
        <div className="card">
          <div className="card-head"><h2 className="section-title">의료영상</h2></div>
          <ul style={{ display: "grid", gap: 6, fontSize: ".9rem", listStyle: "none", padding: 0, margin: 0 }}>
            {imageLinks.map((i) => (
              <li key={i.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="pill muted" style={{ textTransform: "uppercase" }}>{i.modality}</span>
                {i.url ? <a href={i.url} target="_blank" className="link-btn">{i.file_name}</a> : i.file_name}
                <form action={deleteFile.bind(null, patientId, v.id, "medical_image", i.id, i.storage_path)}>
                  <button className="link-btn danger">삭제</button>
                </form>
              </li>
            ))}
            {imageLinks.length === 0 && <li style={{ color: "var(--muted)" }}>없음</li>}
          </ul>
          <ImageUpload patientId={patientId} visitId={v.id} />
        </div>

        <div className="card">
          <div className="card-head"><h2 className="section-title">사진 / 영상</h2></div>
          <ul style={{ display: "grid", gap: 6, fontSize: ".9rem", listStyle: "none", padding: 0, margin: 0 }}>
            {mediaLinks.map((m) => (
              <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--muted)" }}>{m.kind ?? "-"}</span>
                {m.url ? <a href={m.url} target="_blank" className="link-btn">{m.file_name}</a> : m.file_name}
                <form action={deleteFile.bind(null, patientId, v.id, "media", m.id, m.storage_path)}>
                  <button className="link-btn danger">삭제</button>
                </form>
              </li>
            ))}
            {mediaLinks.length === 0 && <li style={{ color: "var(--muted)" }}>없음</li>}
          </ul>
          <MediaUpload patientId={patientId} visitId={v.id} />
        </div>
      </div>
    </div>
  );
}
