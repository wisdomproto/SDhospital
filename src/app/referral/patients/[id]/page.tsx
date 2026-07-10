import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ReferralPatientOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patient")
    .select("id, chart_no, name, species, breed, sex, birth_date, note, hospital:referring_hospital_id(name, contact)")
    .eq("id", id)
    .single();
  if (!p) notFound();
  const hospital = p.hospital as unknown as { name: string; contact: string | null } | null;

  const [{ data: visits }, { data: admissions }] = await Promise.all([
    supabase.from("visit").select("id, visit_date, visit_no, note").eq("patient_id", id).order("visit_date", { ascending: false }),
    supabase.from("admission").select("id, admitted_at, discharged_at, status").eq("patient_id", id).order("admitted_at", { ascending: false }),
  ]);

  const info: [string, string][] = [
    ["종", p.species ?? "-"],
    ["품종", p.breed ?? "-"],
    ["성별", p.sex ?? "-"],
    ["생일", p.birth_date ?? "-"],
    ["의뢰 병원", hospital ? `${hospital.name}${hospital.contact ? ` · ${hospital.contact}` : ""}` : "-"],
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="eyebrow">Patient · 개요{p.chart_no ? ` · 차트 ${p.chart_no}` : ""}</p>
          <h1 className="page-title">{p.name}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <span className="pill">{[p.species, p.breed].filter(Boolean).join(" / ") || "종 미상"}</span>
            {p.sex && <span className="pill muted">{p.sex}</span>}
            {hospital && <span className="pill">의뢰 · {hospital.name}</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">기본 정보</h2></div>
        <div className="info-grid">
          {info.map(([k, v]) => (
            <div key={k} className="info-row">
              <span className="k">{k}</span>
              <span className="v">{v}</span>
            </div>
          ))}
        </div>
        {p.note && <p style={{ marginTop: 12, fontSize: ".9rem", color: "var(--muted)" }}>{p.note}</p>}
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">진료 회차</h2>
          <span className="pill muted">{(visits ?? []).length}건</span>
        </div>
        <DataTable
          headers={["날짜", "회차", "진료 요약", ""]}
          empty="진료 회차가 없습니다."
          rows={(visits ?? []).map((v) => [
            v.visit_date,
            v.visit_no ?? "-",
            (v.note ?? "").slice(0, 40) || "-",
            <Link key="o" href={`/referral/patients/${p.id}/v/${v.id}`} className="link-btn">열기 →</Link>,
          ])}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">입원</h2>
          <span className="pill muted">{(admissions ?? []).length}건</span>
        </div>
        <DataTable
          headers={["입원일", "퇴원일", "상태", ""]}
          empty="입원 이력이 없습니다."
          rows={(admissions ?? []).map((a) => [
            a.admitted_at,
            a.discharged_at ?? "-",
            a.status === "admitted" ? (
              <span key="s" className="pill warning">입원중</span>
            ) : (
              <span key="s" className="pill success">퇴원</span>
            ),
            <Link key="o" href={`/referral/patients/${p.id}/a/${a.id}`} className="link-btn">열기 →</Link>,
          ])}
        />
      </div>
    </div>
  );
}
