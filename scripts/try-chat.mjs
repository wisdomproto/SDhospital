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
const SYSTEM = src
  .slice(src.indexOf("const SYSTEM = `") + 16, src.indexOf("`;\n\nexport async function ask"))
  .replaceAll("${HOSPITAL_PHONE}", "02-2039-0303"); // 템플릿 변수는 여기서 채운다
const tab = (name) => src.slice(src.indexOf(`const ${name} = \``) + name.length + 15, src.indexOf("`;", src.indexOf(`const ${name} = \``)));
const MODE = process.env.MODE === "admission" ? tab("ADMISSION_TAB") : tab("GENERAL_TAB");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: "1@example.com", password: "1234" });
const { data: pets } = await sb.from("patient").select("id,name,species,breed,sex,birth_date,note");
const p = pets.find((x) => x.name === (process.env.PET || "슈슈"));

const { data: visits } = await sb.from("visit")
  .select("visit_date, chief_complaint, note, report_comment, prescription(dose,frequency,duration,drug:drug_id(name))")
  .eq("patient_id", p.id).order("visit_date", { ascending: false });
const { data: logs } = await sb.from("life_log")
  .select("logged_on,appetite,stool,energy,weight_kg,meds,note").eq("patient_id", p.id)
  .gte("logged_on", new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)).order("logged_on", { ascending: false });
const { data: intakes } = await sb.from("life_intake").select("label,started_on,stopped_on").eq("patient_id", p.id);
const { data: adm } = await sb.from("admission").select("admitted_at,status").eq("patient_id", p.id).eq("status","admitted").limit(1);
const { data: past } = await sb.from("chat_message").select("role,content,created_at")
  .eq("patient_id", p.id).order("created_at", { ascending: false }).limit(20);

const ctx = [
  `# ${p.name}`, `${p.species} · ${p.breed} · ${p.sex} · ${p.birth_date} 생`, `오늘 날짜: ${new Date().toISOString().slice(0, 10)}`,
  /사망|무지개|떠났|안락사/.test(p.note ?? "")
    ? `\n## ⚠️⚠️ **${p.name}는 이미 세상을 떠났다** (${p.note})\n살아 있는 것처럼 말하지 않는다. 지금 상태·다음 진료·먹이는 것을 말하지 않고, 「오세요」·「예약」·「지켜보세요」 는 어느 것도 하지 않는다. 보호자가 지난 일을 물으면 기록에 있는 것만 답한다.`
    : adm?.length ? `\n## ⚠️ 지금 우리 병원에 입원 중이다 (${adm[0].admitted_at} 입원)` : "\n지금 입원 중이 아니다.",
  "\n## 진료 기록 (최근 순)",
  ...visits.map((v) => `\n### ${v.visit_date} — ${v.chief_complaint}\n진료 원문: ${v.note}\n보호자 코멘트: ${v.report_comment}` +
    (v.prescription?.length ? `\n처방: ${v.prescription.map((r)=>[r.drug?.name,r.dose,r.frequency].filter(Boolean).join(" ")).join(" / ")}` : "")),
  `\n최근 30일 내 우리 처방: 없음`,
  "\n## 생활기록 (최근 1년)",
  ...logs.map((l) => `- ${l.logged_on}: 식사 ${l.appetite} · 배변 ${l.stool} · 활력 ${l.energy} · ${l.weight_kg}kg`),
  "\n## 먹이는 것", ...(intakes.length ? intakes.map((i)=>`- ${i.label} (${i.started_on}~${i.stopped_on ?? ""})`) : ["등록된 것 없음"]),
  ...(past?.length ? ["\n## 지난 대화 (최근 것만)",
    ...past.slice().reverse().map((m)=>`- ${m.created_at.slice(0,10)} ${m.role==="user"?"보호자":"우리"}: ${m.content.replace(/\s+/g," ").slice(0,300)}`),
    "⚠️ 지난번에 우리가 한 말과 어긋나지 않게 답한다. 같은 것을 또 묻지 않는다."] : []),
].join("\n");
console.log(`[컨텍스트 ${ctx.length}자 · 회차 ${visits.length} · 생활기록 ${logs.length}일]\n`);

const c = new Anthropic();
for (const q of process.argv.slice(2)) {
  const t0 = Date.now();
  // ⚠️ **분류도 같이 받는다.** 답변 문장만 보면 안 된다 — 「여쭤보고 알려드릴게요」 라고 써 놓고
  // 분류가 asking 으로 나가면 원장님 화면에 안 뜨고, 그러면 그 말이 거짓말이 된다.
  const r = await c.messages.create({
    model: "claude-opus-5", max_tokens: 8000,
    output_config: {
      effort: process.env.EFFORT || "low",
      format: { type: "json_schema", schema: {
        type: "object",
        properties: {
          triage: { type: "string", enum: ["now","tomorrow","primary","ask_vet","asking","out_of_scope"] },
          text: { type: "string" },
        },
        required: ["triage", "text"], additionalProperties: false,
      } },
    },
    system: [{ type: "text", text: SYSTEM }, { type: "text", text: `<기록>\n${ctx}\n</기록>`, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: q }],
  });
  const { triage, text } = JSON.parse(r.content.filter(b=>b.type==="text").map(b=>b.text).join(""));
  console.log("──────────\nQ:", q, `\n\n[분류: ${triage}]\n\nA:`, text,
    `\n\n[in ${r.usage.input_tokens}+cache${r.usage.cache_creation_input_tokens+r.usage.cache_read_input_tokens} / out ${r.usage.output_tokens}]\n`);
}
process.exit(0);
