"use server";
import { createClient } from "@/lib/supabase/server";
import { newInviteToken } from "@/lib/invites";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function issueVetInvite(hospitalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("invite").insert({
    token: newInviteToken(),
    role: "referring_vet",
    referring_hospital_id: hospitalId,
    expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
  });
  if (error) redirect("/hospitals?error=" + encodeURIComponent(error.message));
  revalidatePath("/hospitals");
}

export async function revokeVetInvite(id: string) {
  const supabase = await createClient();
  await supabase.from("invite").delete().eq("id", id);
  revalidatePath("/hospitals");
}
