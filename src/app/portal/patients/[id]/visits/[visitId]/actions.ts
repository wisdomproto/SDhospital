"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * 보호자가 그 회차의 의료영상을 보내 달라고 요청한다.
 *
 * ⚠️ 여기서 영상이 열리는 게 아니다. 요청만 남고, **직원이 승인해야** 보인다 —
 * 발송은 사람이 누를 때만이라는 이 앱의 규칙 그대로다.
 * 권한 확인은 DEFINER 함수 안에서 한다(본인 반려동물인지).
 */
export async function requestImages(patientId: string, visitId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_medical_images", { p_visit: visitId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/portal/patients/${patientId}/visits/${visitId}`);
  return { ok: true as const };
}
