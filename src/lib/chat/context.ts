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
/**
 * 지난 대화에서 컨텍스트에 넣는 **턴 수**. 개수를 고정하는 게 요점이다 —
 * 대화가 천 건 쌓여도 읽는 건 이만큼이라 3년 뒤에도 비용이 그대로다.
 * 오래된 것은 나중에 「그 집의 카드」가 대신한다.
 */
const RECENT_TURNS = 20;
const RECENT_CHARS = 6000;

export async function buildPatientContext(
  supabase: Client,
  patientId: string,
  /** 지금 진행 중인 대화는 빼고 읽는다 — 그건 이미 messages 로 들어간다 */
  exceptThreadId?: string,
  /**
   * 「오늘」을 다른 날로 놓고 본다 (직원 시나리오 테스트 전용, `lib/chat/scenario.ts`).
   * ⚠️ **이 날짜 이후의 기록은 전부 뺀다** — 안 그러면 채팅이 미래를 알고 답해서
   * 「그날 물었으면 어떻게 답했나」를 못 본다.
   */
  asOf?: string | null
) {
  const today = asOf ?? kstToday();

  const { data: p } = await supabase
    .from("patient")
    .select("id, name, species, breed, sex, birth_date, note")
    .eq("id", patientId)
    .single();
  if (!p) return null;

  const [
    { data: admissions },
    { data: visits },
    { data: checkups },
    { data: logs },
    { data: intakes },
    { data: past },
  ] = await Promise.all([
    // 입원 이력 전부. **지금 입원 중인지**를 모르면 병원에 누워 있는 아이한테 "오세요" 라고 하고,
    // **지난 입원을 모르면** 그 아이를 아는 척할 수가 없다 — 며칠을 어떻게 보냈는지가 주치의의 기억이다.
    // ⚠️ 일일 리포트는 이미 보호자에게 나간 문장이라 인용해도 안전하다.
    // 바이털 수치(`vital`)는 읽지 않는다 — 38.4 는 안심을 주지 못하고 검색 후 더 불안해진다.
    supabase
      .from("admission")
      .select("admitted_at, discharged_at, status, note, admission_report(report_date, comment, sent_at)")
      .eq("patient_id", patientId)
      .lte("admitted_at", today)
      .order("admitted_at", { ascending: false }),
    supabase
      .from("visit")
      .select(
        "id, visit_date, chief_complaint, note, report_comment, prescription(dose, frequency, duration, drug:drug_id(name))"
      )
      .eq("patient_id", patientId)
      .lte("visit_date", today)
      .order("visit_date", { ascending: false }),
    supabase
      .from("checkup")
      .select("id, checked_on")
      .eq("patient_id", patientId)
      .lte("checked_on", today)
      .order("checked_on", { ascending: false }),
    supabase
      .from("life_log")
      .select("logged_on, appetite, stool, energy, weight_kg, meds, note")
      .eq("patient_id", patientId)
      .gte("logged_on", shiftDate(today, -365))
      .lte("logged_on", today)
      .order("logged_on", { ascending: false }),
    supabase
      .from("life_intake")
      .select("id, label, photo_path, started_on, stopped_on")
      .eq("patient_id", patientId)
      .lte("started_on", today)
      .order("started_on", { ascending: false }),
    // 지난 대화. **개수를 고정한다** — 쌓이는 건 무한이지만 읽는 건 늘 이만큼이다.
    supabase
      .from("chat_message")
      .select("thread_id, role, content, triage, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(RECENT_TURNS * 2), // 지금 대화를 걸러낼 여유
  ]);

  const lines: string[] = [];
  lines.push(`# ${p.name}`);
  lines.push(
    [p.species, p.breed, p.sex, p.birth_date && `${p.birth_date} 생`].filter(Boolean).join(" · ")
  );
  lines.push(`오늘 날짜: ${today}`);

  // ⚠️ **떠난 아이는 여기서 먼저 말한다.** 기록이 어느 시점에 멈춰 있는지 채팅은 알 수 없고,
  // 살아 있는 것처럼 답하는 순간 그 보호자에게는 그게 전부가 된다. 실제로 그런 기록이 있다.
  const gone = /사망|무지개|떠났|폐사|안락사/.test(p.note ?? "");
  if (gone) {
    lines.push(
      `\n## ⚠️⚠️ **${p.name}는 이미 세상을 떠났다** (${p.note})\n` +
        "**살아 있는 것처럼 말하지 않는다.** 지금 상태·다음 진료·먹이는 것을 말하지 않고,\n" +
        "「오세요」·「예약」·「지켜보세요」 는 어느 것도 하지 않는다.\n" +
        "보호자가 지난 일을 물으면 기록에 있는 것만 답하고, 그 외에는 담당 선생님께 넘긴다."
    );
  }
  type Adm = {
    admitted_at: string;
    discharged_at: string | null;
    status: string;
    note: string | null;
    admission_report: { report_date: string; comment: string | null; sent_at: string | null }[] | null;
  };
  const adms = (admissions ?? []) as Adm[];
  // ⚠️ `status` 가 아니라 **날짜로 판정한다.** 기준일을 옮기는 시나리오 테스트에서
  // 컬럼을 믿으면 「그날 입원 중이었다」가 안 나온다. 미마감 기록(퇴원일 없음)은
  // 컬럼을 봤을 때와 똑같이 계속 입원 중으로 잡힌다 — 거기서 달라지는 건 없다.
  const now = adms.find((a) => a.admitted_at <= today && (!a.discharged_at || a.discharged_at >= today));

  lines.push(
    now
      ? `\n## ⚠️ 지금 **우리 병원에 입원 중**이다 (${now.admitted_at} 입원)\n` +
        "보호자는 집에 없는 아이의 지금 상태를 묻고 있다. **「지금 오세요」는 틀린 답이다.**\n" +
        "병동의 현재 상황은 채팅이 모른다 — 지어내지 말고 담당자에게 넘긴다."
      : "\n지금 입원 중이 아니다."
  );

  if (adms.length) {
    lines.push("\n## 입원 이력");
    for (const a of adms) {
      const days = a.discharged_at
        ? Math.round((Date.parse(a.discharged_at) - Date.parse(a.admitted_at)) / 864e5) + 1
        : null;
      lines.push(
        `\n### ${a.admitted_at}${a.discharged_at ? ` ~ ${a.discharged_at} (${days}일)` : " ~ 입원 중"}` +
          (a.note ? `\n${a.note}` : "")
      );
      // 보호자에게 이미 나간 문장만 — 미발송 리포트는 아직 우리끼리의 메모다.
      // 기준일 뒤의 리포트도 뺀다 (입원 3일째에 5일째 경과가 보이면 안 된다)
      const sent = (a.admission_report ?? []).filter(
        (r) => r.sent_at && r.comment && r.report_date <= today
      );
      for (const r of sent.slice(0, 8)) lines.push(`- ${r.report_date}: ${r.comment}`);
    }
  }

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

  lines.push("\n## 생활기록 (보호자가 집에서 남긴 것, 최근 1년)");
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

  // ── 지난 대화 ──────────────────────────────────────────────────────────────
  // 진료 기록은 "무슨 병이었나" 를, 대화는 **"이 집이 어떤 집인가"** 를 남긴다.
  // ⚠️ 여기 들어가는 건 우리가 그 집에 실제로 한 말이다 — 지난번과 다른 소리를 하면 그때 신뢰가 깨진다.
  type Msg = { thread_id: string; role: string; content: string; triage: string | null; created_at: string };
  const older = ((past ?? []) as Msg[])
    .filter((m) => m.thread_id !== exceptThreadId)
    .slice(0, RECENT_TURNS)
    .reverse(); // 오래된 것부터 읽히게
  if (older.length) {
    lines.push("\n## 지난 대화 (최근 것만)");
    let used = 0;
    for (const m of older) {
      const who = m.role === "user" ? "보호자" : "우리";
      const line = `- ${m.created_at.slice(0, 10)} ${who}: ${m.content.replace(/\s+/g, " ").slice(0, 300)}`;
      used += line.length;
      if (used > RECENT_CHARS) {
        lines.push("- (이전 대화는 생략)");
        break;
      }
      lines.push(line);
    }
    lines.push(
      "⚠️ 지난번에 우리가 한 말과 어긋나지 않게 답한다. 같은 것을 또 묻지 않는다."
    );
  }

  const last = (visits ?? [])[0];
  return {
    patient: p,
    text: lines.join("\n"),
    logs: rows,
    recentRx: [...new Set(recentRx)] as string[],
    lastVisit: last ? { date: last.visit_date, complaint: last.chief_complaint } : null,
    checkupCount: (checkups ?? []).length,
    /** 입원 중이면 채팅방 위에 탭이 생긴다 — 아니면 탭 자체가 없다 */
    admittedAt: now?.admitted_at ?? null,
  };
}

export type PatientContext = NonNullable<Awaited<ReturnType<typeof buildPatientContext>>>;

/**
 * 버튼으로 누를 질문 — 자유 서술은 부담이라 첫 화면에서 아무도 안 쓴다.
 * 그 아이의 기록에서 뽑는다. 남의 아이한테도 맞는 질문만 늘어놓으면 "나한테 하는 말"로 안 읽힌다.
 */
export function suggestQuestions(ctx: PatientContext): string[] {
  // ⚠️⚠️ **떠난 아이한테 「지금도 괜찮을까요」를 물으라고 띄우지 않는다.**
  // 컨텍스트에서는 사망을 막아 놨는데 **버튼은 그 검사를 안 거치고 있었다** —
  // `chief_complaint` 를 인용하던 시절엔 「2025-07-28에 「안락사」로 갔었는데 지금도
  // 괜찮을까요?」가 실제로 뜰 수 있었다. 그 집에 오는 질문은 다른 것이다.
  if (/사망|무지개|떠났|폐사|안락사/.test(ctx.patient.note ?? "")) {
    return [
      "그때 왜 그렇게 된 건지 다시 한번 알려주실 수 있을까요?",
      "그때 받았던 검사 결과 다시 볼 수 있나요?",
      "진료 기록 사본을 받을 수 있을까요?",
    ];
  }

  // ⚠️ **실제 보호자가 쓰는 말투로 적는다.** 상담 466건을 보면 병원 말투로 묻지 않는다 —
  // "괜찮을까요?" · "지켜봐도 되겠죠?" · "가야 할까요?" 가 압도적이다.
  // 버튼이 병원 말투면 "나한테 하는 말"로 안 읽히고, 그러면 아무도 안 누른다.
  const qs: string[] = [];
  // ⚠️ **주 증상을 인용하지 않는다. 날짜만 쓴다.**
  // `chief_complaint` 는 직원이 EMR 에 쓰는 말이라 보호자용이 아니다. 실제 값이 이렇다 —
  // 「검사자료(더케이동물병원)」(24건, 최다) · 「정형외과) Lt.TPLO/수술1일」 · 「안락사」
  // · 「폐사진단서 발송」 · 「치료비 정산」. **다른 병원 이름이 제일 많고, 그다음이 사망 관련이다.**
  // 걸러 쓰려고 화이트리스트를 짜 봤지만 69명 중 통과가 12명이고 그 안에 「안락사」가 들어 있었다.
  // 쓸 만한 건 3개뿐이라 **덜 구체적인 쪽을 택했다** — 날짜만으로도 그 아이 얘기인 건 전해진다.
  if (ctx.lastVisit) qs.push(`${ctx.lastVisit.date}에 다녀왔는데 지금도 괜찮을까요?`);
  if (ctx.recentRx.length) qs.push("약 먹이고 나서 토했는데 다시 먹여도 될까요?");

  const bad = ctx.logs
    .slice(0, 7)
    .filter((l) => l.appetite && choiceOf("appetite", l.appetite)?.tone !== "good");
  if (bad.length >= 3) qs.push("요즘 밥을 잘 안 먹는데 좀 더 지켜봐도 될까요?");

  if (ctx.checkupCount) qs.push("지난 검진 결과에서 신경 써야 할 게 있나요?");
  qs.push("우리 애 전반적으로 건강 상태 좀 알려줘");
  qs.push("토하고 나서 기운없이 누워있어요");
  return qs.slice(0, 6);
}

/**
 * 입원 중일 때만 쓰는 질문들. **평소 질문과 섞지 않는다** —
 * 아이가 병원에 있는 동안 보호자가 궁금한 건 좁고 매일 같다.
 */
export function admissionQuestions(): string[] {
  return [
    "오늘은 좀 어떤가요? 밥은 먹었을까요?",
    "면회 가도 될까요?",
    "오늘 사진 볼 수 있을까요?",
    "언제쯤 퇴원할 수 있을까요?",
    "밤에 잘 잤는지 궁금해요",
  ];
}
