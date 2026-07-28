import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { DataTable } from "@/components/DataTable";
import { MediaGrid, type SignedFile } from "@/app/portal/patients/[id]/MediaGrid";
import { notFound } from "next/navigation";

async function signAll(rows: Omit<SignedFile, "url">[]): Promise<SignedFile[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
}

export default async function ReferralVisitDetail({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id: patientId, visitId } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note, report_comment, report_sent_at, referral_note, referred_back_at")
    .eq("id", visitId)
    .single();
  if (!v) notFound();

  // 열람 기록 — 1차병원에 기록을 열어주는 조건이다.
  await supabase.rpc("log_access", { p_patient_id: patientId, p_target: "visit", p_target_id: visitId });

  const [{ data: rxs }, { data: images }, { data: media }] = await Promise.all([
    supabase.from("prescription").select("dose, frequency, duration, drug:drug_id(name)").eq("visit_id", visitId),
    supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("visit_id", visitId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
  ]);
  const imageLinks = await signAll((images as Omit<SignedFile, "url">[]) ?? []);
  const mediaLinks = await signAll((media as Omit<SignedFile, "url">[]) ?? []);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">진료 회차</p>
        <h1 className="page-title">
          {v.visit_date} {v.visit_no != null ? `· ${v.visit_no}회차` : ""}
        </h1>
      </div>

      {v.referred_back_at && v.referral_note && (
        <div className="card" style={{ borderLeft: "4px solid var(--success, #2e9e6b)" }}>
          <div className="card-head">
            <h2 className="section-title">환송 소견서</h2>
            <span className="pill success">{new Date(v.referred_back_at).toLocaleDateString("ko-KR")} 환송</span>
          </div>
          <p style={{ margin: 0, fontSize: ".95rem", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
            {v.referral_note}
          </p>
        </div>
      )}

      {v.report_sent_at && v.report_comment && (
        <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div className="card-head">
            <h2 className="section-title">보호자에게 안내된 내용</h2>
            <span className="pill muted">{new Date(v.report_sent_at).toLocaleDateString("ko-KR")}</span>
          </div>
          <p style={{ margin: 0, fontSize: ".92rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {v.report_comment}
          </p>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2 className="section-title">진료 내용</h2></div>
        <p style={{ margin: 0, fontSize: ".92rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--ink-2)" }}>
          {v.note || "기록 없음"}
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">처방</h2>
          <span className="pill muted">{(rxs ?? []).length}건</span>
        </div>
        <DataTable
          headers={["약품", "용량", "용법", "기간"]}
          empty="처방이 없습니다."
          rows={(rxs ?? []).map((r) => [
            <span key="d" style={{ fontWeight: 600 }}>{(r.drug as unknown as { name: string } | null)?.name ?? "-"}</span>,
            r.dose ?? "-",
            r.frequency ?? "-",
            r.duration ?? "-",
          ])}
        />
      </div>

      <div className="quickadd-grid">
        <div className="card">
          <div className="card-head"><h2 className="section-title">의료영상</h2></div>
          <MediaGrid files={imageLinks} />
        </div>
        <div className="card">
          <div className="card-head"><h2 className="section-title">사진 / 영상</h2></div>
          <MediaGrid files={mediaLinks} />
        </div>
      </div>
    </div>
  );
}
