import type { Validated } from "./hospital";

export type AdmissionValues = {
  patient_id: string;
  admitted_at: string; // YYYY-MM-DD
  note: string | null;
};

export function validateAdmissionInput(input: {
  patient_id: string;
  admitted_at?: string;
  note?: string;
}): Validated<AdmissionValues> {
  const patient_id = (input.patient_id ?? "").trim();
  if (!patient_id) return { ok: false, error: "환자 정보가 없습니다." };
  const admitted_at =
    (input.admitted_at ?? "").trim() || new Date().toISOString().slice(0, 10);
  const note = (input.note ?? "").trim() || null;
  return { ok: true, value: { patient_id, admitted_at, note } };
}
