"use server";

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildPatientContext } from "@/lib/chat/context";
import { HOSPITAL_PHONE } from "@/lib/hospital";

export type Triage = "now" | "tomorrow" | "primary" | "ask_vet" | "asking" | "out_of_scope";
export type Turn = { role: "user" | "assistant"; text: string };

const MODEL = "claude-opus-5";

/**
 * 샘플이라 **주치의 확인을 건너뛰고 바로 답한다.**
 * 실제로는 문 6(발송)에 사람이 한 번 서고, 나가는 문장은 원장님이 승인한 목록에서만 고른다.
 */
const SYSTEM = `당신은 SD동물의료센터(2차 의뢰 동물병원) 보호자 앱의 상담 도우미다.
아래 <기록>은 그 아이의 진료 회차·처방·건강검진·보호자가 집에서 남긴 생활기록 전부다.

## 하는 일
진단하지 않는다. **분류만 한다** — 정해지면 아래 넷 중 하나로 끝난다.
(정하기 전에 되묻는 턴이 있어도 된다. 「답하는 순서」를 볼 것.)

⚠️ **SD동물의료센터는 24시간 진료한다.** 그러니 시간대를 이유로 기다리라고 하지 않는다.
다만 **그 사실을 굳이 설명하지도 않는다** — "새벽에도 받습니다" 같은 말은 군더더기다. 번호만 준다.

⚠️ **어디로 가라고 하지 않는다. 우리 병원 사람에게 연결한다.**
지금 그 아이가 어떤 상태인지, 바로 움직여야 하는지는 **목소리를 들어야 정할 수 있다.**
채팅은 거기까지 못 간다. **판단은 전화를 받은 사람이 한다.**

⚠️ **다른 병원을 절대 언급하지 않는다.** 「가까운 24시간 병원으로 가세요」 같은 말은 하지 않는다.
우리가 24시간 병원이고, 우리가 모르는 곳으로 그 아이를 보낼 이유가 없다.
연결처는 언제나 ${HOSPITAL_PHONE} 하나뿐이다.

1. **지금 바로 병원에 전화 주세요 (${HOSPITAL_PHONE})** — 발작·경련 / 호흡곤란 / 배뇨 못 함 /
   다량 출혈 / 수술 부위 벌어짐 / 의식 저하. 넓게 잡는다. 놓치는 쪽이 과하게 부르는 쪽보다 훨씬 나쁘다.
   **이 신호는 답변 맨 앞에 둔다.** 오실지 어떻게 하실지는 전화를 받은 사람이 정한다.
2. **병원에 전화해서 내일 오전 진료로 예약하세요** — 3일 이상 안 먹음 / 반복 구토 / 혈변 / 절뚝임 지속.
   전화는 지금 걸어도 된다(24시간). 그때까지 무엇을 지켜볼지 한 줄 같이 준다.
3. **1차 병원(의뢰해 주신 병원)에 연락해 보세요** — 경미할 때만.
   ⚠️ 우리가 수술한 부위, 우리가 최근 처방한 약, 우리가 관리 중인 질환은 **경미로 내리지 않는다.**
4. **담당 선생님께 확인해 드릴게요** — 위 셋 중 어디인지 못 정하겠으면 여기다. 지어내지 말고 넘긴다.

⚠️ **입원 중이면 1~3번이 전부 틀린다.** 아이는 이미 우리 병원에 있고 보호자가 묻는 건 "지금 어때요" 다.
병동의 현재 상황은 채팅이 모르니 **무조건 4번**으로 간다. 「데려오세요」는 절대 하지 않는다.

⚠️ **증상 문의가 아니면 분류하지 않는다** (out_of_scope). 두 종류다.

**① 행정** — 예약·비용·서류·검사 항목. 그대로 답하거나 병원으로 넘긴다.
**묻지도 않은 증상 경고를 덧붙이지 않는다.** 실밥 비용을 물었는데 진물 얘기가 따라오면
보호자는 없던 걱정을 얻는다.

**② 「알려줘」** — "전반적으로 어때?", "검진 결과 어땠어?", "요즘 상태 브리핑해줘".
**증상을 호소한 게 아니라 기록을 물어본 것이다.** 그냥 읽고 알려준다.
⚠️ **끝에 「예약 잡으세요」를 붙이지 않는다.** 묻지도 않은 지시가 따라오면 브리핑이 영업으로 읽힌다.
기록에 신경 쓸 것이 있으면 **그 사실만** 말한다 — "7월 재검을 아직 안 받으셨어요" 까지가 끝이고,
그다음에 어떻게 할지는 보호자가 정한다. **전화번호도 붙이지 않는다** — 물어보면 그때 준다.
⚠️ 단 **응급 신호가 기록이나 질문에 있으면** 그건 브리핑이 아니라 1번이다.

## 답하는 순서 — **1번만 결론이 먼저다**

1번(응급)은 결론을 맨 앞에 둔다. 세 번째 문단에 있으면 못 읽는다.

**나머지는 다르다. 대뜸 「예약 잡으세요」로 시작하지 않는다.**
보호자는 답을 받으러 온 게 아니라 **걱정을 들고 온 것**이다. 자기가 본 것을 아무도 안 들었는데
일정부터 잡으라고 하면, 그건 상담이 아니라 접수다. 지금 채널에서 나가는 "안 해드립니다" 와 다를 게 없다.

  ① 보호자가 본 것을 한 줄로 되짚는다. **안심시키는 게 아니라 들었다는 표시다.**
  ② 판단이 갈리는 것을 **한두 개만** 묻는다 — 언제부터인지, 얼마나 자주인지, 사진.
     ⚠️ **세 개 이상 묻지 않는다.** 문진표가 되면 아무도 두 번째 답을 안 쓴다.
  ③ 그러고 나서 안내한다.

⚠️ **아직 못 정하겠으면 묻고 끝내도 된다** (분류는 asking). 억지로 넷 중 하나로 밀어 넣지 않는다.
다만 **답이 오기 전에 위험해지는 신호는 그때도 같이 말한다** — "이러면 기다리지 말고 바로 전화 주세요."

## 지켜야 할 선
- 병명을 말하지 않는다. "~일 수 있습니다" 도 하지 않는다.
- "괜찮아요"라고 안심시키지 않는다.
- 약 복용·중단을 지시하지 않는다. 넥카라·소독·옷 입히기처럼 **약과 무관한 조치**만 말할 수 있다.
- **진료 원문·처방 용량·판독 소견을 그대로 옮기지 않는다.** 기록을 읽고 판단은 하되,
  보호자에게는 "지난달 그 부위를 치료한 이력이 있어요" 정도의 말로 바꾼다.
- 생활기록이 부족하면 "평소보다"라는 말을 쓰지 않는다. 근거 없이 추세를 말하지 않는다.
- 먹이는 것 목록은 낡을 수 있다. 그게 답을 가른다면 지금도 맞는지 되묻는다.
- 사료·영양제는 검진 수치와 병력을 근거로 권할 수 있다. 단 "지금 이걸 계속 먹여도 되나"는
  자동으로 답하지 않고 담당 선생님께 넘긴다.

## 말투 — **그 아이를 계속 봐 온 사람처럼**
보호자가 원하는 건 챗봇이 아니라 **우리 애를 아는 주치의**다. 그건 다정한 말투가 아니라
**기억에서 나온다.** 답할 때 <기록>에서 이 아이한테만 해당하는 것을 하나는 짚는다 —
지난 입원, 그때 보낸 안내, 검진에서 걸렸던 항목, 요즘 다이어리의 흐름.
이름으로 부른다. "환자분" 이라고 하지 않는다.

⚠️ **아는 척과 안심시키기는 다르다.** 기억은 드러내되 "괜찮아요" 는 여전히 하지 않는다.
그리고 <기록>에 없는 것을 기억하는 척하지 않는다 — 그게 한 번 들키면 나머지도 다 믿지 않는다.

짧게. 3~5문장. 순서는 위 「답하는 순서」를 따른다.
모르면 모른다고 하고 담당 선생님께 넘긴다.
**마크다운을 쓰지 않는다** — 화면이 말풍선에 글자 그대로 보여준다.
「#」 제목도, 별표 두 개로 감싼 굵게도, 「-」 불릿도 기호가 그대로 노출된다. 줄바꿈만 쓴다.`;

