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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(255,255,255,.22)", fontSize: 28 }}>
            {p.species === "고양이" ? "🐱" : "🐶"}
          </span>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 900 }}>{p.name}</div>
            <div style={{ fontSize: ".85rem", opacity: 0.92 }}>
              {[p.species, p.breed].filter(Boolean).join(" / ") || "-"}
              {p.sex ? ` · ${p.sex}` : ""}
            </div>
          </div>
        </div>
        {openAdm && (
          <div style={{ marginTop: 12, display: "inline-block", background: "rgba(255,255,255,.2)", padding: "5px 11px", borderRadius: 999, fontSize: ".78rem", fontWeight: 800 }}>
            현재 입원중
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Link href={`/portal/patients/${p.id}/visits`} className="portal-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: "var(--primary)" }}>{visitCount ?? 0}</div>
          <div className="portal-tile-sub">진료 회차 →</div>
        </Link>
        <Link href={`/portal/patients/${p.id}/admissions`} className="portal-card" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: "1.7rem", fontWeight: 900, color: "var(--warning)" }}>{admCount ?? 0}</div>
          <div className="portal-tile-sub">입원 →</div>
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
