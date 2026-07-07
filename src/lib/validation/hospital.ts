export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateHospitalInput(input: {
  name: string;
  contact?: string;
}): Validated<{ name: string; contact: string | null }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "병원명을 입력하세요." };
  const contact = (input.contact ?? "").trim();
  return { ok: true, value: { name, contact: contact || null } };
}
