import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/Sparkline";
import Link from "next/link";

function daysSince(iso: string): number {
  const start = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(1, Math.ceil((now - start) / 86_400_000));
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function relLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const petEmoji = (species: string | null) => (species === "고양이" ? "🐱" : "🐶");

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, patients, visits, admittedCount, invitesRes, recentAdm, recentVisits] =
    await Promise.all([
      supabase.from("profile").select("name").eq("id", user?.id ?? "").single(),
      supabase.from("patient").select("id", { count: "exact", head: true }),
      supabase.from("visit").select("id", { count: "exact", head: true }),
      supabase.from("admission").select("id", { count: "exact", head: true }).eq("status", "admitted"),
      supabase.from("invite").select("role").eq("used", false),
      supabase
        .from("admission")
        .select("id, admitted_at, patient:patient_id(id, name, species)")
        .eq("status", "admitted")
        .order("admitted_at", { ascending: false })
        .limit(5),
      supabase
        .from("visit")
        .select("id, visit_no, note, patient:patient_id(id, name)")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const staffName = profileRes.data?.name ?? "선생님";
  const invites = invitesRes.data ?? [];
  const ownerInvites = invites.filter((i) => i.role === "owner").length;
  const vetInvites = invites.filter((i) => i.role === "referring_vet").length;
  const admissions = (recentAdm.data ?? []) as unknown as {
    id: string;
    admitted_at: string;
    patient: { id: string; name: string; species: string | null } | null;
  }[];

  // recent vitals per admitted patient → sparkline of heart_rate (fallback temperature)
  const admIds = admissions.map((a) => a.id);
  const vitalsByAdm = new Map<string, { measured_at: string; heart_rate: number | null; temperature: number | null }[]>();
  if (admIds.length) {
    const { data: vitals } = await supabase
      .from("vital")
      .select("admission_id, measured_at, heart_rate, temperature")
      .in("admission_id", admIds)
      .order("measured_at", { ascending: true });
    for (const v of vitals ?? []) {
      const arr = vitalsByAdm.get(v.admission_id) ?? [];
      arr.push(v);
      vitalsByAdm.set(v.admission_id, arr);
    }
  }

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const recentVisitRows = (recentVisits.data ?? []) as unknown as {
    id: string;
    visit_no: number | null;
    note: string | null;
    patient: { id: string; name: string } | null;
  }[];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 className="page-title">안녕하세요, {staffName} 선생님</h1>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>
          {today} · 오늘도 좋은 진료 되세요
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <div className="kpi-card">
          <div className="kpi-label">등록 환자</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span className="kpi-value">{patients.count ?? 0}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">진료 회차</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span className="kpi-value">{visits.count ?? 0}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">현재 입원</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span className="kpi-value">{admittedCount.count ?? 0}</span>
            <span className="kpi-delta" style={{ color: "var(--warning)" }}>입원 관리</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">가입 대기 초대</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span className="kpi-value">{invites.length}</span>
            <span className="kpi-delta" style={{ color: "var(--muted-2)" }}>미가입</span>
          </div>
        </div>
      </div>

      {/* main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16 }}>
        {/* admitted + sparklines */}
        <div className="card" style={{ borderRadius: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <h2 className="section-title">현재 입원 · 바이털</h2>
            <Link href="/patients" className="link-btn" style={{ fontSize: ".8rem" }}>
              전체 →
            </Link>
          </div>
          {admissions.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 10 }}>입원 중인 환자가 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              <div className="spark-row head">
                <span>환자</span>
                <span>바이털 추이</span>
                <span>마지막 체크</span>
                <span />
              </div>
              {admissions.map((a) => {
                const vs = vitalsByAdm.get(a.id) ?? [];
                const hr = vs.map((v) => v.heart_rate).filter((n): n is number => n != null);
                const series = hr.length >= 2 ? hr : vs.map((v) => v.temperature).filter((n): n is number => n != null);
                const last = vs.length ? vs[vs.length - 1].measured_at : null;
                const pt = a.patient;
                return (
                  <div key={a.id} className="spark-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span className="avatar-chip" style={{ width: 32, height: 32, fontSize: 16 }}>
                        {petEmoji(pt?.species ?? null)}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: ".85rem" }}>{pt?.name ?? "-"}</div>
                        <div style={{ fontSize: ".7rem", color: "var(--muted-2)" }}>입원 {daysSince(a.admitted_at)}일차</div>
                      </div>
                    </div>
                    <Sparkline values={series} />
                    <span style={{ fontSize: ".78rem", color: "#5f7183" }}>{last ? timeLabel(last) : "—"}</span>
                    {pt ? (
                      <Link href={`/patients/${pt.id}/a/${a.id}`} className="link-btn" style={{ fontSize: ".78rem" }}>
                        열기
                      </Link>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* recent visits + invites */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="card" style={{ borderRadius: 16 }}>
            <h2 className="section-title" style={{ marginBottom: 12 }}>최근 진료 회차</h2>
            {recentVisitRows.length === 0 ? (
              <div className="empty-state">최근 회차가 없습니다.</div>
            ) : (
              <div style={{ display: "grid", gap: 11 }}>
                {recentVisitRows.map((v) => (
                  <div key={v.id} style={{ display: "flex", gap: 11, alignItems: "center" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ".85rem", fontWeight: 600 }}>
                        {v.patient?.name ?? "-"} · {v.visit_no ?? "-"}회차
                      </div>
                      <div style={{ fontSize: ".72rem", color: "var(--muted-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.note || "기록"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card" style={{ borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 className="section-title">공유 · 초대</h2>
              <Link href="/owners" className="link-btn" style={{ fontSize: ".8rem" }}>관리 →</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: ".83rem", color: "var(--ink-2)" }}>보호자 가입 대기</span>
              <span className="pill success">{ownerInvites}건</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--line-soft)" }}>
              <span style={{ fontSize: ".83rem", color: "var(--ink-2)" }}>의뢰 병원 가입 대기</span>
              <span className="pill muted">{vetInvites}건</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
