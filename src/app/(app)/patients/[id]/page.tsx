import { createClient } from "@/lib/supabase/server";
import { deletePatient } from "../actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PatientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patient")
    .select(
      "id, name, species, breed, sex, birth_date, note, owner:owner_id(name, contact), hospital:referring_hospital_id(name, contact)"
    )
    .eq("id", id)
    .single();
  if (!p) notFound();

  const owner = p.owner as unknown as { name: string; contact: string | null } | null;
  const hospital = p.hospital as unknown as { name: string; contact: string | null } | null;

  const rows: [string, string][] = [
    ["종/품종", [p.species, p.breed].filter(Boolean).join(" / ") || "-"],
    ["성별", p.sex ?? "-"],
    ["생일", p.birth_date ?? "-"],
    ["보호자", owner ? `${owner.name}${owner.contact ? ` (${owner.contact})` : ""}` : "-"],
    [
      "의뢰 병원",
      hospital ? `${hospital.name}${hospital.contact ? ` (${hospital.contact})` : ""}` : "-",
    ],
    ["비고", p.note ?? "-"],
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <div className="flex gap-3 text-sm">
          <Link href={`/patients/${p.id}/edit`} className="text-blue-600">
            수정
          </Link>
          <form action={deletePatient.bind(null, p.id)}>
            <button className="text-red-600">삭제</button>
          </form>
        </div>
      </div>

      <dl className="divide-y rounded border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex px-4 py-2 text-sm">
            <dt className="w-28 shrink-0 text-gray-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-2 text-lg font-medium">진료 회차</h2>
        <p className="text-sm text-gray-500">Plan 03에서 구현됩니다.</p>
      </section>
    </div>
  );
}
