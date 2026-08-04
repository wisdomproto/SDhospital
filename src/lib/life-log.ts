/**
 * 생활기록 — 보호자가 남기는 평소.
 *
 * 입원 일일 리포트(`admission-report.ts`)와 같은 이유로 **자유 서술이 아니라 정해진 선택지**다.
 * 다만 고르는 사람이 다르다 — 저쪽은 간호사고 여기는 보호자라, 문구가 병원 말이 아니어야 한다.
 * 키는 가능한 한 저쪽과 맞춰 둔다. 수의사가 두 화면을 나란히 볼 때 같은 말이 같은 뜻이어야 한다.
 *
 * ⚠️ 전부 선택이다. 하나만 골라도 저장된다 — 매일 다 채우게 하면 몇 주 만에 끊긴다.
 */

export type Tone = "good" | "watch" | "alert";
export type Choice = { key: string; label: string; tone: Tone; hint?: string };

export const APPETITE: readonly Choice[] = [
  { key: "well", label: "평소만큼", tone: "good" },
  { key: "some", label: "조금 남김", tone: "watch" },
  { key: "little", label: "거의 안 먹음", tone: "watch" },
  { key: "none", label: "아예 안 먹음", tone: "alert" },
] as const;

export const STOOL: readonly Choice[] = [
  { key: "normal", label: "정상", tone: "good" },
  { key: "loose", label: "묽음", tone: "watch" },
  { key: "hard", label: "딱딱함", tone: "watch" },
  { key: "none", label: "못 봄", tone: "watch" },
  { key: "blood", label: "피가 섞임", tone: "alert" },
] as const;

/**
 * 활력. "운동량"이 아니라 **활력**을 묻는다 —
 * 얼마나 걸었는지는 답을 바꾸지 않지만 "나가려 하느냐"는 바꾼다.
 * 그리고 산책은 개만 해당한다. 문구만 종에 따라 갈고 항목은 하나로 둔다.
 */
export const ENERGY: readonly Choice[] = [
  { key: "normal", label: "평소만큼", tone: "good" },
  { key: "low", label: "처져 있음", tone: "watch", hint: "산책을 안 나가려 해요" },
  { key: "very_low", label: "거의 안 움직임", tone: "alert" },
] as const;

/** 우리가 처방한 약을 오늘 먹였는가. 약마다 따로 받지 않는다 — 탭이 늘면 안 적는다. */
export const MEDS: readonly Choice[] = [
  { key: "all", label: "다 먹였어요", tone: "good" },
  { key: "partial", label: "일부만", tone: "watch" },
  { key: "none", label: "못 먹였어요", tone: "alert" },
] as const;

export const FIELDS = [
  { key: "appetite", label: "식사", choices: APPETITE },
  { key: "stool", label: "배변", choices: STOOL },
  { key: "energy", label: "활력", choices: ENERGY },
  { key: "meds", label: "약", choices: MEDS },
] as const;

export type FieldKey = (typeof FIELDS)[number]["key"];

export function choiceOf(field: FieldKey, key: string | null | undefined): Choice | null {
  const f = FIELDS.find((x) => x.key === field);
  return f?.choices.find((c) => c.key === key) ?? null;
}

/** 활력 문구는 종에 따라 다르게 보여 준다 (항목은 하나다) */
export function energyHint(species: string | null | undefined): string | null {
  return species === "고양이" ? "숨어 있거나 안 놀아요" : "산책을 안 나가려 해요";
}

export type LifeLog = {
  logged_on: string;
  appetite: string | null;
  stool: string | null;
  energy: string | null;
  weight_kg: number | null;
  meds: string | null;
  note: string | null;
};

/** 하나라도 있으면 저장할 값이 있는 것 */
export function hasAnything(v: Partial<LifeLog>): boolean {
  return Boolean(
    v.appetite || v.stool || v.energy || v.meds || v.note?.trim() || v.weight_kg != null
  );
}

/** 목록 한 줄 요약. 고른 게 없으면 빈 문자열 */
export function summarize(v: LifeLog): string {
  const parts = FIELDS.map((f) => {
    const c = choiceOf(f.key, v[f.key]);
    return c ? `${f.label} ${c.label}` : null;
  }).filter(Boolean) as string[];
  if (v.weight_kg != null) parts.push(`${v.weight_kg}kg`);
  return parts.join(" · ");
}

/** 그 날 가장 나쁜 신호. 목록에서 눈에 띄게 하는 데 쓴다 */
export function worstTone(v: LifeLog): Tone | null {
  let worst: Tone | null = null;
  const rank: Record<Tone, number> = { good: 0, watch: 1, alert: 2 };
  for (const f of FIELDS) {
    const c = choiceOf(f.key, v[f.key]);
    if (c && (worst === null || rank[c.tone] > rank[worst])) worst = c.tone;
  }
  return worst;
}

// ── 먹이는 것 ──────────────────────────────────────────────────────────────

