"use server";
import { createClient } from "@/lib/supabase/server";
import { validateHospitalInput } from "@/lib/validation/hospital";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createHospital(formData: FormData) {
  const v = validateHospitalInput({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });
  if (!v.ok) redirect("/hospitals?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("referring_hospital").insert(v.value);
  if (error) redirect("/hospitals?error=" + encodeURIComponent(error.message));
  revalidatePath("/hospitals");
  redirect("/hospitals");
}

export async function updateHospital(id: string, formData: FormData) {
  const v = validateHospitalInput({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });
  if (!v.ok) redirect(`/hospitals/${id}/edit?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("referring_hospital")
    .update(v.value)
    .eq("id", id);
  if (error) redirect(`/hospitals/${id}/edit?error=` + encodeURIComponent(error.message));
  revalidatePath("/hospitals");
  redirect("/hospitals");
}

export async function deleteHospital(id: string) {
  const supabase = await createClient();
  await supabase.from("referring_hospital").delete().eq("id", id);
  revalidatePath("/hospitals");
}
