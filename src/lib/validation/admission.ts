import type { Validated } from "./hospital";

export type AdmissionEditValues = {
  admitted_at: string; // YYYY-MM-DD
  note: string | null;
};

export type AdmissionValues = AdmissionEditValues & {
  patient_id: string;
  visit_id: string;
};

// 기존 입원의 수정 — 소속 회차는 바뀌지 않는다.
export function validateAdmissionEdit(input: {
  admitted_at?: string;
  note?: string;
}): Validated<AdmissionEditValues> {
  const admitted_at =
    (input.admitted_at ?? "").trim() || new Date().toISOString().slice(0, 10);
  const note = (input.note ?? "").trim() || null;
  return { ok: true, value: { admitted_at, note } };
}

// 입원 생성 — 입원은 항상 진료 회차에 딸리므로 visit_id 없이는 만들 수 없다.
export function validateAdmissionInput(input: {
  patient_id: string;
  visit_id: string;
  admitted_at?: string;
  note?: string;
}): Validated<AdmissionValues> {
  const patient_id = (input.patient_id ?? "").trim();
  if (!patient_id) return { ok: false, error: "환자 정보가 없습니다." };
  const visit_id = (input.visit_id ?? "").trim();
  if (!visit_id) return { ok: false, error: "진료 회차 정보가 없습니다." };
  const edit = validateAdmissionEdit(input);
  if (!edit.ok) return edit;
  return { ok: true, value: { patient_id, visit_id, ...edit.value } };
}
