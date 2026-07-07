"use server";
import { createClient } from "@/lib/supabase/server";
import { validatePrescriptionInput } from "@/lib/validation/prescription";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateVisitNote(visitId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim() || null;
  const supabase = await createClient();
  await supabase.from("visit").update({ note }).eq("id", visitId);
  revalidatePath(`/visits/${visitId}`);
}

export async function addPrescription(visitId: string, formData: FormData) {
  const v = validatePrescriptionInput({
    visit_id: visitId,
    drug_id: String(formData.get("drug_id") ?? ""),
    dose: String(formData.get("dose") ?? ""),
    frequency: String(formData.get("frequency") ?? ""),
    duration: String(formData.get("duration") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(`/visits/${visitId}?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("prescription").insert(v.value);
  if (error) redirect(`/visits/${visitId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/visits/${visitId}`);
}

export async function deletePrescription(visitId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("prescription").delete().eq("id", id);
  revalidatePath(`/visits/${visitId}`);
}
