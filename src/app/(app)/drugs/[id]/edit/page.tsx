import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateDrug } from "../../actions";
import { notFound } from "next/navigation";

export default async function EditDrug({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("drug")
    .select("id, name, unit, spec, note")
    .eq("id", id)
    .single();
  if (!d) notFound();

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">약품 수정</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={updateDrug.bind(null, d.id)} className="space-y-3">
        <FormField label="약품명">
          <input name="name" defaultValue={d.name} required className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="단위">
            <input name="unit" defaultValue={d.unit ?? ""} className={inputClass} />
          </FormField>
          <FormField label="규격">
            <input name="spec" defaultValue={d.spec ?? ""} className={inputClass} />
          </FormField>
        </div>
        <FormField label="비고">
          <input name="note" defaultValue={d.note ?? ""} className={inputClass} />
        </FormField>
        <SubmitButton>저장</SubmitButton>
      </form>
    </div>
  );
}
