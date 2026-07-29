/**
 * 입원 일일 리포트 — 보호자가 매일 받는 것.
 *
 * 매일 나가는 문장이라 표현이 사람마다 다르면 그 자체가 불안 요소가 된다
 * ("조금 먹음"과 "잘 안 먹음"이 같은 상태를 가리키면 보호자는 나빠졌다고 읽는다).
 * 그래서 자유 서술이 아니라 **정해진 선택지**를 고르고, 보호자용 문장은 여기서 만든다.
 *
 * 수치(체온·심박·호흡)는 계속 `vital` 에 쌓지만 보호자에게는 내보내지 않는다.
 * 38.4라는 숫자는 안심을 주지 못한다 — 검색해 보고 더 불안해진다.
 */

export const FEEDING = [
  { key: "well", staff: "잘 먹음", owner: "밥을 잘 먹었어요", tone: "good" },
  { key: "some", staff: "조금 먹음", owner: "평소보다 조금 먹었어요", tone: "watch" },
  { key: "little", staff: "거의 안 먹음", owner: "오늘은 거의 먹지 않았어요", tone: "watch" },
  { key: "assist", staff: "도와서 먹임", owner: "직접 먹지 않아 도와서 먹였어요", tone: "watch" },
  { key: "npo", staff: "금식", owner: "치료 일정 때문에 금식했어요", tone: "neutral" },
] as const;

export const ELIMINATION = [
  { key: "normal", staff: "정상", owner: "대소변 모두 정상이었어요", tone: "good" },
  { key: "loose", staff: "묽은 변", owner: "변이 묽었어요", tone: "watch" },
  { key: "none", staff: "변 못 봄", owner: "오늘은 변을 보지 않았어요", tone: "watch" },
  { key: "urine_only", staff: "소변만", owner: "소변만 봤어요", tone: "watch" },
  { key: "blood", staff: "혈변·혈뇨", owner: "대소변에 피가 비쳐 확인 중이에요", tone: "alert" },
] as const;

export type Tone = "good" | "watch" | "neutral" | "alert";
type Option = { key: string; staff: string; owner: string; tone: string };

const find = (list: readonly Option[], key: string | null | undefined) =>
  list.find((o) => o.key === key) ?? null;

export const feedingOption = (key: string | null | undefined) => find(FEEDING, key);
export const eliminationOption = (key: string | null | undefined) => find(ELIMINATION, key);

export type DailyInput = {
  feeding: string | null;
  elimination: string | null;
  special: string | null;
  comment: string | null;
};

export type DailyLine = { label: string; text: string; tone: Tone };

/** 보호자 화면 한 날짜치. 고른 게 없으면 그 줄은 아예 만들지 않는다. */
export function dailyLines(v: DailyInput): DailyLine[] {
  const lines: DailyLine[] = [];
  const f = feedingOption(v.feeding);
  if (f) lines.push({ label: "식사", text: f.owner, tone: f.tone as Tone });
  const e = eliminationOption(v.elimination);
  if (e) lines.push({ label: "배변", text: e.owner, tone: e.tone as Tone });

  const special = v.special?.trim();
  if (special) lines.push({ label: "특이사항", text: special, tone: "alert" });

  const comment = v.comment?.trim();
  if (comment) lines.push({ label: "담당의", text: comment, tone: "neutral" });
  return lines;
}

/**
 * 보낼 수 있는가. 식사·배변 중 하나만 골라도 보낼 수 있다 —
 * "매일 두 가지만" 이 목적인데 매번 문장까지 쓰게 하면 며칠 만에 발송이 끊긴다.
 */
export function canSendDaily(v: DailyInput): boolean {
  return Boolean(feedingOption(v.feeding) || eliminationOption(v.elimination) || v.special?.trim() || v.comment?.trim());
}

/** 목록·알림에 쓰는 한 줄 요약 */
export function dailySummary(v: DailyInput): string {
  const parts = [feedingOption(v.feeding)?.staff, eliminationOption(v.elimination)?.staff].filter(Boolean);
  const special = v.special?.trim();
  if (special) parts.push(`특이사항: ${special}`);
  return parts.join(" · ") || (v.comment?.trim() ?? "");
}
