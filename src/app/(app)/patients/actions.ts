"use server";
import { createClient } from "@/lib/supabase/server";
import { validatePatientInput } from "@/lib/validation/patient";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function readPatientForm(formData: FormData) {
  return validatePatientInput({
    name: String(formData.get("name") ?? ""),
    owner_id: String(formData.get("owner_id") ?? ""),
    referring_hospital_id: String(formData.get("referring_hospital_id") ?? ""),
    species: String(formData.get("species") ?? ""),
    breed: String(formData.get("breed") ?? ""),
    sex: String(formData.get("sex") ?? ""),
    birth_date: String(formData.get("birth_date") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
}

export async function createPatient(formData: FormData) {
  const v = readPatientForm(formData);
  if (!v.ok) redirect("/patients/new?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient")
    .insert(v.value)
    .select("id")
    .single();
  if (error) redirect("/patients/new?error=" + encodeURIComponent(error.message));
  revalidatePath("/patients");
  redirect(`/patients/${data!.id}`);
}

export async function updatePatient(id: string, formData: FormData) {
  const v = readPatientForm(formData);
  if (!v.ok) redirect(`/patients/${id}/edit?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("patient").update(v.value).eq("id", id);
  if (error) redirect(`/patients/${id}/edit?error=` + encodeURIComponent(error.message));
  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}`);
}

export async function deletePatient(id: string) {
  const supabase = await createClient();
  await supabase.from("patient").delete().eq("id", id);
  revalidatePath("/patients");
  redirect("/patients");
}
