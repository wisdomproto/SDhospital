"use server";
import { createClient } from "@/lib/supabase/server";
import { validateDrugInput } from "@/lib/validation/drug";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function read(formData: FormData) {
  return validateDrugInput({
    name: String(formData.get("name") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    spec: String(formData.get("spec") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
}

export async function createDrug(formData: FormData) {
  const v = read(formData);
  if (!v.ok) redirect("/drugs?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("drug").insert(v.value);
  if (error) redirect("/drugs?error=" + encodeURIComponent(error.message));
  revalidatePath("/drugs");
  redirect("/drugs");
}

export async function updateDrug(id: string, formData: FormData) {
  const v = read(formData);
  if (!v.ok) redirect(`/drugs/${id}/edit?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("drug").update(v.value).eq("id", id);
  if (error) redirect(`/drugs/${id}/edit?error=` + encodeURIComponent(error.message));
  revalidatePath("/drugs");
  redirect("/drugs");
}

export async function deleteDrug(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("drug").delete().eq("id", id);
  if (error)
    redirect(
      "/drugs?error=" + encodeURIComponent("처방에 사용된 약품이라 삭제할 수 없습니다.")
    );
  revalidatePath("/drugs");
}
