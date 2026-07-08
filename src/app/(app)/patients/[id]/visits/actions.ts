"use server";
import { createClient } from "@/lib/supabase/server";
import { validateVisitInput } from "@/lib/validation/visit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createVisit(patientId: string, formData: FormData) {
  const v = validateVisitInput({
    patient_id: patientId,
    visit_date: String(formData.get("visit_date") ?? ""),
    visit_no: String(formData.get("visit_no") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(`/patients/${patientId}?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit")
    .insert(v.value)
    .select("id")
    .single();
  if (error) redirect(`/patients/${patientId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/patients/${patientId}`);
  redirect(`/visits/${data!.id}`);
}