export type Intake = {
  id: string;
  label: string | null;
  photo_path: string | null;
  started_on: string;
  stopped_on: string | null;
};

/** 지금 주고 있는 것 */
export const isActive = (i: Intake, on: string) =>
  i.started_on <= on && (i.stopped_on === null || i.stopped_on > on);

/**
 * 최근에 바뀐 것 — 채팅 문 1이 보는 값.
 * **주식/간식/영양제를 구분하지 않는다.** 과일을 새로 준 것도 설사 원인이다.
 */
export function recentChanges(list: Intake[], today: string, days = 14): Intake[] {
  const since = shiftDate(today, -days);
  return list
    .filter((i) => i.started_on >= since || (i.stopped_on !== null && i.stopped_on >= since))
    .sort((a, b) => (b.stopped_on ?? b.started_on).localeCompare(a.stopped_on ?? a.started_on));
}

// ── 집계 (일 · 주 · 월) ────────────────────────────────────────────────────

export type Grain = "day" | "week" | "month";

export type Bucket = {
  key: string;          // 정렬·조회용 (YYYY-MM-DD | YYYY-Www | YYYY-MM)
  label: string;        // 화면 표시
  days: number;         // 기록이 있는 날 수
  /** 항목별 tone 분포. 안 고른 날은 세지 않는다 */
  tones: Record<FieldKey, Record<Tone, number>>;
  weight: number | null; // 그 구간 평균 (집 저울만)
  notes: number;
};

const emptyTones = (): Record<Tone, number> => ({ good: 0, watch: 0, alert: 0 });

/** 날짜 문자열 더하기 (KST 기준 date 문자열끼리만 다룬다 — 시간대 변환을 하지 않는다) */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 그 주의 월요일 */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  return shiftDate(iso, -dow);
}

export function bucketKey(iso: string, grain: Grain): string {
  if (grain === "day") return iso;
  if (grain === "month") return iso.slice(0, 7);
  return weekStart(iso);
}

function bucketLabel(key: string, grain: Grain): string {
  if (grain === "day") return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
  if (grain === "month") return `${Number(key.slice(5, 7))}월`;
  const end = shiftDate(key, 6);
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}–${Number(end.slice(8, 10))}`;
}

/**
 * 일·주·월로 묶는다.
 *
 * 범주형(식사·배변·활력·약)은 **tone 분포**로 압축한다 — 수의사가 한 달 치를 볼 때
 * 알고 싶은 건 "어느 날 뭘 골랐나"가 아니라 **"안 좋은 날이 늘고 있나"** 다.
 * 체중만 숫자 그대로 평균을 낸다.
 */
export function aggregate(logs: LifeLog[], grain: Grain): Bucket[] {
  const map = new Map<string, Bucket & { wsum: number; wn: number }>();
  for (const l of logs) {
    const key = bucketKey(l.logged_on, grain);
    let b = map.get(key);
    if (!b) {
      b = {
        key,
        label: bucketLabel(key, grain),
        days: 0,
        tones: { appetite: emptyTones(), stool: emptyTones(), energy: emptyTones(), meds: emptyTones() },
        weight: null,
        notes: 0,
        wsum: 0,
        wn: 0,
      };
      map.set(key, b);
    }
    b.days += 1;
    for (const f of FIELDS) {
      const c = choiceOf(f.key, l[f.key]);
      if (c) b.tones[f.key][c.tone] += 1;
    }
    if (l.weight_kg != null) {
      b.wsum += Number(l.weight_kg);
      b.wn += 1;
    }
    if (l.note?.trim()) b.notes += 1;
  }
  return [...map.values()]
    .map(({ wsum, wn, ...b }) => ({ ...b, weight: wn ? Math.round((wsum / wn) * 100) / 100 : null }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * 채팅이 쓰는 요약 — "밥을 안 먹어요"에 답하려면 **평소**를 알아야 한다.
 * 최근 `days` 일 중 기록된 날만 세고, 기록이 적으면 `enough=false` 로 알린다
 * (근거 없이 "평소보다 적다"고 말하면 안 된다).
 */
export function baseline(logs: LifeLog[], today: string, days = 30) {
  const since = shiftDate(today, -days);
  const recent = logs.filter((l) => l.logged_on >= since);
  const counts = emptyTones();
  for (const l of recent) {
    const c = choiceOf("appetite", l.appetite);
    if (c) counts[c.tone] += 1;
  }
  const eaten = counts.good + counts.watch + counts.alert;
  const weights = recent.filter((l) => l.weight_kg != null).map((l) => Number(l.weight_kg));
  return {
    days: recent.length,
    enough: eaten >= 7,
    appetiteGoodRate: eaten ? Math.round((counts.good / eaten) * 100) : null,
    weightFirst: weights.length ? weights[weights.length - 1] : null,
    weightLast: weights.length ? weights[0] : null,
  };
}
