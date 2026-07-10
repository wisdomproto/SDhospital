import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

export default async function ReferralHome() {
  const supabase = await createClient();

  // RLS: referring_vet는 자기 병원 의뢰 환자만 조회된다.
  const { data: patients } = await supabase
    .from("patient")
    .select("id, chart_no, name, species, breed")
    .order("created_at", { ascending: false });
  const list = patients ?? [];

  const [{ data: admitted }, { data: visits }] = await Promise.all([
    supabase.from("admission").select("patient_id").eq("status", "admitted"),
    supabase.from("visit").select("patient_id, visit_date").order("visit_date", { ascending: false }),
  ]);
  const admittedSet = new Set((admitted ?? []).map((a) => a.patient_id));
  const lastVisit = new Map<string, string>();
  for (const v of visits ?? []) {
    if (v.patient_id && !lastVisit.has(v.patient_id)) lastVisit.set(v.patient_id, v.visit_date);
  }

  return (
    <div style={{ maxWidth: 1000, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="eyebrow">Referral</p>
          <h1 className="page-title">의뢰 환자</h1>
        </div>
        <span className="muted" style={{ fontSize: ".78rem" }}>전체 {list.length}명</span>
      </div>

      <DataTable
        headers={["차트번호", "이름", "종 / 품종", "최근 진료", "상태"]}
        empty="열람 가능한 의뢰 환자가 없습니다."
        rows={list.map((p) => [
          <span key="c" style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted)", fontWeight: 600, fontSize: ".82rem" }}>
            {p.chart_no ?? "-"}
          </span>,
          <Link
            key="n"
            href={`/referral/patients/${p.id}`}
            style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)", fontWeight: 600 }}
          >
            <span className="avatar-chip">{p.species === "고양이" ? "🐱" : "🐶"}</span>
            {p.name}
          </Link>,
          [p.species, p.breed].filter(Boolean).join(" / ") || "-",
          <span key="d" style={{ color: "var(--muted)" }}>{lastVisit.get(p.id) ?? "-"}</span>,
          admittedSet.has(p.id) ? (
            <span key="s" className="pill warning">입원중</span>
          ) : (
            <span key="s" className="pill success">외래</span>
          ),
        ])}
      />
    </div>
  );
}
