// "오늘 할 일" — 리포트를 아직 못 보낸 것들.
// 사람은 잊는 게 아니라 밀린다. 보낼 때까지 목록에서 사라지지 않는다.

export type WorkItem = {
  kind: "visit" | "admission" | "checkup" | "image_request" | "question";
  href: string;
  patientName: string;
  species: string | null;
  /** 회차: 진료일 / 입원: 리포트 대상 날짜 */
  date: string;
  /** 며칠 밀렸는지. 0이면 오늘 것 */
  overdueDays: number;
  subtitle: string;
  /** 입원 리포트만: 간호사가 입력을 끝내 수의사 확인만 남은 상태 */
  awaitingReview?: boolean;
};

export function kstToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** 두 YYYY-MM-DD 사이의 일수. 과거일수록 양수 */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00+09:00");
  const b = Date.parse(to + "T00:00:00+09:00");
  return Math.round((b - a) / 86_400_000);
}

export function admittedDay(admittedAt: string, today: string): number {
  return Math.max(1, daysBetween(admittedAt, today) + 1);
}

export function sortWorkItems(items: WorkItem[]): WorkItem[] {
  // ⚠️ **보호자가 답을 기다리는 질문이 제일 위다.** 나머지는 우리가 보낼 것이지만
  // 이건 저쪽에서 기다리고 있는 것이고, 기다려 달라고 우리가 말해 놓은 것이다.
  // 그다음 확인만 남은 것 — 남이 이미 채워 놨고 누르기만 하면 끝난다.
  // 그다음은 가장 오래 밀린 것, 같으면 회차부터 (진료가 기본이므로)
  const first = (i: WorkItem) => (i.kind === "question" ? 2 : i.awaitingReview ? 1 : 0);
  return [...items].sort(
    (a, b) => first(b) - first(a) || b.overdueDays - a.overdueDays || a.kind.localeCompare(b.kind)
  );
}
