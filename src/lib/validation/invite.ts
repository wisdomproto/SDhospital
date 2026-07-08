import type { Validated } from "./hospital";

export function validateRedeemInput(input: {
  email: string;
  password: string;
}): Validated<{ email: string; password: string }> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "올바른 이메일을 입력하세요." };
  const password = input.password ?? "";
  if (password.length < 8) return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };
  return { ok: true, value: { email, password } };
}
