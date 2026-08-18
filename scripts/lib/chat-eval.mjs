/**
 * chat-eval.mjs — 채팅을 앱 없이 돌려 보는 공통 부품.
 * `try-chat.mjs`(한 마리 눈으로 보기) 와 `eval-scenarios.mjs`(69명 전수) 가 같이 쓴다.
 *
 * ⚠️ **갈라지면 안 된다.** 평가 스크립트가 제 나름대로 프롬프트를 조립하기 시작하면
 * 그때부터 "무엇을 검증한 건지"를 아무도 모른다. 실제로 겪었다 —
 * `try-chat` 의 프롬프트 잘라내기가 CRLF 에서 조용히 깨져 파일 전체가 프롬프트로 들어가고 있었고,
 * 그 상태로 「검증했다」고 말했다.
 *
 * ⚠️ 컨텍스트 조립은 `src/lib/chat/context.ts` 의 **근사치**다 (검진·처방 요약이 빠져 있다).
 * 여기서 보는 건 "이 프롬프트가 이 기록을 보고 어떻게 답하나" 하나뿐이다.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

export const PHONE = "02-2039-0303";
const ACTIONS = "src/app/portal/patients/[id]/chat/actions.ts";

export function loadEnv() {
  for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const i = l.indexOf("=");
    if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
}

/**
 * `actions.ts` 의 프롬프트를 **그대로 읽어 온다** — 베껴 두면 검증이 아니다.
 * ⚠️ 정규식으로 잡는다. 예전엔 `indexOf("`;\n\nexport async function ask")` 였는데
 * 윈도우의 CRLF 에서 안 맞아 `-1` 이 나오고 파일 끝까지 통째로 딸려 들어갔다.
 */
export function loadPrompts() {
  const src = fs.readFileSync(ACTIONS, "utf8");
  const grab = (name) => {
    const m = src.match(new RegExp("const " + name + " = `([\\s\\S]*?)`;"));
    if (!m) throw new Error(`${name} 을 ${ACTIONS} 에서 못 찾았다 — 잘라내기가 깨졌다`);
    return m[1].replaceAll("${HOSPITAL_PHONE}", PHONE);
  };
  const SYSTEM = grab("SYSTEM");
  // 잘라낸 게 맞는지 여기서 걸린다. 조용히 틀리느니 멈추는 게 낫다.
  if (SYSTEM.includes("export async function") || SYSTEM.includes("면회 시간")) {
    throw new Error("SYSTEM 에 코드나 입원 블록이 섞였다 — 잘라내기가 또 깨졌다");
  }
  return { SYSTEM, ADMISSION_TAB: grab("ADMISSION_TAB"), POLISH_SYSTEM: grab("POLISH_SYSTEM") };
}

export async function signIn() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { error } = await sb.auth.signInWithPassword({ email: "1@example.com", password: "1234" });
  if (error) throw new Error("로그인 실패: " + error.message);
  return sb;
}

/**
 * 직원 세션 — `patient_caution` 을 읽으려면 필요하다(그 표는 직원 전용이다).
 * ⚠️ 앱은 service-role 로 읽는다. 여기서 직원으로 읽는 건 **같은 글이 프롬프트에 들어갔을 때
 * 모델이 그걸 인용하는지**를 보기 위해서다 — 위험한 건 읽는 경로가 아니라 나가는 문장이다.
 */
let staffSb = null;
export async function signInStaff() {
  if (staffSb) return staffSb;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error } = await sb.auth.signInWithPassword({
    email: "staff@sdhospital.test", password: "sdhospital123!",
  });
  if (error) throw new Error("직원 로그인 실패: " + error.message);
  staffSb = sb;
  return sb;
}

export const GONE = /사망|무지개|떠났|폐사|안락사/;

/** `src/lib/admission-report.ts` 의 보호자용 문장. 갈라지면 앱과 다른 걸 시험하게 된다 */
const FEEDING = {
  well: "밥을 잘 먹었어요", some: "평소보다 조금 먹었어요", little: "오늘은 거의 먹지 않았어요",
  assist: "직접 먹지 않아 도와서 먹였어요", npo: "치료 일정 때문에 금식했어요",
};
const ELIMINATION = {
  normal: "대소변 모두 정상이었어요", loose: "변이 묽었어요", none: "오늘은 변을 보지 않았어요",
  urine_only: "소변만 봤어요", blood: "대소변에 피가 비쳐 확인 중이에요",
};