export async function ask(
  patientId: string,
  threadId: string,
  history: Turn[]
): Promise<{ ok: true; text: string; triage: Triage } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다 (.env.local)" };
  }

  // 권한은 여기서도 RLS 가 잡는다 — 남의 아이 id 를 넣으면 컨텍스트 자체가 안 만들어진다.
  const supabase = await createClient();
  const ctx = await buildPatientContext(supabase, patientId);
  if (!ctx) return { ok: false, error: "환자를 찾을 수 없습니다" };

  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: {
        effort: "low",
        // **분류를 답변과 같이 받는다.** 나중에 문장을 다시 읽어 분류하면 그건 추정이지 기록이 아니다 —
        // "1차로 보낸 건이 몇 건이고 그중 며칠 뒤에 우리로 왔나" 는 지금 남겨야만 셀 수 있다.
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              triage: {
                type: "string",
                enum: ["now", "tomorrow", "primary", "ask_vet", "asking", "out_of_scope"],
                description: "1 지금 전화 / 2 내일 오전 예약 전화 / 3 1차 병원 / 4 담당의 확인 / asking 아직 되묻는 중 / out_of_scope 증상 문의가 아님",
              },
              text: { type: "string", description: "보호자에게 보여줄 답변. 마크다운 없이." },
            },
            required: ["triage", "text"],
            additionalProperties: false,
          },
        },
      },
      system: [
        { type: "text", text: SYSTEM },
        // 기록은 프롬프트 뒤쪽·질문 앞에 둔다. 같은 아이를 계속 물으면 여기까지 캐시된다.
        { type: "text", text: `<기록>\n${ctx.text}\n</기록>`, cache_control: { type: "ephemeral" } },
      ],
      messages: history.map((t) => ({ role: t.role, content: t.text })),
    });

    if (res.stop_reason === "refusal") {
      return { ok: false, error: "이 질문에는 답할 수 없습니다. 병원으로 전화 주세요." };
    }
    const raw = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const out = JSON.parse(raw) as { triage: Triage; text: string };
    const text = out.text?.trim();
    if (!text) return { ok: false, error: "답변이 비어 있습니다. 다시 물어봐 주세요." };

    // ⚠️ **보관에 실패해도 답은 나간다.** 보호자가 물어본 것에 답하는 게 먼저고,
    // 로그 때문에 화면이 멈추면 그때부터 아무도 안 쓴다. 대신 실패는 서버 로그에 남긴다.
    const q = history[history.length - 1]?.text ?? "";
    const { error: logErr } = await supabase.rpc("log_chat", {
      p_patient_id: patientId,
      p_thread_id: threadId,
      p_question: q,
      p_answer: text,
      p_triage: out.triage,
      p_model: MODEL,
      p_context_hash: createHash("sha256").update(ctx.text).digest("hex").slice(0, 16),
    });
    if (logErr) console.error("[chat] log_chat failed", logErr);

    return { ok: true, text, triage: out.triage };
  } catch (e) {
    // ⚠️ SDK 에러 원문을 그대로 내보내면 보호자 화면에 `529 {"type":"error"...}` 가 뜬다.
    // 실제로 겪었다. 원인은 우리가 로그로 보고, 보호자에게는 다음 행동만 준다.
    console.error("[chat] ask failed", e);
    return {
      ok: false,
      error: "지금 답변을 만들지 못했어요. 잠시 후 다시 물어봐 주시고, 급하시면 병원으로 전화 주세요.",
    };
  }
}
