import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PortalVisits({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: visits } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, report_comment, report_sent_at, report_read_at")
    .eq("patient_id", id)
    .order("visit_date", { ascending: false });

  return (
    <>
      <div style={{ fontWeight: 800, fontSize: "1.05rem", padding: "2px 2px 4px" }}>진료 회차</div>
      {(visits ?? []).length === 0 && <div className="empty-state">진료 기록이 없습니다.</div>}
      {(visits ?? []).map((v) => (
        <Link key={v.id} href={`/portal/patients/${id}/visits/${v.id}`} className="portal-tile" style={{ alignItems: "flex-start" }}>
          <span className="portal-chip" style={{ background: "#e8f0ff", color: "var(--primary)", fontWeight: 900, fontSize: ".92rem" }}>
            {v.visit_no != null ? `${v.visit_no}회` : "·"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="portal-tile-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {v.visit_date}
              {v.report_sent_at && v.report_read_at == null && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: ".64rem",
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  새 리포트
                </span>
              )}
            </div>
            <div className="portal-tile-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {/* 담당의 코멘트만 보여준다. 진료 내용 원문은 의료진 기록이라 보호자에게 내보내지 않는다 */}
              {v.report_sent_at ? v.report_comment || "내용 없음" : "리포트 준비 중입니다"}
            </div>
          </div>
          <span style={{ color: "var(--muted)", fontSize: "1.2rem" }}>›</span>
        </Link>
      ))}
    </>
  );
}
