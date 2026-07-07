import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateHospital } from "../../actions";
import { notFound } from "next/navigation";

export default async function EditHospital({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: h } = await supabase
    .from("referring_hospital")
    .select("id, name, contact")
    .eq("id", id)
    .single();
  if (!h) notFound();

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">1차 병원 수정</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={updateHospital.bind(null, h.id)} className="space-y-3">
        <FormField label="병원명">
          <input name="name" defaultValue={h.name} required className={inputClass} />
        </FormField>
        <FormField label="연락처">
          <input name="contact" defaultValue={h.contact ?? ""} className={inputClass} />
        </FormField>
        <SubmitButton>저장</SubmitButton>
      </form>
    </div>
  );
}
