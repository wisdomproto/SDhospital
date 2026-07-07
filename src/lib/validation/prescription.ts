import type { Validated } from "./hospital";

function clean(v?: string | null): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

export type PrescriptionValues = {
  visit_id: string;
  drug_id: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  note: string | null;
};

export function validatePrescriptionInput(input: {
  visit_id: string;
  drug_id: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  note?: string;
}): Validated<PrescriptionValues> {
  const visit_id = (input.visit_id ?? "").trim();
  const drug_id = (input.drug_id ?? "").trim();
  if (!visit_id) return { ok: false, error: "회차 정보가 없습니다." };
  if (!drug_id) return { ok: false, error: "약품을 선택하세요." };
  return {
    ok: true,
    value: {
      visit_id,
      drug_id,
      dose: clean(input.dose),
      frequency: clean(input.frequency),
      duration: clean(input.duration),
      note: clean(input.note),
    },
  };
}
