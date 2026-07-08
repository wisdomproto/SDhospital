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
    .select("id, visit_date, visit_no, note")
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
            <div className="portal-tile-title">{v.visit_date}</div>
            <div className="portal-tile-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {(v.note ?? "").split("\n")[0] || "내용 없음"}
            </div>
          </div>
          <span style={{ color: "var(--muted)", fontSize: "1.2rem" }}>›</span>
        </Link>
      ))}
    </>
  );
}
