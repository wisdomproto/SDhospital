import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { VitalChart } from "@/components/VitalChart";
import { MediaGrid, type SignedFile } from "../../MediaGrid";
import Link from "next/link";
import { notFound } from "next/navigation";

async function signAll(rows: Omit<SignedFile, "url">[]): Promise<SignedFile[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
}

export default async function PortalAdmissionDetail({
  params,
}: {
  params: Promise<{ id: string; admissionId: string }>;
}) {
  const { id, admissionId } = await params;
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
      .select("measured_at, temperature, heart_rate, resp_rate, systolic, diastolic")
      .eq("admission_id", admissionId)
      .order("measured_at", { ascending: true }),
    supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("admission_id", admissionId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("admission_id", admissionId),
  ]);
  const imageLinks = await signAll((images as Omit<SignedFile, "url">[]) ?? []);
  const mediaLinks = await signAll((media as Omit<SignedFile, "url">[]) ?? []);

  return (
    <>
      <Link href={`/portal/patients/${id}/admissions`} className="portal-tile-sub" style={{ textDecoration: "none" }}>← 입원 목록</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: "1.25rem", fontWeight: 900 }}>입원 {a.admitted_at}</div>
          <div className="portal-tile-sub">
            {a.status === "admitted" ? "입원중" : `퇴원 ${a.discharged_at ?? ""}`}
          </div>
        </div>
        <span className={`pill ${a.status === "admitted" ? "warning" : "success"}`} style={{ marginLeft: "auto" }}>
          {a.status === "admitted" ? "입원중" : "퇴원"}
        </span>
      </div>

      {a.note && (
        <div className="portal-card">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>경과 메모</div>
          <p style={{ margin: 0, fontSize: ".88rem", whiteSpace: "pre-wrap", color: "#33465e" }}>{a.note}</p>
        </div>
      )}

      {(vitals ?? []).length > 0 && (
        <div className="portal-card">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>바이털 추이</div>
          <VitalChart data={vitals ?? []} />
        </div>
      )}

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>의료영상</div>
        <MediaGrid files={imageLinks} />
      </div>

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>사진 / 영상</div>
        <MediaGrid files={mediaLinks} />
      </div>
    </>
  );
}
