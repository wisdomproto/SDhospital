"use server";
import { createClient } from "@/lib/supabase/server";
import { validateOwnerInput } from "@/lib/validation/owner";
import { newInviteToken } from "@/lib/invites";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function issueOwnerInvite(ownerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("invite").insert({
    token: newInviteToken(),
    role: "owner",
    owner_id: ownerId,
    expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
  });
  if (error) redirect("/owners?error=" + encodeURIComponent(error.message));
  revalidatePath("/owners");
}

export async function revokeOwnerInvite(id: string) {
  const supabase = await createClient();
  await supabase.from("invite").delete().eq("id", id);
  revalidatePath("/owners");
}

export async function createOwner(formData: FormData) {
  const v = validateOwnerInput({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });
  if (!v.ok) redirect("/owners?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("owner").insert(v.value);
  if (error) redirect("/owners?error=" + encodeURIComponent(error.message));
  revalidatePath("/owners");
  redirect("/owners");
}

export async function updateOwner(id: string, formData: FormData) {
  const v = validateOwnerInput({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });
  if (!v.ok) redirect(`/owners/${id}/edit?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("owner").update(v.value).eq("id", id);
  if (error) redirect(`/owners/${id}/edit?error=` + encodeURIComponent(error.message));
  revalidatePath("/owners");
  redirect("/owners");
}

export async function deleteOwner(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("owner").delete().eq("id", id);
  if (error)
    redirect(
      "/owners?error=" +
        encodeURIComponent("보호자에 연결된 환자가 있어 삭제할 수 없습니다.")
    );
  revalidatePath("/owners");
}
