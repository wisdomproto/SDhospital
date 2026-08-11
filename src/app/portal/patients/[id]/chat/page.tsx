import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { buildPatientContext, suggestQuestions } from "@/lib/chat/context";
import { ChatBox } from "./ChatBox";

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

  return (
    <>
      <div style={{ fontWeight: 800, fontSize: "1.05rem", padding: "2px 2px 4px" }}>AI 채팅</div>
      <ChatBox patientId={id} patientName={ctx.patient.name} suggestions={suggestQuestions(ctx)} />
    </>
  );
}
