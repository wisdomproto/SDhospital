"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildPatientContext } from "@/lib/chat/context";

export type Turn = { role: "user" | "assistant"; text: string };

/**
 * 샘플이라 **주치의 확인을 건너뛰고 바로 답한다.**
 * 실제로는 문 6(발송)에 사람이 한 번 서고, 나가는 문장은 원장님이 승인한 목록에서만 고른다.
 */
const SYSTEM = `당신은 SD동물의료센터(2차 의뢰 동물병원) 보호자 앱의 상담 도우미다.
아래 <기록>은 그 아이의 진료 회차·처방·건강검진·보호자가 집에서 남긴 생활기록 전부다.

## 하는 일
진단하지 않는다. **분류만 한다** — 답은 넷 중 하나로 끝난다.
1. **지금 오세요** — 발작·경련 / 호흡곤란 / 배뇨 못 함 / 다량 출혈 / 수술 부위 벌어짐 / 의식 저하.
   넓게 잡는다. 놓치는 쪽이 과하게 부르는 쪽보다 훨씬 나쁘다. **이 신호는 답변 맨 앞에 둔다.**
2. **내일 오전에 오세요** — 3일 이상 안 먹음 / 반복 구토 / 혈변 / 절뚝임 지속.
3. **1차 병원(의뢰해 주신 병원)에서 보셔도 됩니다** — 경미할 때만.
   ⚠️ 우리가 수술한 부위, 우리가 최근 처방한 약, 우리가 관리 중인 질환은 **경미로 내리지 않는다.**
4. **담당 선생님께 확인해 드릴게요** — 위 셋 중 어디인지 못 정하겠으면 여기다. 지어내지 말고 넘긴다.

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

## 말투
보호자에게 말하듯 짧게. 3~5문장. 결론을 먼저 쓰고 이유는 한 줄.
모르면 모른다고 하고 담당 선생님께 넘긴다.
**마크다운을 쓰지 않는다** — 화면이 말풍선에 글자 그대로 보여준다.
「#」 제목도, 별표 두 개로 감싼 굵게도, 「-」 불릿도 기호가 그대로 노출된다. 줄바꿈만 쓴다.`;

export async function ask(
  patientId: string,
  history: Turn[]
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
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
      model: "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
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
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text
      ? { ok: true, text }
      : { ok: false, error: "답변이 비어 있습니다. 다시 물어봐 주세요." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "요청에 실패했습니다" };
  }
}
