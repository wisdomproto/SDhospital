import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PortalAdmissions({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: admissions } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status")
    .eq("patient_id", id)
    .order("admitted_at", { ascending: false });

  return (
    <>
      <div style={{ fontWeight: 800, fontSize: "1.05rem", padding: "2px 2px 4px" }}>입원</div>
      {(admissions ?? []).length === 0 && <div className="empty-state">입원 기록이 없습니다.</div>}
      {(admissions ?? []).map((a) => (
        <Link key={a.id} href={`/portal/patients/${id}/admissions/${a.id}`} className="portal-tile" style={{ alignItems: "flex-start" }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: "var(--surface-soft)", fontSize: 20, flexShrink: 0 }}>
            🏥
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="portal-tile-title">{a.admitted_at}</div>
            <div className="portal-tile-sub">
              {a.status === "admitted" ? "입원중" : `퇴원 ${a.discharged_at ?? ""}`}
            </div>
          </div>
          <span className={`pill ${a.status === "admitted" ? "warning" : "success"}`}>
            {a.status === "admitted" ? "입원중" : "퇴원"}
          </span>
        </Link>
      ))}
    </>
  );
}
