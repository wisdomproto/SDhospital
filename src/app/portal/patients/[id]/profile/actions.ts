"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** 사진은 브라우저에서 400px WebP 로 줄여 data URL 로 온다. 쓰기는 DEFINER 함수로만. */
export async function savePetPhoto(patientId: string, photo: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_patient_photo", {
    p_patient_id: patientId,
    p_photo: photo,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/portal/patients/${patientId}`, "layout");
  return { ok: true as const };
}
