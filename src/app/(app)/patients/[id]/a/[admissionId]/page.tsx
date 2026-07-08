import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import {
  discharge,
  reopenAdmission,
  updateAdmission,
  addVital,
  updateVital,
  deleteVital,
  deleteAdmFile,
} from "./actions";
import { AdmImageUpload, AdmMediaUpload } from "./FileUpload";
import { VitalChart } from "@/components/VitalChart";
import { signedUrl } from "@/lib/storage";
import { notFound } from "next/navigation";

export default async function AdmissionDetail({
  params,
}: {
  params: Promise<{ id: string; admissionId: string }>;
}) {
  const { id: patientId, admissionId } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status, note")
    .eq("id", admissionId)
    .single();
  if (!a) notFound();

  const [{ data: vitals }, { data: images }, { data: mediaRows }] = await Promise.all([
    supabase
      .from("vital")
      .select("id, measured_at, temperature, heart_rate, resp_rate, systolic, diastolic")
      .eq("admission_id", admissionId)
      .order("measured_at", { ascending: true }),
    supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("admission_id", admissionId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("admission_id", admissionId),
  ]);

  const imageLinks = await Promise.all(
    (images ?? []).map(async (i) => ({ ...i, url: await signedUrl(i.storage_path) }))
  );
  const mediaLinks = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({ ...m, url: await signedUrl(m.storage_path) }))
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">입원</p>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {a.admitted_at}
            {a.status === "admitted" ? (
              <span className="pill warning">입원중</span>
            ) : (
              <span className="pill success">퇴원 {a.discharged_at ?? ""}</span>
            )}
          </h1>
        </div>
        {a.status === "admitted" ? (
          <form action={discharge.bind(null, patientId, a.id)} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <label className="field-label" style={{ marginBottom: 0 }}>
              퇴원일
              <input type="date" name="discharged_at" className={inputClass} style={{ marginTop: 6, width: 160 }} />
            </label>
            <SubmitButton>퇴원 처리</SubmitButton>
          </form>
        ) : (
          <form action={reopenAdmission.bind(null, patientId, a.id)}>
            <button className="btn btn-ghost btn-sm">입원중으로 되돌리기</button>
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">입원 정보 · 메모</h2></div>
        <form action={updateAdmission.bind(null, patientId, a.id)} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <FormField label="입원일">
            <input type="date" name="admitted_at" defaultValue={a.admitted_at} className={inputClass} style={{ maxWidth: 200 }} />
          </FormField>
          <FormField label="메모 (경과·간호 기록)">
            <textarea name="note" rows={6} defaultValue={a.note ?? ""} className={inputClass} />
          </FormField>
          <div><SubmitButton>저장</SubmitButton></div>
        </form>
      </div>

      {(vitals ?? []).length > 0 && (
        <div className="card">
          <div className="card-head"><h2 className="section-title">바이털 추이</h2></div>
          <VitalChart
            data={(vitals ?? []).map((v) => ({
              measured_at: v.measured_at,
              temperature: v.temperature,
              heart_rate: v.heart_rate,
              resp_rate: v.resp_rate,
              systolic: v.systolic,
              diastolic: v.diastolic,
            }))}
          />
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">바이털 기록</h2>
          <span className="pill muted">{(vitals ?? []).length}건</span>
        </div>

        {(vitals ?? []).length === 0 ? (
          <div className="empty-state">측정 기록이 없습니다.</div>
        ) : (
          <div>
            <div className="row-head vital-row">
              <span>측정시각</span><span>체온</span><span>심박</span><span>호흡</span><span>수축기</span><span>이완기</span><span></span><span></span>
            </div>
            {[...(vitals ?? [])].reverse().map((v) => (
              <form key={v.id} action={updateVital.bind(null, patientId, a.id, v.id)} className="vital-row">
                <span style={{ fontSize: ".82rem", color: "var(--muted)" }}>
                  {new Date(v.measured_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <input name="temperature" defaultValue={v.temperature ?? ""} className={inputClass} />
                <input name="heart_rate" defaultValue={v.heart_rate ?? ""} className={inputClass} />
                <input name="resp_rate" defaultValue={v.resp_rate ?? ""} className={inputClass} />
                <input name="systolic" defaultValue={v.systolic ?? ""} className={inputClass} />
                <input name="diastolic" defaultValue={v.diastolic ?? ""} className={inputClass} />
                <button className="btn btn-secondary btn-sm">저장</button>
                <button formAction={deleteVital.bind(null, patientId, a.id, v.id)} className="btn btn-danger btn-sm">삭제</button>
              </form>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: ".85rem", color: "var(--muted)" }}>바이털 추가</p>
          <form action={addVital.bind(null, patientId, a.id)} className="vital-form">
            <FormField label="측정시각"><input type="datetime-local" name="measured_at" className={inputClass} /></FormField>
            <FormField label="체온"><input name="temperature" inputMode="decimal" className={inputClass} /></FormField>
            <FormField label="심박"><input name="heart_rate" inputMode="numeric" className={inputClass} /></FormField>
            <FormField label="호흡"><input name="resp_rate" inputMode="numeric" className={inputClass} /></FormField>
            <FormField label="수축기"><input name="systolic" inputMode="numeric" className={inputClass} /></FormField>
            <FormField label="이완기"><input name="diastolic" inputMode="numeric" className={inputClass} /></FormField>
            <div style={{ gridColumn: "1 / -1" }}><SubmitButton>바이털 추가</SubmitButton></div>
          </form>
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
                <form action={deleteAdmFile.bind(null, patientId, a.id, "medical_image", i.id, i.storage_path)}>
                  <button className="link-btn danger">삭제</button>
                </form>
              </li>
            ))}
            {imageLinks.length === 0 && <li style={{ color: "var(--muted)" }}>없음</li>}
          </ul>
          <AdmImageUpload patientId={patientId} admissionId={a.id} />
        </div>

        <div className="card">
          <div className="card-head"><h2 className="section-title">사진 / 영상</h2></div>
          <ul style={{ display: "grid", gap: 6, fontSize: ".9rem", listStyle: "none", padding: 0, margin: 0 }}>
            {mediaLinks.map((m) => (
              <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--muted)" }}>{m.kind ?? "-"}</span>
                {m.url ? <a href={m.url} target="_blank" className="link-btn">{m.file_name}</a> : m.file_name}
                <form action={deleteAdmFile.bind(null, patientId, a.id, "media", m.id, m.storage_path)}>
                  <button className="link-btn danger">삭제</button>
                </form>
              </li>
            ))}
            {mediaLinks.length === 0 && <li style={{ color: "var(--muted)" }}>없음</li>}
          </ul>
          <AdmMediaUpload patientId={patientId} admissionId={a.id} />
        </div>
      </div>
    </div>
  );
}
