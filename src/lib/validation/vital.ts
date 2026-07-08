import type { Validated } from "./hospital";

export type VitalValues = {
  admission_id: string;
  temperature: number | null;
  heart_rate: number | null;
  resp_rate: number | null;
  systolic: number | null;
  diastolic: number | null;
  note: string | null;
};

// Parse an optional numeric field: blank -> null; non-numeric -> error.
function parseNum(
  v: string | undefined,
  label: string
): { ok: true; value: number | null } | { ok: false; error: string } {
  const t = (v ?? "").trim();
  if (!t) return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, error: `${label} 값이 올바르지 않습니다.` };
  return { ok: true, value: n };
}

export function validateVitalInput(input: {
  admission_id: string;
  temperature?: string;
  heart_rate?: string;
  resp_rate?: string;
  systolic?: string;
  diastolic?: string;
  note?: string;
}): Validated<VitalValues> {
  const admission_id = (input.admission_id ?? "").trim();
  if (!admission_id) return { ok: false, error: "입원 정보가 없습니다." };

  const fields: [keyof VitalValues, string | undefined, string][] = [
    ["temperature", input.temperature, "체온"],
    ["heart_rate", input.heart_rate, "심박수"],
    ["resp_rate", input.resp_rate, "호흡수"],
    ["systolic", input.systolic, "수축기 혈압"],
    ["diastolic", input.diastolic, "이완기 혈압"],
  ];

  const out: Record<string, number | null> = {};
  let anyPresent = false;
  for (const [key, raw, label] of fields) {
    const p = parseNum(raw, label);
    if (!p.ok) return { ok: false, error: p.error };
    out[key as string] = p.value;
    if (p.value !== null) anyPresent = true;
  }
  if (!anyPresent) return { ok: false, error: "측정값을 하나 이상 입력하세요." };

  return {
    ok: true,
    value: {
      admission_id,
      temperature: out.temperature,
      heart_rate: out.heart_rate,
      resp_rate: out.resp_rate,
      systolic: out.systolic,
      diastolic: out.diastolic,
      note: (input.note ?? "").trim() || null,
    },
  };
}
