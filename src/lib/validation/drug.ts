import type { Validated } from "./hospital";

function clean(v?: string | null): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

export function validateDrugInput(input: {
  name: string;
  unit?: string;
  spec?: string;
  note?: string;
}): Validated<{ name: string; unit: string | null; spec: string | null; note: string | null }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "약품명을 입력하세요." };
  return {
    ok: true,
    value: { name, unit: clean(input.unit), spec: clean(input.spec), note: clean(input.note) },
  };
}
