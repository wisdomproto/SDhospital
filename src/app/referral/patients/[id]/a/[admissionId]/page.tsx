import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { VitalChart } from "@/components/VitalChart";
import { DataTable } from "@/components/DataTable";
import { MediaGrid, type SignedFile } from "@/app/portal/patients/[id]/MediaGrid";
import { notFound } from "next/navigation";

async function signAll(rows: Omit<SignedFile, "url">[]): Promise<SignedFile[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
}

function fmt(iso: string) {
  // 2026-06-24T09:00:00+09:00 → 06-24 09:00
  const d = iso.replace("T", " ");
  return d.length >= 16 ? d.slice(5, 16) : iso;
}

export default async function ReferralAdmissionDetail({
  params,
}: {
  params: Promise<{ id: string; admissionId: string }>;
}) {
  const { admissionId } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status, note")
    .eq("id", admissionId)
    .single();
  if (!a) notFound();

  const [{ data: vitals }, { data: images }, { data: media }] = await Promise.all([
    supabase
      .from("vital")
      .select("measured_at, temperature, heart_rate, resp_rate, systolic, diastolic, glucose, weight")
      .eq("admission_id", admissionId)
      .order("measured_at", { ascending: true }),
    supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("admission_id", admissionId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("admission_id", admissionId),
  ]);
  const imageLinks = await signAll((images as Omit<SignedFile, "url">[]) ?? []);
  const mediaLinks = await signAll((media as Omit<SignedFile, "url">[]) ?? []);
  const vlist = vitals ?? [];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">입원</p>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          입원 {a.admitted_at}
          <span className={`pill ${a.status === "admitted" ? "warning" : "success"}`}>
            {a.status === "admitted" ? "입원중" : "퇴원"}
          </span>
        </h1>
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">입원 정보</h2></div>
        <div className="info-grid">
          <div className="info-row"><span className="k">입원일</span><span className="v">{a.admitted_at}</span></div>
          <div className="info-row"><span className="k">퇴원일</span><span className="v">{a.discharged_at ?? "-"}</span></div>
          <div className="info-row"><span className="k">상태</span><span className="v">{a.status === "admitted" ? "입원중" : "퇴원"}</span></div>
        </div>
        {a.note && (
          <p style={{ marginTop: 12, fontSize: ".9rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--muted)" }}>{a.note}</p>
        )}
      </div>

      {vlist.length > 0 && (
        <div className="card">
          <div className="card-head"><h2 className="section-title">바이털 추이</h2></div>
          <VitalChart data={vlist} />
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">바이털 기록</h2>
          <span className="pill muted">{vlist.length}건</span>
        </div>
        <DataTable
          headers={["시각", "체온", "심박", "호흡", "수축기", "이완기", "혈당", "체중"]}
          empty="바이털 기록이 없습니다."
          rows={vlist.map((v) => [
            <span key="t" style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{fmt(v.measured_at)}</span>,
            v.temperature ?? "-",
            v.heart_rate ?? "-",
            v.resp_rate ?? "-",
            v.systolic ?? "-",
            v.diastolic ?? "-",
            v.glucose ?? "-",
            v.weight ?? "-",
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
