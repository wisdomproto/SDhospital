"use server";
import { createClient } from "@/lib/supabase/server";
import { newInviteToken } from "@/lib/invites";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function issueOwnerInvite(patientId: string, ownerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("invite").insert({
    token: newInviteToken(),
    role: "owner",
    owner_id: ownerId,
    expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
  });
  if (error) redirect(`/patients/${patientId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/patients/${patientId}`);
}

export async function revokeInvite(patientId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("invite").delete().eq("id", id);
  revalidatePath(`/patients/${patientId}`);
}
