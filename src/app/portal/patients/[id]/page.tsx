import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PortalPatientOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patient")
    .select("id, name, species, breed, sex, birth_date, hospital:referring_hospital_id(name)")
    .eq("id", id)
    .single();
  if (!p) notFound();
  const hospital = p.hospital as unknown as { name: string } | null;

  const [{ count: visitCount }, { count: admCount }, { data: lastVisit }, { data: openAdm }] =
    await Promise.all([
      supabase.from("visit").select("id", { count: "exact", head: true }).eq("patient_id", id),
      supabase.from("admission").select("id", { count: "exact", head: true }).eq("patient_id", id),
      supabase.from("visit").select("visit_date").eq("patient_id", id).order("visit_date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("admission").select("id").eq("patient_id", id).eq("status", "admitted").limit(1).maybeSingle(),
    ]);

  return (
    <>
      <div className="portal-hero">
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 58, height: 58, borderRadius: 20, display: "grid", placeItems: "center", background: "rgba(255,255,255,.24)", fontSize: 32 }}>
            {p.species === "고양이" ? "🐱" : "🐶"}
          </span>
          <div>
            <div style={{ fontSize: "1.55rem", fontWeight: 900, letterSpacing: "-0.01em" }}>{p.name}</div>
            <div style={{ fontSize: ".88rem", opacity: 0.94, marginTop: 2 }}>
              {[p.species, p.breed].filter(Boolean).join(" / ") || "-"}
              {p.sex ? ` · ${p.sex}` : ""}
            </div>
          </div>
        </div>
        {openAdm && (
          <div style={{ position: "relative", zIndex: 1, marginTop: 14, display: "inline-block", background: "rgba(255,255,255,.24)", padding: "6px 13px", borderRadius: 999, fontSize: ".8rem", fontWeight: 800 }}>
            🏥 현재 입원중
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Link href={`/portal/patients/${p.id}/visits`} className="portal-stat" style={{ background: "linear-gradient(140deg,#3b82f6,#2563eb)" }}>
          <div className="num">{visitCount ?? 0}</div>
          <div className="lbl">진료 회차 →</div>
        </Link>
        <Link href={`/portal/patients/${p.id}/admissions`} className="portal-stat" style={{ background: "linear-gradient(140deg,#ff9d5c,#f97316)" }}>
          <div className="num">{admCount ?? 0}</div>
          <div className="lbl">입원 기록 →</div>
        </Link>
      </div>

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>기본 정보</div>
        <div className="info-row"><span className="k">생일</span><span className="v">{p.birth_date ?? "-"}</span></div>
        <div className="info-row" style={{ borderBottom: 0 }}><span className="k">의뢰 병원</span><span className="v">{hospital?.name ?? "-"}</span></div>
        {lastVisit?.visit_date && (
          <p style={{ margin: "10px 0 0", fontSize: ".82rem", color: "var(--muted)" }}>
            최근 진료: {lastVisit.visit_date}
          </p>
        )}
      </div>
    </>
  );
}
