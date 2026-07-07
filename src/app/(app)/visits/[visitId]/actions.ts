"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateVisitNote(visitId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim() || null;
  const supabase = await createClient();
  await supabase.from("visit").update({ note }).eq("id", visitId);
  revalidatePath(`/visits/${visitId}`);
}
