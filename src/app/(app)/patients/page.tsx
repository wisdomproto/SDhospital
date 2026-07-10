import { createClient } from "@/lib/supabase/server";
import { buildPatientSearch } from "@/lib/validation/patient";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

type PatientRow = {
  id: string;
  chart_no: string | null;
  name: string;
  species: string | null;
  breed: string | null;
  owner: { name: string } | null;
  hospital: { name: string } | null;
};

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("patient")
    .select(
      "id, chart_no, name, species, breed, owner:owner_id(name), hospital:referring_hospital_id(name)"
    )
    .order("created_at", { ascending: false });

  const or = buildPatientSearch(q);
  if (or) query = query.or(or);
  const { data } = await query;
  const patients = (data ?? []) as unknown as PatientRow[];

  // which patients are currently admitted → status pill
  const { data: admitted } = await supabase
    .from("admission")
    .select("patient_id")
    .eq("status", "admitted");
  const admittedSet = new Set((admitted ?? []).map((a) => a.patient_id));

  return (
    <div style={{ maxWidth: 1000, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="eyebrow">Patients</p>
          <h1 className="page-title">환자</h1>
        </div>
        <span className="muted" style={{ fontSize: ".78rem" }}>전체 {patients.length}명</span>
      </div>

      <form style={{ display: "flex", gap: 8 }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="이름 또는 종으로 검색"
          className="field"
          style={{ maxWidth: 300 }}
        />
        <button className="btn btn-ghost btn-sm">검색</button>
      </form>

      <DataTable
        headers={["차트번호", "이름", "종 / 품종", "보호자", "의뢰 병원", "상태"]}
        empty="환자가 없습니다."
        rows={patients.map((p) => [
          <span key="c" style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted)", fontWeight: 600, fontSize: ".82rem" }}>
            {p.chart_no ?? "-"}
          </span>,
          <Link
            key="n"
            href={`/patients/${p.id}`}
            style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)", fontWeight: 600 }}
          >
            <span className="avatar-chip">{p.species === "고양이" ? "🐱" : "🐶"}</span>
            {p.name}
          </Link>,
          [p.species, p.breed].filter(Boolean).join(" / ") || "-",
          p.owner?.name ?? "-",
          p.hospital?.name ?? "-",
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
