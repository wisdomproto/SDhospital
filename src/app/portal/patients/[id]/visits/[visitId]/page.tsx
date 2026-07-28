import { createClient } from "@/lib/supabase/server";
import { signedUrl, signMedicalImages } from "@/lib/storage";
import { MediaGrid, type SignedFile } from "../../MediaGrid";
import Link from "next/link";
import { notFound } from "next/navigation";

async function signAll(rows: Omit<SignedFile, "url">[]): Promise<SignedFile[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
}

export default async function PortalVisitDetail({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id, visitId } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note, report_comment, report_sent_at")
    .eq("id", visitId)
    .single();
  if (!v) notFound();

  // 열람 표시 — 보호자는 visit 에 쓰기 권한이 없으므로 DEFINER 함수로만 기록한다.
  // 최초 1회만 기록되고, 실패해도 화면은 그대로 보여준다.
  if (v.report_sent_at) await supabase.rpc("mark_visit_report_read", { p_visit_id: visitId });

  const [{ data: images }, { data: media }] = await Promise.all([
    supabase.from("medical_image").select("id, modality, file_name, storage_path, preview_path").eq("visit_id", visitId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
  ]);
  const imageLinks = await signMedicalImages(images ?? []);
  // 보호자에게는 "무슨 검사를 했는지"만 보여준다.
  // 약품·용량 같은 처방 상세는 분쟁 소지가 있어 내보내지 않는다.
  const MODALITY_KO: Record<string, string> = { xray: "X-ray", ct: "CT", mri: "MRI", other: "영상 검사" };
  const examSummary = Object.entries(
    (images ?? []).reduce<Record<string, number>>((acc, i) => {
      const k = MODALITY_KO[i.modality ?? "other"] ?? "영상 검사";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([k, n]) => `${k} ${n}건`);
  const mediaLinks = await signAll((media as Omit<SignedFile, "url">[]) ?? []);

  return (
    <>
      <Link href={`/portal/patients/${id}/visits`} className="portal-tile-sub" style={{ textDecoration: "none" }}>← 진료 목록</Link>
      <div>
        <div style={{ fontSize: "1.25rem", fontWeight: 900 }}>{v.visit_date}</div>
        <div className="portal-tile-sub">{v.visit_no != null ? `${v.visit_no}회차` : ""}</div>
      </div>

      {v.report_sent_at && v.report_comment && (
        <div className="portal-card" style={{ borderLeft: "4px solid var(--brand, #2f7d6a)" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>담당의 코멘트</div>
          <p style={{ margin: 0, fontSize: ".95rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {v.report_comment}
          </p>
          <Link
            href={`/portal/patients/${id}/visits/${visitId}/summary`}
            style={{ display: "inline-block", marginTop: 12, fontWeight: 700, fontSize: ".88rem" }}
          >
            전체 리포트 보기 · PDF 저장 →
          </Link>
        </div>
      )}

      {examSummary.length > 0 && (
        <div className="portal-card">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>진행한 검사</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {examSummary.map((e) => (
              <span key={e} className="pill muted">{e}</span>
            ))}
          </div>
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
