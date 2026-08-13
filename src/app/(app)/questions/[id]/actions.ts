"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * 채팅이 넘긴 질문에 사람이 답한다.
 *
 * ⚠️ **AI 를 거치지 않는다.** 이 답은 원장님이 쓴 그대로 보호자에게 간다 —
 * 다듬는 단계를 넣으면 "사람에게 물어봤다"가 다시 AI 답이 된다.
 */
export async function sendVetAnswer(formData: FormData) {
  const patientId = String(formData.get("patientId") ?? "");
  const threadId = String(formData.get("threadId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  const back = `/questions/${String(formData.get("questionId") ?? "")}`;

  if (!answer) redirect(`${back}?error=${encodeURIComponent("답변을 입력해 주세요.")}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_chat", {
    p_patient_id: patientId,
    p_thread_id: threadId,
    p_answer: answer,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/today");
  redirect("/today");
}
