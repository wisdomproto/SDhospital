"use server";
import { createClient } from "@/lib/supabase/server";
import { validateAdmissionInput } from "@/lib/validation/admission";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createAdmission(patientId: string, formData: FormData) {
  const v = validateAdmissionInput({
    patient_id: patientId,
    admitted_at: String(formData.get("admitted_at") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(`/patients/${patientId}?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admission")
    .insert(v.value)
    .select("id")
    .single();
  if (error) redirect(`/patients/${patientId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/patients/${patientId}`, "layout");
  redirect(`/patients/${patientId}/a/${data!.id}`);
}
