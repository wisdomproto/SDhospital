// ⚠️ DEMO ONLY. One-click login is gated behind an env flag so it never ships
// enabled by accident. Set NEXT_PUBLIC_ENABLE_DEMO=1 to expose the buttons.
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO === "1";

// Test accounts for one-click login.
export const DEMO_ACCOUNTS = {
  staff: { email: "staff@sdhospital.test", password: "sdhospital123!", dest: "/" },
  owner: { email: "1@example.com", password: "1234", dest: "/portal" },
} as const;

// 의뢰(1차) 병원 원장 계정 — 병원별로 하나씩. 로그인 후 데스크탑 포털(/referral)로 이동.
export const VET_ACCOUNTS = [
  { key: "anycom", label: "애니컴동물병원", email: "2@example.com", password: "1234" },
  { key: "aione", label: "아이원동물병원", email: "3@example.com", password: "1234" },
] as const;

export type VetAccount = (typeof VET_ACCOUNTS)[number];
