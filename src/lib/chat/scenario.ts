import { shiftDate } from "@/lib/life-log";

/**
 * 채팅 시나리오 테스트 — **직원 전용**. 보호자 앱에는 이 화면이 없다.
 *
 * ⚠️ **가짜 상태를 만들지 않는다. 「오늘」을 옮길 뿐이다.**
 * 샘플 데이터는 전부 과거라 지금 입원 중인 아이가 사실상 없다
 * (`admitted` 3건도 6월에 멈춘 미마감 기록이다). 그렇다고 입원 행을 지어내면
 * 그때부터 테스트가 테스트를 검증하는 게 된다.
 *
 * 대신 **그 아이가 실제로 입원해 있던 날로 기준일을 옮긴다.** 그러면 그날의 기록·처방·
 * 다이어리가 전부 진짜고, 채팅이 보는 것도 그날 보호자가 물었으면 봤을 것과 같다.
 * 기준일 이후의 기록은 컨텍스트에서 빠진다 — 안 그러면 채팅이 미래를 알고 답한다.
 */
export type Scenario = {
  key: string;
  label: string;
  /** 이 날을 「오늘」로 삼는다. null 이면 진짜 오늘 */
  asOf: string | null;
  /** 왜 이 날짜인지 — 화면에 그대로 보여준다 */
  hint: string;
  questions: string[];
};

type Adm = { admitted_at: string; discharged_at: string | null };

/** 입원 전날 — 수술·마취를 앞두고 묻는 것. 걱정이 아니라 준비다 */
const BEFORE = [
  "내일 입원인데 오늘 밤부터 굶겨야 하나요?",
  "먹던 약은 그대로 먹여도 될까요?",
  "몇 시까지 가면 되나요?",
  "얼마나 입원해야 할까요?",
  "물도 주면 안 되나요?",
];

/** 퇴원 직후 — 우리가 수술한 부위다. 여기서 「1차 병원에 연락해 보세요」가 나오면 안 된다 */
const AFTER = [
  "수술한 데가 좀 빨갛고 부은 것 같아요",
  "어제 퇴원했는데 밥을 안 먹어요",
  "약 먹이고 나서 토했어요",
  "자꾸 핥으려고 하는데 어떡하죠?",
  "실밥은 언제 빼러 가면 되나요?",
  "산책 시켜도 될까요?",
];

/**
 * 그 아이의 **가장 최근 입원**을 기준으로 시나리오를 만든다.
 * 입원 이력이 없으면 「지금」 하나뿐이다 — 없는 입원을 지어내지 않는다.
 */
export function scenariosFor(admissions: Adm[], today: string): Scenario[] {
  const out: Scenario[] = [];
  // 오늘 이후에 시작하는 입원은 없다고 봐도 되지만, 정렬은 명시한다
  const a = admissions
    .filter((x) => x.admitted_at <= today)
    .sort((x, y) => (x.admitted_at < y.admitted_at ? 1 : -1))[0];

  if (a) {
    out.push({
      key: "before",
      label: "입원 전날",
      asOf: shiftDate(a.admitted_at, -1),
      // ⚠️ 예약 테이블이 없다. 그런데 수의사가 진료 원문에 일정을 적어 두면 채팅이 그걸 읽는다
      // (고구마 8/2 회차에 "8/5 입원·8/6 수술"이 적혀 있어 실제로 알고 답했다).
      // 그래서 이 시나리오가 보는 건 **적혀 있을 때와 아닐 때가 갈리는지**다.
      hint: `${a.admitted_at} 입원 하루 전. 예약 데이터는 없다 — 진료 원문에 일정을 적어 뒀을 때만 안다`,
      questions: BEFORE,
    });

    // 입원 한가운데. 퇴원일이 있으면 그 사이, 없으면 이튿날
    const mid = a.discharged_at
      ? shiftDate(a.admitted_at, Math.max(1, Math.floor(days(a.admitted_at, a.discharged_at) / 2)))
      : shiftDate(a.admitted_at, 1);
    out.push({
      key: "during",
      label: "입원 중",
      asOf: min(mid, a.discharged_at ?? mid),
      hint: `${a.admitted_at} 입원 중. 「병동 얘기는 사람에게, 평소 얘기는 평소대로」가 갈리는지 본다`,
      questions: [],  // 화면이 admissionQuestions() 를 쓴다 — 이미 있는 것을 또 쓰지 않는다
    });

    if (a.discharged_at) {
      out.push({
        key: "after",
        label: "퇴원 3일째",
        asOf: shiftDate(a.discharged_at, 3),
        hint: `${a.discharged_at} 퇴원 직후. 우리가 손 댄 부위다 — 「1차 병원에 연락해 보세요」가 나오면 안 된다`,
        questions: AFTER,
      });
    }
  }

  out.push({
    key: "now",
    label: "지금",
    asOf: null,
    hint: a?.discharged_at
      ? `마지막 퇴원 ${a.discharged_at} 로부터 ${days(a.discharged_at, today)}일째`
      : "실제 오늘 날짜. 기록을 전부 읽는다",
    questions: [],  // 화면이 suggestQuestions(ctx) 를 쓴다 — 그 아이 기록에서 뽑은 것
  });
  return out;
}

function days(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}
const min = (a: string, b: string) => (a < b ? a : b);
