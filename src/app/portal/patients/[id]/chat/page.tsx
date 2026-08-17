import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { admissionQuestions, buildPatientContext, suggestQuestions } from "@/lib/chat/context";
import { pairVetQuestions, type ChatRow } from "@/lib/chat/vet-questions";
import { scenariosFor } from "@/lib/chat/scenario";
import { kstToday } from "@/lib/worklist";
import { ChatBox } from "./ChatBox";
import { VetAnswers } from "./VetAnswers";
import { DEMO_ENABLED } from "@/app/login/demo";

/**
 * AI 채팅 — **샘플**. 주치의 확인 없이 바로 답한다.
 *
 * 채팅이 다른 기능과 다른 점은 하나다 — 그 아이의 기록을 읽는다.
 * 그래서 컨텍스트는 여기(서버)에서 만들고, 화면에는 절대 내려보내지 않는다.
 * 진료 원문이 클라이언트로 가면 보호자 화면에서 진료 원문을 뺀 의미가 없어진다.
 *
 * ## 위의 시나리오 줄에 대하여
 *
 * 채팅이 틀리는 자리는 「무엇을 물었나」보다 **「언제 물었나」**에 있다.
 * 퇴원 사흘째의 "수술한 데가 빨개요" 와 반년 뒤의 같은 문장은 답이 달라야 한다.
 * 그런데 샘플 데이터는 전부 과거라 **지금 입원 중인 아이가 사실상 없어서**
 * 입원 중·퇴원 직후를 눌러 볼 방법이 없다.
 *
 * 그래서 가짜 입원을 만드는 대신 **「오늘」을 그 아이가 실제로 입원해 있던 날로 옮긴다**
 * (`lib/chat/scenario.ts`). 그날의 기록·처방·다이어리가 전부 진짜고,
 * 기준일 이후의 기록은 컨텍스트에서 빠진다 — 안 그러면 채팅이 미래를 알고 답한다.
 *
 * ⚠️ **아직 보호자에게 앱을 주지 않았다. 줄 때 이 줄을 뗀다** — `scenarios` 를 안 넘기면 안 뜬다.
 */
export default async function PortalChat({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { id } = await params;
  const { s } = await searchParams;
  const supabase = await createClient();

  const { data: adms } = await supabase
    .from("admission")
    .select("admitted_at, discharged_at")
    .eq("patient_id", id)
    .order("admitted_at", { ascending: false });

  const scenarios = scenariosFor(adms ?? [], kstToday());
  // 기본은 「지금」 — 아무것도 안 고르면 실제 앱과 똑같이 보여야 한다
  const active = scenarios.find((x) => x.key === s) ?? scenarios[scenarios.length - 1];

  const ctx = await buildPatientContext(supabase, id, undefined, active.asOf);
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

      {/* 시나리오 전환은 링크로 한다 — 서버가 그 날짜로 컨텍스트를 다시 만들어야
          「입원 중」 탭이나 질문 목록이 그 시점 것으로 바뀐다 */}
      {scenarios.length > 1 && (
        <div className="scenario-box">
          <div className="scenario-picker">
            {scenarios.map((x) => (
              <Link key={x.key} href={`?s=${x.key}`} className={x.key === active.key ? "active" : ""}>
                {x.label}
              </Link>
            ))}
          </div>
          <div className="scenario-hint">
            <b>테스트 · 기준일 {active.asOf ?? kstToday()}</b>
            <span>{active.hint}</span>
          </div>
        </div>
      )}

      <VetAnswers patientId={id} items={vetQuestions} />
      {/* key 로 갈아 끼운다 — 시나리오를 바꿨는데 앞 시나리오의 대화가 남아 있으면 안 된다 */}
      <ChatBox
        key={active.key}
        patientId={id}
        patientName={ctx.patient.name}
        // ⚠️ **방은 하나다.** 입원 중이면 병동 질문을 위로 올리되 평소 질문도 남긴다 —
        // 입원 중에도 "퇴원하면 사료 뭐 먹여요" 를 물을 데가 있어야 한다.
        suggestions={
          active.questions.length
            ? active.questions
            : ctx.admittedAt
              ? [...admissionQuestions().slice(0, 4), ...suggestQuestions(ctx).slice(0, 2)]
              : suggestQuestions(ctx)
        }
        admittedAt={ctx.admittedAt}
        asOf={active.asOf}
        // ⚠️ 테스트 전용 — 보호자에게 앱을 줄 때 NEXT_PUBLIC_ENABLE_DEMO 를 끈다
        testMode={DEMO_ENABLED}
      />
    </>
  );
}
