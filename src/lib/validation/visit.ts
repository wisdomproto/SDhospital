import type { Validated } from "./hospital";

export type VisitValues = {
  patient_id: string;
  visit_date: string; // YYYY-MM-DD
  visit_no: number | null;
  note: string | null;
};

export function validateVisitInput(input: {
  patient_id: string;
  visit_date?: string;
  visit_no?: string;
  note?: string;
}): Validated<VisitValues> {
  const patient_id = (input.patient_id ?? "").trim();
  if (!patient_id) return { ok: false, error: "환자 정보가 없습니다." };

  const rawDate = (input.visit_date ?? "").trim();
  const visit_date = rawDate || new Date().toISOString().slice(0, 10);

  const rawNo = (input.visit_no ?? "").trim();
  let visit_no: number | null = null;
  if (rawNo) {
    const n = Number(rawNo);
    if (!Number.isInteger(n) || n < 0)
      return { ok: false, error: "회차는 0 이상의 정수여야 합니다." };
    visit_no = n;
  }

  const note = (input.note ?? "").trim() || null;
  return { ok: true, value: { patient_id, visit_date, visit_no, note } };
}
