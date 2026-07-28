import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/DataTable";
import { referralStage, STAGE_LABEL, STAGE_TONE } from "@/lib/referral";
import Link from "next/link";

export default async function ReferralHome() {
  const supabase = await createClient();

  // RLS: referring_vet는 자기 병원 의뢰 환자만 조회된다.
  const { data: patients } = await supabase
    .from("patient")
    .select("id, chart_no, name, species, breed")
    .order("created_at", { ascending: false });
  const list = patients ?? [];

  const [{ data: admissions }, { data: visits }] = await Promise.all([
    supabase.from("admission").select("visit_id, status"),
    supabase
      .from("visit")
      .select("id, patient_id, visit_date, closed_at, referred_back_at")
      .order("visit_date", { ascending: false }),
  ]);
  const byVisit = new Map<string, { status: string }[]>();
  for (const a of admissions ?? []) {
    if (!a.visit_id) continue;
    const list = byVisit.get(a.visit_id) ?? [];
    list.push({ status: a.status });
    byVisit.set(a.visit_id, list);
  }
  // 환자 상태 = 가장 최근 회차의 상태. 원장이 알고 싶은 건 "내 환자 지금 어떻게 됐나" 하나다.
  const latest = new Map<string, NonNullable<typeof visits>[number]>();
  for (const v of visits ?? []) {
    if (v.patient_id && !latest.has(v.patient_id)) latest.set(v.patient_id, v);
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
          <span key="d" style={{ color: "var(--muted)" }}>{latest.get(p.id)?.visit_date ?? "-"}</span>,
          (() => {
            const v = latest.get(p.id);
            if (!v) return <span key="s" className="pill muted">-</span>;
            const stage = referralStage({ ...v, admissions: byVisit.get(v.id) ?? [] });
            return <span key="s" className={`pill ${STAGE_TONE[stage]}`}>{STAGE_LABEL[stage]}</span>;
          })(),
        ])}
      />
    </div>
  );
}