/**
 * 그 아이의 기록을 **기준일 시점으로** 조립한다.
 * ⚠️ 기준일 이후는 전부 뺀다 — 안 빼면 채팅이 미래를 알고 답해서 시나리오가 무의미해진다.
 */
export async function buildContext(sb, p, today) {
  const ago = (d) => new Date(Date.parse(`${today}T00:00:00Z`) - d * 864e5).toISOString().slice(0, 10);

  const [{ data: visits }, { data: logs }, { data: intakes }, { data: adms }, { data: past }] =
    await Promise.all([
      sb.from("visit")
        .select("visit_date, chief_complaint, note, report_comment, prescription(dose,frequency,duration,drug:drug_id(name))")
        .eq("patient_id", p.id).lte("visit_date", today).order("visit_date", { ascending: false }),
      sb.from("life_log").select("logged_on,appetite,stool,energy,weight_kg,meds,note")
        .eq("patient_id", p.id).gte("logged_on", ago(365)).lte("logged_on", today)
        .order("logged_on", { ascending: false }),
      sb.from("life_intake").select("label,started_on,stopped_on")
        .eq("patient_id", p.id).lte("started_on", today),
      // 앱과 같이 **날짜로** 판정한다 (`status` 컬럼이 아니라) — 안 그러면 기준일을 옮겨도 입원 중이 안 된다
      // ⚠️ **일일 리포트를 같이 읽는다.** 앱은 읽는데 여기서 빠뜨려 놨었고,
      // 그래서 「오늘 밥 먹었나요」를 시험하면 앱과 다른 답이 나왔다.
      sb.from("admission")
        .select("admitted_at,discharged_at,admission_report(report_date,comment,feeding,elimination,special,sent_at)")
        .eq("patient_id", p.id).lte("admitted_at", today).order("admitted_at", { ascending: false }),
      sb.from("chat_message").select("role,content,created_at")
        .eq("patient_id", p.id).order("created_at", { ascending: false }).limit(20),
    ]);

  // 그 집의 사정 — `context` 만. `confirm` 은 읽지 않는다(그 아이는 앱에서 채팅이 잠긴다).
  const staff = await signInStaff();
  const { data: cautions } = await staff
    .from("patient_caution").select("body")
    .eq("patient_id", p.id).eq("kind", "context").is("resolved_at", null);

  const here = (adms ?? []).filter((a) => !a.discharged_at || a.discharged_at >= today);
  const gone = GONE.test(p.note ?? "");
  // 최근 30일 내 우리 처방 — "우리가 준 약" 신호. 앱이 넣는 줄이라 여기도 넣는다.
  const rx = [...new Set((visits ?? [])
    .filter((v) => v.visit_date >= ago(30))
    .flatMap((v) => (v.prescription ?? []).map((r) => r.drug?.name).filter(Boolean)))];

  const text = [
    `# ${p.name}`,
    `${p.species} · ${p.breed} · ${p.sex} · ${p.birth_date} 생`,
    `오늘 날짜: ${today}`,
    // ⚠️ 앱(`context.ts`)과 같은 줄이다. 여기만 빠지면 시험은 통과하는데 앱은 틀린다.
    p.origin === "regular"
      ? "⚠️ **이 아이는 의뢰받은 환자가 아니라 우리 단골이다 — 우리가 그 1차 병원이다.**\n「1차 병원에 연락해 보세요」·「의뢰해 주신 병원」이라는 말을 쓰지 않는다. 갈 곳이 여기다.\n경미한 것도 우리가 본다 — 다만 급하지 않으면 예약해서 오시게 하면 된다."
      : "이 아이는 1차 병원이 의뢰한 환자다 — 경미한 것은 그 병원에서 보는 것이 맞다.",
    gone
      ? `\n## ⚠️⚠️ **${p.name}는 이미 세상을 떠났다** (${p.note})\n살아 있는 것처럼 말하지 않는다. 지금 상태·다음 진료·먹이는 것을 말하지 않고, 「오세요」·「예약」·「지켜보세요」 는 어느 것도 하지 않는다. 보호자가 지난 일을 물으면 기록에 있는 것만 답하고, 그 외에는 담당 선생님께 넘긴다.`
      : here.length
        ? `\n## ⚠️ 지금 **우리 병원에 입원 중**이다 (${here[0].admitted_at} 입원)\n보호자는 집에 없는 아이의 지금 상태를 묻고 있다. **「지금 오세요」는 틀린 답이다.**\n⚠️ **입원 중이면 일일 리포트는 있는 것이 정상이다** — 우리가 매일 식사·배변을 적어 보낸다.\n아래 「입원 이력」에서 그날 리포트를 먼저 찾는다. **있으면 그게 답이고 넘기지 않는다.**\n없으면 아직 직원이 적지 않은 것뿐이라 담당자에게 넘기되, **그 사정을 보호자에게 설명하지 않는다** —\n「확인해서 알려드릴게요」까지가 끝이다.`
        : "\n지금 입원 중이 아니다.",
    "\n## 입원 이력",
    ...(adms ?? []).flatMap((a) => [
      `\n### ${a.admitted_at} ~ ${a.discharged_at ?? "입원 중"}`,
      // 보호자에게 **이미 나간** 문장만. 기준일 뒤의 리포트는 뺀다.
      ...(a.admission_report ?? [])
        .filter((r) => r.sent_at && r.report_date <= today &&
          (r.comment || r.feeding || r.elimination || r.special))
        .sort((x, y) => (x.report_date < y.report_date ? 1 : -1))
        .slice(0, 8)
        .map((r) => `- ${r.report_date}: ` + [
          FEEDING[r.feeding], ELIMINATION[r.elimination], r.special?.trim(), r.comment?.trim(),
        ].filter(Boolean).join(" / ")),
    ]),
    "\n## 진료 기록 (최근 순)",
    ...(visits ?? []).map((v) =>
      `\n### ${v.visit_date} — ${v.chief_complaint ?? "(주 증상 미기재)"}` +
      (v.note ? `\n진료 원문: ${v.note}` : "") +
      (v.report_comment ? `\n보호자에게 나간 코멘트: ${v.report_comment}` : "") +
      ((v.prescription ?? []).length
        ? `\n처방: ${v.prescription.map((r) => [r.drug?.name, r.dose, r.frequency].filter(Boolean).join(" ")).join(" / ")}`
        : "")),
    `\n최근 30일 내 우리 처방: ${rx.length ? rx.join(", ") : "없음"}`,
    "\n## 생활기록 (보호자가 집에서 남긴 것, 최근 1년)",
    ...((logs ?? []).length
      ? logs.map((l) => `- ${l.logged_on}: 식사 ${l.appetite} · 배변 ${l.stool} · 활력 ${l.energy} · ${l.weight_kg ?? "-"}kg`)
      : ["기록 없음 — 평소를 모른다. 「평소보다」라는 말을 쓰지 말 것."]),
    "\n## 먹이는 것",
    ...((intakes ?? []).length
      ? intakes.map((i) => `- ${i.label} (${i.started_on}~${i.stopped_on ?? ""})`)
      : ["등록된 것 없음"]),
    ...((past ?? []).length
      ? ["\n## 지난 대화 (최근 것만)",
         ...past.slice().reverse().map((m) => `- ${m.created_at.slice(0, 10)} ${m.role === "user" ? "보호자" : "우리"}: ${m.content.replace(/\s+/g, " ").slice(0, 300)}`),
         "⚠️ 지난번에 우리가 한 말과 어긋나지 않게 답한다. 같은 것을 또 묻지 않는다."]
      : []),
  ].join("\n");

  return { text, gone, admittedNow: here.length > 0, visits: visits ?? [], adms: adms ?? [], rx, logs: logs ?? [] };
}

const SCHEMA = {
  type: "object",
  properties: {
    triage: { type: "string", enum: ["now", "tomorrow", "primary", "ask_vet", "asking", "out_of_scope"] },
    text: { type: "string" },
  },
  required: ["triage", "text"],
  additionalProperties: false,
};

/**
 * 앱과 같은 순서로 넣는다 — SYSTEM · (입원 중이면) 입원 블록 · 기록.
 * ⚠️ `tab` 은 **입원 중일 때만** 넘긴다. 앱에도 탭 UI 가 없고 `ctx.admittedAt` 이 정한다 —
 * 여기서 임의로 고르면 앱이 안 하는 조합을 검증하게 된다.
 */
export async function askOnce(anthropic, { system, tab, context, question, effort = "low" }) {
  const r = await anthropic.messages.create({
    model: process.env.CHAT_MODEL || "claude-opus-5",
    max_tokens: 8000,
    output_config: { effort, format: { type: "json_schema", schema: SCHEMA } },
    system: [
      { type: "text", text: system },
      ...(tab ? [{ type: "text", text: tab }] : []),
      { type: "text", text: `<기록>\n${context}\n</기록>`, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: question }],
  });
  const out = JSON.parse(r.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
  return { ...out, usage: r.usage };
}
