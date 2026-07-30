import { findItem, type Range, type Species } from "./template";

/**
 * 값 하나의 판정.
 *
 * 보호자에게는 **수치가 아니라 이 판정**을 먼저 보여준다. 44.2 라는 숫자는
 * 검색해 보게 만들 뿐이고, "참고범위보다 조금 높아요"가 실제로 필요한 정보다.
 * (수치는 접어 두고 원하면 펼친다 — 없애지는 않는다. 의료진과 1차병원은 숫자를 본다)
 *
 * 판단 근거가 없으면 **판정하지 않는다**(`unknown`). 참고범위가 없는 항목을
 * 억지로 정상이라고 말하면 그 말 자체가 위험하다.
 */
export type Verdict = "normal" | "low" | "high" | "watch" | "unknown";

export type Evaluated = {
  verdict: Verdict;
  /** 숫자로 읽힌 값 (Negative·2+·<1/HPF 등은 null) */
  numeric: number | null;
  range: Range | null;
};

/** "44.2" → 44.2 · "Negative"/"2+"/"<1/HPF" → null */
export function parseNumeric(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  // 부등호가 붙은 값은 경계 밖이라는 뜻일 뿐 숫자로 쓰지 않는다
  if (/^[<>]/.test(t)) return null;
  const m = t.match(/^-?\d+(\.\d+)?$/);
  return m ? Number(t) : null;
}

const NEGATIVE = /^(negative|음성|정상|normal|검출되지\s*않음)/i;

export function evaluate(
  sectionKey: string,
  itemKey: string,
  raw: string,
  species: Species | null
): Evaluated {
  const item = findItem(sectionKey, itemKey);
  const range = (species && item?.ranges?.[species]) || null;
  const numeric = parseNumeric(raw);
  const value = raw.trim();

  if (!value) return { verdict: "unknown", numeric: null, range };
  // 계산값(비율)은 참고범위가 없다 — 판정 대상이 아니다
  if (item?.derived) return { verdict: "unknown", numeric, range: null };

  // 기대값이 글자로 정해진 항목 (음성이어야 하는 것들)
  if (range?.text) {
    if (NEGATIVE.test(value)) return { verdict: "normal", numeric, range };
    return { verdict: "watch", numeric, range };
  }

  if (numeric == null) {
    // 숫자가 아닌 서술: "이상 없음" 류는 정상, 나머지는 판정하지 않는다.
    // 사람이 쓴 문장을 기계가 나쁘다고 단정하면 안 된다.
    if (/이상\s*없|없습니다|정상|양호/.test(value) || NEGATIVE.test(value)) {
      return { verdict: "normal", numeric: null, range };
    }
    return { verdict: "unknown", numeric: null, range };
  }

  if (!range || (range.min == null && range.max == null)) {
    return { verdict: "unknown", numeric, range };
  }
  if (range.min != null && numeric < range.min) return { verdict: "low", numeric, range };
  if (range.max != null && numeric > range.max) return { verdict: "high", numeric, range };
  return { verdict: "normal", numeric, range };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  normal: "정상",
  low: "낮음",
  high: "높음",
  watch: "확인 필요",
  unknown: "—",
};

/** 보호자 화면 문장. 숫자를 앞세우지 않는다 */
export function ownerPhrase(label: string, e: Evaluated): string {
  switch (e.verdict) {
    case "normal":
      return `${label} 정상 범위예요`;
    case "low":
      return `${label}이 참고범위보다 낮아요`;
    case "high":
      return `${label}이 참고범위보다 높아요`;
    case "watch":
      return `${label}에서 확인이 필요한 결과가 나왔어요`;
    default:
      return `${label}`;
  }
}

/** 섹션 요약 — 몇 개가 범위를 벗어났는지 */
export function countOutOfRange(values: Evaluated[]): number {
  return values.filter((v) => v.verdict === "low" || v.verdict === "high" || v.verdict === "watch")
    .length;
}
