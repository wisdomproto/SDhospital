import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateOwner } from "../../actions";
import { notFound } from "next/navigation";

export default async function EditOwner({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("owner")
    .select("id, name, contact")
    .eq("id", id)
    .single();
  if (!o) notFound();

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">보호자 수정</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={updateOwner.bind(null, o.id)} className="space-y-3">
        <FormField label="이름">
          <input name="name" defaultValue={o.name} required className={inputClass} />
        </FormField>
        <FormField label="연락처">
          <input name="contact" defaultValue={o.contact ?? ""} className={inputClass} />
        </FormField>
        <SubmitButton>저장</SubmitButton>
      </form>
    </div>
  );
}
