import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card" style={{ display: "grid", gap: 6 }}>
      <span className="metric-label" style={{ color: "var(--muted)", fontWeight: 700, fontSize: ".9rem" }}>
        {label}
      </span>
      <span style={{ fontSize: "2rem", fontWeight: 900, color: accent ?? "var(--text)" }}>{value}</span>
    </div>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const [patients, visits, admitted, drugs, recentAdm] = await Promise.all([
    supabase.from("patient").select("id", { count: "exact", head: true }),
    supabase.from("visit").select("id", { count: "exact", head: true }),
    supabase.from("admission").select("id", { count: "exact", head: true }).eq("status", "admitted"),
    supabase.from("drug").select("id", { count: "exact", head: true }),
    supabase
      .from("admission")
      .select("id, admitted_at, status, patient:patient_id(id, name)")
      .eq("status", "admitted")
      .order("admitted_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div>
        <p className="eyebrow">Dashboard</p>
        <h1 className="page-title">동물병원 EMR</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="등록 환자" value={patients.count ?? 0} accent="var(--primary)" />
        <Metric label="진료 회차" value={visits.count ?? 0} />
        <Metric label="현재 입원" value={admitted.count ?? 0} accent="var(--warning)" />
        <Metric label="등록 약품" value={drugs.count ?? 0} />
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 className="section-title">현재 입원 중</h2>
          <Link href="/patients" className="link-btn">
            환자 전체 →
          </Link>
        </div>
        <DataTable
          headers={["환자", "입원일", "상태", ""]}
          empty="입원 중인 환자가 없습니다."
          rows={(recentAdm.data ?? []).map((a) => {
            const pt = a.patient as unknown as { id: string; name: string } | null;
            return [
              pt?.name ?? "-",
              a.admitted_at,
              <span key="s" className="pill warning">입원중</span>,
              pt ? (
                <Link key="o" href={`/patients/${pt.id}/a/${a.id}`} className="link-btn">
                  열기
                </Link>
              ) : (
                "-"
              ),
            ];
          })}
        />
      </div>
    </div>
  );
}
