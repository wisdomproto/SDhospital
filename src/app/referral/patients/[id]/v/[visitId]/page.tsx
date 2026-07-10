import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { DataTable } from "@/components/DataTable";
import { MediaGrid, type SignedFile } from "@/app/portal/patients/[id]/MediaGrid";
import Link from "next/link";
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
    .select("id, visit_date, visit_no, note")
    .eq("id", visitId)
    .single();
  if (!v) notFound();

  const [{ data: rxs }, { data: images }, { data: media }] = await Promise.all([
    supabase.from("prescription").select("dose, frequency, duration, drug:drug_id(name)").eq("visit_id", visitId),
    supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("visit_id", visitId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
  ]);
  const imageLinks = await signAll((images as Omit<SignedFile, "url">[]) ?? []);
  const mediaLinks = await signAll((media as Omit<SignedFile, "url">[]) ?? []);

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1000 }}>
      <div>
        <Link href={`/referral/patients/${patientId}`} className="link-btn" style={{ fontSize: ".82rem" }}>← 환자 개요</Link>
        <p className="eyebrow" style={{ marginTop: 10 }}>진료 회차</p>
        <h1 className="page-title">
          {v.visit_date} {v.visit_no != null ? `· ${v.visit_no}회차` : ""}
        </h1>
      </div>

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
