import { createClient } from "@/lib/supabase/server";
import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { updateVisitNote, deletePrescription, deleteFile } from "./actions";
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
        .select("id, dose, frequency, duration, drug:drug_id(name)")
        .eq("visit_id", visitId),
      supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("visit_id", visitId),
      supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
    ]);

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
        <div className="card-head"><h2 className="section-title">진료 내용</h2></div>
        <form action={updateVisitNote.bind(null, patientId, v.id)} style={{ display: "grid", gap: 10 }}>
          <textarea name="note" rows={6} defaultValue={v.note ?? ""} className={inputClass} />
          <div><SubmitButton>저장</SubmitButton></div>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">처방</h2>
          <span className="pill muted">{(rxs ?? []).length}건</span>
        </div>
        <DataTable
          headers={["약품", "용량", "용법", "기간", ""]}
          empty="처방이 없습니다."
          rows={(rxs ?? []).map((r) => [
            (r.drug as unknown as { name: string })?.name ?? "-",
            r.dose ?? "-",
            r.frequency ?? "-",
            r.duration ?? "-",
            <form key="d" action={deletePrescription.bind(null, patientId, v.id, r.id)}>
              <button className="link-btn danger">삭제</button>
            </form>,
          ])}
        />
        <PrescriptionForm patientId={patientId} visitId={v.id} drugs={drugs ?? []} />
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
