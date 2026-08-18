/**
 * vet-fill.mjs — `eval-scenarios.mjs` 결과의 `ask_vet` 행에 **넘긴 다음(담당의 답변)**을 채운다.
 *
 *   node scripts/vet-fill.mjs 결과.json
 *   ONLY_REGULAR=1 node scripts/vet-fill.mjs 결과.json   # 단골만
 *
 * ⚠️ **왜 필요한가.** `ask_vet` 은 「선생님께 여쭤보고 알려드릴게요」에서 끝나는 분류인데,
 * 이 기능의 절반은 **그다음에 무슨 말이 보호자에게 붙느냐**다. 거기서 끊으면 절반만 본 것이다.
 * 손으로 쓴 56마리에는 그 칸이 있었고 **API 로 돌린 아이들에는 없었다** — 단골 30마리가 통째로 비어 있었다.
 *
 * ⚠️ **여기 붙는 답은 진짜 원장님이 쓴 게 아니다.** 기록을 읽고 만든 **테스트용 예시**이고
 * 화면에도 그렇게 적힌다. 실제로는 「오늘 할 일」에서 사람이 쓴다.
 *
 * ⚠️ **한 건 끝날 때마다 `.vet.jsonl` 에 적는다.** 죽으면 이미 낸 돈이 날아간다 —
 * 이 저장소가 3,300건으로 배운 것이다. 다시 켜면 있는 건 건너뛴다.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import { loadEnv, loadPrompts, signInStaff, buildContext } from "./lib/chat-eval.mjs";

loadEnv();
const { POLISH_SYSTEM } = loadPrompts();
const anthropic = new Anthropic();
// ⚠️ **직원 세션이 맞다.** 이 칸을 쓰는 사람은 그 아이를 직접 본 담당의이고, 그는 전부 본다.
const sb = await signInStaff();

const IN = process.argv[2];
if (!IN) throw new Error("결과 json 경로를 넘겨라");
const CACHE = IN.replace(/\.json$/, "") + ".vet.jsonl";
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);

const rows = JSON.parse(fs.readFileSync(IN, "utf8"));
const key = (r) => `${r.chart}|${r.key}|${r.question}`;

// 이미 받아 둔 것
const done = new Map();
if (fs.existsSync(CACHE)) {
  for (const line of fs.readFileSync(CACHE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { const j = JSON.parse(line); done.set(j.k, j.vet); } catch { /* 쓰다 만 마지막 줄 */ }
  }
}

const targets = rows.filter((r) =>
  r.triage === "ask_vet" && r.text && !done.has(key(r)) &&
  (!process.env.ONLY_REGULAR || r.origin === "regular"));
console.log(`ask_vet ${rows.filter((r) => r.triage === "ask_vet").length}건 · 이미 받음 ${done.size} · 남은 ${targets.length}`);

/**
 * 담당의가 썼을 법한 답 — **차트에 쓰듯 짧은 메모로.** 그다음 앱의 다듬기를 그대로 태운다.
 * 두 칸을 나란히 두는 게 요점이다: 원장님은 왼쪽처럼 쓰고, 보호자는 오른쪽을 받는다.
 * ⚠️ `eval-report.mjs` 의 `vetReply` 와 **같은 프롬프트**다. 갈라지면 두 화면이 달라진다.
 */
async function vetReply(context, question, chatAnswer) {
  const memo = await anthropic.messages.create({
    model: process.env.CHAT_MODEL || "claude-opus-5",
    max_tokens: 900,
    output_config: { effort: "low", format: { type: "json_schema", schema: {
      type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false } } },
    system: `당신은 이 아이를 직접 본 담당 수의사다. 보호자 질문에 답한다.
**차트에 쓰듯 짧은 메모로 쓴다** — 두세 줄, 존댓말 아니어도 된다. 실제 수의사가 그렇게 쓴다.
(예: "술부 부종 경미, 발적 있으나 삼출물 없음. 넥칼라 유지, 소독 BID. 3일 뒤 재진.")
⚠️ <기록>에 있는 것만 근거로 삼는다. 없는 검사 결과를 지어내지 않는다.
⚠️ 한국어로만 쓴다. 설명이나 머리말 없이 메모만.`,
    messages: [{ role: "user", content:
      `<기록>\n${context}\n</기록>\n\n<보호자 질문>\n${question}\n</보호자 질문>\n` +
      `<채팅이 이미 한 말>\n${chatAnswer}\n</채팅이 이미 한 말>` }],
  });
  const raw = JSON.parse(memo.content.filter((b) => b.type === "text").map((b) => b.text).join("")).text.trim();

  const pol = await anthropic.messages.create({
    model: process.env.CHAT_MODEL || "claude-opus-5",
    max_tokens: 1500,
    output_config: { effort: "low", format: { type: "json_schema", schema: {
      type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false } } },
    system: POLISH_SYSTEM,
    messages: [{ role: "user", content: `<고칠 문장>\n${raw}\n</고칠 문장>` }],
  });
  let polished = JSON.parse(pol.content.filter((b) => b.type === "text").map((b) => b.text).join("")).text.trim();
  // 앱과 같은 검사 — 이상하면 원문을 그대로 둔다
  if (/[぀-ヿ一-鿿]/.test(polished) || polished.length > raw.length * 2.5 + 60) polished = null;
  return { memo: raw, polished };
}

// 환자·기준일마다 컨텍스트를 한 번만 만든다 (DB 조회라 돈은 안 들지만 느리다)
const pets = new Map();
for (const c of new Set(targets.map((r) => r.chart))) {
  const { data } = await sb.from("patient")
    .select("id,name,species,breed,sex,birth_date,note,chart_no,origin").eq("chart_no", c).single();
  if (data) pets.set(c, data);
}
const ctxCache = new Map();

let n = 0;
const queue = targets.slice();
async function worker() {
  for (;;) {
    const r = queue.shift();
    if (!r) return;
    try {
      const p = pets.get(r.chart);
      const ck = `${r.chart}|${r.asOf}`;
      if (!ctxCache.has(ck)) ctxCache.set(ck, (await buildContext(sb, p, r.asOf)).text);
      const vet = await vetReply(ctxCache.get(ck), r.question, r.text);
      fs.appendFileSync(CACHE, JSON.stringify({ k: key(r), vet }) + "\n", "utf8");
      done.set(key(r), vet);
    } catch (e) {
      console.log(`  ⚠️ ${r.chart} ${r.name}: ${e.message ?? e}`);
    }
    if (++n % 25 === 0) console.log(`  ${n}/${targets.length}…`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

for (const r of rows) if (done.has(key(r))) r.vet = done.get(key(r));
fs.writeFileSync(IN, JSON.stringify(rows, null, 1), "utf8");
console.log(`\n담당의 답변 ${done.size}건을 ${IN} 에 채웠다`);
process.exit(0);
