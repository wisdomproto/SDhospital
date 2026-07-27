import type { Validated } from "./hospital";

export type ReportValues = {
  comment: string | null;
  send: boolean;
};

// 회차 리포트 · 입원 일일 리포트 공통 규칙.
// 수의사가 새로 넣는 것은 코멘트 한 줄뿐이고, 나머지(진단·처방·영상·바이털)는 시스템이 조립한다.
// 임시저장은 비어 있어도 되지만, 보호자에게 보낼 때는 한 줄이 있어야 한다.
// (사람 말 한 줄 없이 수치만 나가면 보호자에게는 통보로 읽힌다)
export function validateReportInput(input: {
  comment?: string;
  send?: string | null;
}): Validated<ReportValues> {
  const comment = (input.comment ?? "").trim();
  const send = input.send === "1";
  if (send && !comment) {
    return { ok: false, error: "보호자에게 보낼 코멘트를 한 줄 적어주세요." };
  }
  return { ok: true, value: { comment: comment || null, send } };
}
