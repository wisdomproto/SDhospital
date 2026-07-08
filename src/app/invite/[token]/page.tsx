import { createClient } from "@/lib/supabase/server";
import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { redeemInvite } from "./actions";

function BrandMark() {
  return (
    <div className="brand-mark">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="10" r="1.9" />
        <circle cx="10" cy="6" r="1.9" />
        <circle cx="14" cy="6" r="1.9" />
        <circle cx="18" cy="10" r="1.9" />
        <path d="M7 16.2c0-2.4 2.2-3.9 5-3.9s5 1.5 5 3.9c0 2.2-2.2 3.6-5 3.6s-5-1.4-5-3.6Z" />
      </svg>
    </div>
  );
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_target", { p_token: token });
  const target = Array.isArray(data) ? data[0] : null;

  if (!target || !target.valid) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <BrandMark />
          <h1 style={{ marginTop: 16, fontSize: "1.5rem", fontWeight: 800 }}>
            초대 링크가 유효하지 않습니다
          </h1>
          <p className="muted" style={{ marginTop: 8, fontSize: ".92rem" }}>
            만료되었거나 이미 사용된 링크일 수 있습니다. 병원에 문의해 주세요.
          </p>
        </section>
      </main>
    );
  }

  const roleLabel = target.role === "owner" ? "보호자" : "1차 병원";
  return (
    <main className="login-shell">
      <section className="login-card">
        <BrandMark />
        <p className="eyebrow" style={{ marginTop: 16 }}>
          SDhospital · 읽기 전용 초대
        </p>
        <h1 style={{ margin: "6px 0 4px", fontSize: "1.6rem", fontWeight: 800 }}>
          {roleLabel} 계정 만들기
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: ".92rem" }}>
          <b style={{ color: "var(--text)" }}>{target.label}</b> 기록을 열람할 수 있는 읽기
          전용 계정을 만듭니다.
        </p>

        {error && (
          <p style={{ marginTop: 18, marginBottom: 0, color: "var(--danger)", fontSize: ".9rem" }}>
            {error}
          </p>
        )}

        <form action={redeemInvite.bind(null, token)} style={{ display: "grid", gap: 12, marginTop: 22 }}>
          <input name="email" type="email" placeholder="이메일" required className={inputClass} />
          <input
            name="password"
            type="password"
            placeholder="비밀번호 (8자 이상)"
            required
            className={inputClass}
          />
          <SubmitButton>계정 만들기</SubmitButton>
        </form>
      </section>
    </main>
  );
}
