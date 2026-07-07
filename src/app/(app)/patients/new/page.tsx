import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { PatientFields } from "../PatientFields";
import { createPatient } from "../actions";

export default async function NewPatient({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: owners }, { data: hospitals }] = await Promise.all([
    supabase.from("owner").select("id, name").order("name"),
    supabase.from("referring_hospital").select("id, name").order("name"),
  ]);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">환자 등록</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={createPatient} className="space-y-3">
        <PatientFields owners={owners ?? []} hospitals={hospitals ?? []} />
        <SubmitButton>등록</SubmitButton>
      </form>
    </div>
  );
}
