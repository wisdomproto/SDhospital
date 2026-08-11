/**
 * try-chat.mjs — 채팅 답변을 앱을 안 켜고 터미널에서 본다 (프롬프트 튜닝용).
 *
 *   node scripts/try-chat.mjs "숨을 가쁘게 쉬어요" "발톱이 갈라졌어요"
 *
 * SYSTEM 프롬프트는 `actions.ts` 에서 **직접 읽는다** — 베껴 두면 검증이 아니다.
 * ⚠️ 컨텍스트 조립은 `src/lib/chat/context.ts` 의 **근사치**다(검진·처방 요약이 빠져 있다).
 * 여기서 확인하는 건 "이 프롬프트가 이 기록을 보고 어떻게 답하나" 하나뿐이다.
 * 화면과 완전히 같은 답을 보려면 앱을 켜야 한다.
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0,i).trim()] = l.slice(i+1).trim();
}
// actions.ts 의 SYSTEM 을 그대로 읽어 쓴다 — 베끼면 검증이 아니다
const src = fs.readFileSync("src/app/portal/patients/[id]/chat/actions.ts", "utf8");
const SYSTEM = src.slice(src.indexOf("const SYSTEM = `") + 16, src.indexOf("`;\n\nexport async function ask"));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: "1@example.com", password: "1234" });
const { data: pets } = await sb.from("patient").select("id,name,species,breed,sex,birth_date");
const p = pets.find((x) => x.name === "슈슈");

const { data: visits } = await sb.from("visit")
  .select("visit_date, chief_complaint, note, report_comment, prescription(dose,frequency,duration,drug:drug_id(name))")
  .eq("patient_id", p.id).order("visit_date", { ascending: false }).limit(15);
const { data: logs } = await sb.from("life_log")
  .select("logged_on,appetite,stool,energy,weight_kg,meds,note").eq("patient_id", p.id)
  .gte("logged_on", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)).order("logged_on", { ascending: false });
const { data: intakes } = await sb.from("life_intake").select("label,started_on,stopped_on").eq("patient_id", p.id);

const ctx = [
  `# ${p.name}`, `${p.species} · ${p.breed} · ${p.sex} · ${p.birth_date} 생`, `오늘 날짜: ${new Date().toISOString().slice(0, 10)}`,
  "\n## 진료 기록 (최근 순)",
  ...visits.map((v) => `\n### ${v.visit_date} — ${v.chief_complaint}\n진료 원문: ${v.note}\n보호자 코멘트: ${v.report_comment}` +
    (v.prescription?.length ? `\n처방: ${v.prescription.map((r)=>[r.drug?.name,r.dose,r.frequency].filter(Boolean).join(" ")).join(" / ")}` : "")),
  `\n최근 30일 내 우리 처방: 없음`,
  "\n## 생활기록 (최근 30일)",
  ...logs.map((l) => `- ${l.logged_on}: 식사 ${l.appetite} · 배변 ${l.stool} · 활력 ${l.energy} · ${l.weight_kg}kg`),
  "\n## 먹이는 것", ...(intakes.length ? intakes.map((i)=>`- ${i.label} (${i.started_on}~${i.stopped_on ?? ""})`) : ["등록된 것 없음"]),
].join("\n");
console.log(`[컨텍스트 ${ctx.length}자 · 회차 ${visits.length} · 생활기록 ${logs.length}일]\n`);

const c = new Anthropic();
for (const q of process.argv.slice(2)) {
  const r = await c.messages.create({
    model: "claude-opus-5", max_tokens: 4000, output_config: { effort: "low" },
    system: [{ type: "text", text: SYSTEM }, { type: "text", text: `<기록>\n${ctx}\n</기록>`, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: q }],
  });
  console.log("──────────\nQ:", q, "\n\nA:", r.content.filter(b=>b.type==="text").map(b=>b.text).join(""),
    `\n\n[in ${r.usage.input_tokens}+cache${r.usage.cache_creation_input_tokens+r.usage.cache_read_input_tokens} / out ${r.usage.output_tokens}]\n`);
}
process.exit(0);
