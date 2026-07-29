"use server";
import { createClient } from "@/lib/supabase/server";
import { validateAdmissionInput } from "@/lib/validation/admission";
import { notifyReferringVet } from "@/lib/push";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// 입원은 진료 회차에서 시작한다 (입원하러 온 환자도 진료 기록이 먼저 생긴다).
export async function createAdmission(patientId: string, visitId: string, formData: FormData) {
  const back = `/patients/${patientId}/v/${visitId}`;
  const v = validateAdmissionInput({
    patient_id: patientId,
    visit_id: visitId,
    admitted_at: String(formData.get("admitted_at") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(`${back}?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admission")
    .insert(v.value)
    .select("id")
    .single();
  if (error) redirect(`${back}?error=` + encodeURIComponent(error.message));

  const { data: p } = await supabase.from("patient").select("name").eq("id", patientId).single();
  await notifyReferringVet(supabase, patientId, {
    title: `${p?.name ?? "의뢰 환자"} 입원했습니다`,
    body: "입원 경과는 환자 화면에서 확인하실 수 있습니다.",
    url: `/referral/patients/${patientId}/a/${data!.id}`,
  });

  revalidatePath(`/patients/${patientId}`, "layout");
  redirect(`/patients/${patientId}/a/${data!.id}`);
}
