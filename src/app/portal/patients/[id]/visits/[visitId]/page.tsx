import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
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

  const [{ data: rxs }, { data: images }, { data: media }] = await Promise.all([
    supabase.from("prescription").select("dose, frequency, duration, drug:drug_id(name)").eq("visit_id", visitId),
    supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("visit_id", visitId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
  ]);
  const imageLinks = await signAll((images as Omit<SignedFile, "url">[]) ?? []);
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
        </div>
      )}

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>진료 내용</div>
        <p style={{ margin: 0, fontSize: ".9rem", whiteSpace: "pre-wrap", color: "#33465e" }}>
          {v.note || "기록 없음"}
        </p>
      </div>

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>처방 · {(rxs ?? []).length}건</div>
        {(rxs ?? []).length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: 0 }}>처방 없음</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {(rxs ?? []).map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: ".88rem", borderBottom: i < (rxs ?? []).length - 1 ? "1px solid var(--line)" : 0, paddingBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{(r.drug as unknown as { name: string } | null)?.name ?? "-"}</span>
                <span style={{ color: "var(--muted)" }}>
                  {[r.dose, r.frequency, r.duration].filter(Boolean).join(" · ") || "-"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

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
