import { createClient } from "@/lib/supabase/server";
import { buildPatientSearch } from "@/lib/validation/patient";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

type PatientRow = {
  id: string;
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
      "id, name, species, breed, owner:owner_id(name), hospital:referring_hospital_id(name)"
    )
    .order("created_at", { ascending: false });

  const or = buildPatientSearch(q);
  if (or) query = query.or(or);
  const { data } = await query;
  const patients = (data ?? []) as unknown as PatientRow[];

  return (
    <div style={{ maxWidth: 960, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="eyebrow">Patients</p>
          <h1 className="page-title">환자</h1>
        </div>
        <Link href="/patients/new" className="btn btn-primary btn-sm">
          + 환자 등록
        </Link>
      </div>

      <form style={{ display: "flex", gap: 8 }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="이름 또는 종으로 검색"
          className="field"
          style={{ maxWidth: 280 }}
        />
        <button className="btn btn-ghost btn-sm">검색</button>
      </form>

      <DataTable
        headers={["이름", "종/품종", "보호자", "의뢰 병원"]}
        empty="환자가 없습니다."
        rows={patients.map((p) => [
          <Link key="n" href={`/patients/${p.id}`} className="link-btn">
            {p.name}
          </Link>,
          [p.species, p.breed].filter(Boolean).join(" / ") || "-",
          p.owner?.name ?? "-",
          p.hospital?.name ?? "-",
        ])}
      />
    </div>
  );
}
