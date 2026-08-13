import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { admissionQuestions, buildPatientContext, suggestQuestions } from "@/lib/chat/context";
import { pairVetQuestions, type ChatRow } from "@/lib/chat/vet-questions";
import { ChatBox } from "./ChatBox";
import { VetAnswers } from "./VetAnswers";

/**
 * AI 채팅 — **샘플**. 주치의 확인 없이 바로 답한다.
 *
 * 채팅이 다른 기능과 다른 점은 하나다 — 그 아이의 기록을 읽는다.
 * 그래서 컨텍스트는 여기(서버)에서 만들고, 화면에는 절대 내려보내지 않는다.
 * 진료 원문이 클라이언트로 가면 보호자 화면에서 진료 원문을 뺀 의미가 없어진다.
 */
export default async function PortalChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await buildPatientContext(supabase, id);
  if (!ctx) notFound();

  // 사람에게 넘긴 질문과 그 답. 채팅 자체는 새로고침하면 비지만 **이건 남아야 한다** —
  // 답을 받으러 다시 들어왔는데 없으면 넘겼다는 말이 거짓말이 된다.
  const { data: rows } = await supabase
    .from("chat_message")
    .select("thread_id, role, content, triage, model, created_at")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(60);
  const vetQuestions = pairVetQuestions((rows ?? []).slice().reverse() as ChatRow[]).slice(0, 5);

  return (
    <>
      <div style={{ fontWeight: 800, fontSize: "1.05rem", padding: "2px 2px 4px" }}>AI 채팅</div>
      <VetAnswers items={vetQuestions} />
      <ChatBox
        patientId={id}
        patientName={ctx.patient.name}
        suggestions={suggestQuestions(ctx)}
        // 입원 중일 때만 위에 탭이 생긴다. 아니면 탭 자체가 없다 —
        // 1년에 며칠뿐인 상태를 위해 360일짜리 빈 탭을 두지 않는다.
        admittedAt={ctx.admittedAt}
        admissionSuggestions={admissionQuestions()}
      />
    </>
  );
}
