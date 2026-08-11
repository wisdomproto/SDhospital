import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { kstToday } from "@/lib/worklist";
import { choiceOf, shiftDate, isActive, FIELDS, type Intake, type LifeLog } from "@/lib/life-log";
import { loadCheckup } from "@/lib/checkup/load";
import { VERDICT_LABEL } from "@/lib/checkup/evaluate";

type Client = SupabaseClient<Database>;

/**
 * 채팅이 읽는 그 아이의 전부 — 진료 회차 · 처방 · 검진 · 생활기록을 한 덩어리 글로 만든다.
 *
 * ⚠️ **이 글은 보호자에게 보이지 않는다.** 모델이 읽고 판단하는 재료일 뿐이고,
 * 원문을 그대로 옮기지 않는 책임은 시스템 프롬프트(`ask` 액션)가 진다.
 * 여기서 미리 잘라내면 모델이 "우리가 수술한 부위"인지도 모르고 경미로 내려버린다.
 *
 * ⚠️ **의료영상은 넣지 않는다** — 판독 소견은 요청·승인을 거쳐야 나가는 것이라
 * 채팅이 우회로가 되면 안 된다.
 */
export async function buildPatientContext(supabase: Client, patientId: string) {
  const today = kstToday();

  const { data: p } = await supabase
    .from("patient")
    .select("id, name, species, breed, sex, birth_date")
    .eq("id", patientId)
    .single();
  if (!p) return null;

  const [{ data: visits }, { data: checkups }, { data: logs }, { data: intakes }] = await Promise.all([
    supabase
      .from("visit")
      .select(
        "id, visit_date, chief_complaint, note, report_comment, prescription(dose, frequency, duration, drug:drug_id(name))"
      )
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false })
      .limit(15),
    supabase
      .from("checkup")
      .select("id, checked_on")
      .eq("patient_id", patientId)
      .order("checked_on", { ascending: false })
      .limit(2),
    supabase
      .from("life_log")
      .select("logged_on, appetite, stool, energy, weight_kg, meds, note")
      .eq("patient_id", patientId)
      .gte("logged_on", shiftDate(today, -30))
      .order("logged_on", { ascending: false }),
    supabase
      .from("life_intake")
      .select("id, label, photo_path, started_on, stopped_on")
      .eq("patient_id", patientId)
      .order("started_on", { ascending: false }),
  ]);

  const lines: string[] = [];
  lines.push(`# ${p.name}`);
  lines.push(
    [p.species, p.breed, p.sex, p.birth_date && `${p.birth_date} 생`].filter(Boolean).join(" · ")
  );
  lines.push(`오늘 날짜: ${today}`);

  lines.push("\n## 진료 기록 (최근 순)");
  for (const v of visits ?? []) {
    lines.push(`\n### ${v.visit_date} — ${v.chief_complaint ?? "(주 증상 미기재)"}`);
    if (v.note) lines.push(`진료 원문: ${v.note}`);
    if (v.report_comment) lines.push(`보호자에게 나간 코멘트: ${v.report_comment}`);
    const rx = (v.prescription ?? []) as Array<{
      dose: string | null;
      frequency: string | null;
      duration: string | null;
      drug: { name: string } | null;
    }>;
    if (rx.length) {
      lines.push(
        `처방: ${rx
          .map((r) => [r.drug?.name, r.dose, r.frequency, r.duration].filter(Boolean).join(" "))
          .join(" / ")}`
      );
    }
  }

  // 최근 30일 안에 처방이 살아 있으면 "우리가 준 약" 이다 — 경미로 내리면 안 되는 신호.
  const recentRx = (visits ?? [])
    .filter((v) => v.visit_date >= shiftDate(today, -30))
    .flatMap((v) => (v.prescription ?? []) as Array<{ drug: { name: string } | null }>)
    .map((r) => r.drug?.name)
    .filter(Boolean);
  lines.push(
    `\n최근 30일 내 우리 처방: ${recentRx.length ? [...new Set(recentRx)].join(", ") : "없음"}`
  );

  for (const c of checkups ?? []) {
    const loaded = await loadCheckup(supabase, c.id);
    if (!loaded) continue;
    lines.push(`\n## 건강검진 ${loaded.checkedOn}`);
    if (loaded.conclusion) lines.push(`종합 소견: ${loaded.conclusion}`);
    if (loaded.recheckOn) lines.push(`재검 예정일: ${loaded.recheckOn}`);
    const flagged = loaded.sections
      .flatMap((s) => s.values.map((v) => ({ s, v })))
      .filter(({ v }) => v.eval.verdict !== "normal" && v.eval.verdict !== "unknown");
    lines.push(
      flagged.length
        ? `참고범위를 벗어난 항목: ${flagged
            .map(({ v }) => `${v.item.label} ${v.raw}${v.item.unit ?? ""}(${VERDICT_LABEL[v.eval.verdict]})`)
            .join(", ")}`
        : "참고범위를 벗어난 항목 없음"
    );
  }

  lines.push("\n## 생활기록 (보호자가 집에서 남긴 것, 최근 30일)");
  const rows = (logs ?? []) as LifeLog[];
  if (!rows.length) lines.push("기록 없음 — 평소를 모른다. 「평소보다」라는 말을 쓰지 말 것.");
  for (const l of rows) {
    const parts = FIELDS.map((f) => {
      const c = choiceOf(f.key, l[f.key]);
      return c ? `${f.label} ${c.label}` : null;
    }).filter(Boolean);
    if (l.weight_kg != null) parts.push(`${l.weight_kg}kg`);
    if (l.note) parts.push(`메모: ${l.note}`);
    if (parts.length) lines.push(`- ${l.logged_on}: ${parts.join(" · ")}`);
  }

  const list = (intakes ?? []) as Intake[];
  lines.push("\n## 먹이는 것 (사료·간식·영양제·남의 병원 약을 구분하지 않는다)");
  lines.push(
    list.length
      ? list
          .map(
            (i) =>
              `- ${i.label ?? "(사진만 등록)"} — ${i.started_on} 시작${
                isActive(i, today) ? "" : ` / ${i.stopped_on} 중단`
              }`
          )
          .join("\n")
      : "등록된 것 없음"
  );
  lines.push(
    "\n⚠️ 이 목록은 낡을 수 있다. 먹는 것이 답에 영향을 준다면 지금도 맞는지 보호자에게 되물을 것."
  );

  const last = (visits ?? [])[0];
  return {
    patient: p,
    text: lines.join("\n"),
    logs: rows,
    recentRx: [...new Set(recentRx)] as string[],
    lastVisit: last ? { date: last.visit_date, complaint: last.chief_complaint } : null,
    checkupCount: (checkups ?? []).length,
  };
}

