import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateVisit, updatePrescription, deletePrescription, deleteFile } from "./actions";
import { PrescriptionForm } from "./PrescriptionForm";
import { ImageUpload, MediaUpload } from "./FileUpload";
import { signedUrl } from "@/lib/storage";
import { notFound } from "next/navigation";

export default async function VisitDetail({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id: patientId, visitId } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note")
    .eq("id", visitId)
    .single();
  if (!v) notFound();

  const [{ data: drugs }, { data: rxs }, { data: images }, { data: mediaRows }] =
    await Promise.all([
      supabase.from("drug").select("id, name").order("name"),
      supabase
        .from("prescription")
        .select("id, drug_id, dose, frequency, duration")
        .eq("visit_id", visitId),
      supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("visit_id", visitId),
      supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
    ]);

  const drugList = drugs ?? [];
  const imageLinks = await Promise.all(
    (images ?? []).map(async (i) => ({ ...i, url: await signedUrl(i.storage_path) }))
  );
  const mediaLinks = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({ ...m, url: await signedUrl(m.storage_path) }))
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">진료 회차</p>
        <h1 className="page-title">
          {v.visit_date} {v.visit_no != null ? `· ${v.visit_no}회차` : ""}
        </h1>
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
