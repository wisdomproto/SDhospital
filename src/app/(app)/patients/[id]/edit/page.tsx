import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { PatientFields } from "../../PatientFields";
import { updatePatient } from "../../actions";
import { notFound } from "next/navigation";

export default async function EditPatient({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: p }, { data: owners }, { data: hospitals }] = await Promise.all([
    supabase.from("patient").select("*").eq("id", id).single(),
    supabase.from("owner").select("id, name").order("name"),
    supabase.from("referring_hospital").select("id, name").order("name"),
  ]);
  if (!p) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">환자 수정</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={updatePatient.bind(null, p.id)} className="space-y-3">
        <PatientFields
          owners={owners ?? []}
          hospitals={hospitals ?? []}
          d={{
            name: p.name,
            owner_id: p.owner_id,
            referring_hospital_id: p.referring_hospital_id,
            species: p.species ?? "",
            breed: p.breed ?? "",
            sex: p.sex ?? "",
            birth_date: p.birth_date ?? "",
            note: p.note ?? "",
          }}
        />
        <SubmitButton>저장</SubmitButton>
      </form>
    </div>
  );
}
