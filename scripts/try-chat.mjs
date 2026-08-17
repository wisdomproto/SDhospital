/**
 * try-chat.mjs — 채팅 답변을 앱을 안 켜고 터미널에서 본다 (프롬프트 튜닝용).
 *
 *   node scripts/try-chat.mjs "숨을 가쁘게 쉬어요" "발톱이 갈라졌어요"
 *   PET=고구마 AS_OF=2026-08-09 node scripts/try-chat.mjs "수술한 데가 빨개요"
 *   MODE=admission PET=고구마 AS_OF=2026-08-05 node scripts/try-chat.mjs "밥은 먹었나요?"
 *
 * `AS_OF` 는 앱의 **시나리오 모드와 같은 것**이다 (`src/lib/chat/scenario.ts`) —
 * 「오늘」을 옮기고 그 뒤의 기록은 뺀다. 샘플 데이터가 전부 과거라
 * 입원 중·퇴원 직후를 이것 없이는 눌러 볼 수가 없다.
 *
 * 프롬프트 읽기와 컨텍스트 조립은 `lib/chat-eval.mjs` 가 한다 — 69명 전수 평가
 * (`eval-scenarios.mjs`)와 **같은 코드**여야 한다. 갈라지면 무엇을 검증한 건지 모르게 된다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv, loadPrompts, signIn, buildContext, askOnce } from "./lib/chat-eval.mjs";

loadEnv();
const { SYSTEM, ADMISSION_TAB, GENERAL_TAB } = loadPrompts();
const tab = process.env.MODE === "admission" ? ADMISSION_TAB : GENERAL_TAB;

const sb = await signIn();
const { data: pets } = await sb.from("patient").select("id,name,species,breed,sex,birth_date,note");
const p = pets.find((x) => x.name === (process.env.PET || "슈슈"));
if (!p) throw new Error(`${process.env.PET} 를 못 찾았다`);

const TODAY = process.env.AS_OF || new Date().toISOString().slice(0, 10);
const ctx = await buildContext(sb, p, TODAY);
console.log(
  `[${p.name} · 기준일 ${TODAY} · 컨텍스트 ${ctx.text.length}자 · 회차 ${ctx.visits.length} · 생활기록 ${ctx.logs.length}일` +
  `${ctx.gone ? " · ⚠️ 사망" : ctx.admittedNow ? " · 입원 중" : ""}]\n`
);

const anthropic = new Anthropic();
for (const q of process.argv.slice(2)) {
  // ⚠️ **분류도 같이 받는다.** 답변 문장만 보면 안 된다 — 「여쭤보고 알려드릴게요」 라고 써 놓고
  // 분류가 asking 으로 나가면 원장님 화면에 안 뜨고, 그러면 그 말이 거짓말이 된다.
  const { triage, text, usage } = await askOnce(anthropic, {
    system: SYSTEM, tab, context: ctx.text, question: q, effort: process.env.EFFORT || "low",
  });
  console.log("──────────\nQ:", q, `\n\n[분류: ${triage}]\n\nA:`, text,
    `\n\n[in ${usage.input_tokens}+cache${usage.cache_creation_input_tokens + usage.cache_read_input_tokens} / out ${usage.output_tokens}]\n`);
}
process.exit(0);