export type PatientContext = NonNullable<Awaited<ReturnType<typeof buildPatientContext>>>;

/**
 * 버튼으로 누를 질문 — 자유 서술은 부담이라 첫 화면에서 아무도 안 쓴다.
 * 그 아이의 기록에서 뽑는다. 남의 아이한테도 맞는 질문만 늘어놓으면 "나한테 하는 말"로 안 읽힌다.
 */
export function suggestQuestions(ctx: PatientContext): string[] {
  const qs: string[] = [];
  if (ctx.lastVisit?.complaint) {
    qs.push(`${ctx.lastVisit.date}에 「${ctx.lastVisit.complaint}」로 갔었는데, 지금은 어떤가요?`);
  }
  if (ctx.recentRx.length) qs.push("지금 먹이는 약을 먹고 토했어요. 다시 먹여야 하나요?");

  const bad = ctx.logs
    .slice(0, 7)
    .filter((l) => l.appetite && choiceOf("appetite", l.appetite)?.tone !== "good");
  if (bad.length >= 3) qs.push("요즘 밥을 잘 안 먹는데 병원에 가야 할까요?");

  if (ctx.checkupCount) qs.push("지난 검진 결과에서 신경 써야 할 게 있나요?");
  qs.push("지금 바로 병원에 가야 하는 신호는 뭔가요?");
  qs.push("숨쉬는 게 좀 가빠 보이는데 어떻게 하죠?");
  return qs.slice(0, 6);
}
