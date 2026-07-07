import type { Validated } from "./hospital";

export function validateOwnerInput(input: {
  name: string;
  contact?: string;
}): Validated<{ name: string; contact: string | null }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "보호자 이름을 입력하세요." };
  const contact = (input.contact ?? "").trim();
  return { ok: true, value: { name, contact: contact || null } };
}
