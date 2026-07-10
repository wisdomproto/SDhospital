import { createClient } from "@/lib/supabase/server";
import { redeemInvite } from "./actions";
import Link from "next/link";

function BrandHero({ subtitle }: { subtitle: string }) {
  return (
    <div className="portal-hero" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, position: "relative" }}>
        <span style={{ width: 40, height: 40, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(255,255,255,.18)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="10" r="1.9" />
            <circle cx="10" cy="6" r="1.9" />
            <circle cx="14" cy="6" r="1.9" />
            <circle cx="18" cy="10" r="1.9" />
            <path d="M7 16.2c0-2.4 2.2-3.9 5-3.9s5 1.5 5 3.9c0 2.2-2.2 3.6-5 3.6s-5-1.4-5-3.6Z" />
          </svg>
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", letterSpacing: "-.01em" }}>SDhospital</div>
          <div style={{ fontSize: ".74rem", opacity: 0.9 }}>{subtitle}</div>
        </div>
      </div>
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
      <main className="portal-shell" style={{ display: "grid", placeItems: "center" }}>
        <div className="portal-phone" style={{ justifyContent: "center" }}>
          <div style={{ padding: "26px 22px", display: "grid", gap: 16 }}>
            <BrandHero subtitle="읽기 전용 초대" />
            <div>
              <h1 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-.01em", color: "var(--text)" }}>
                초대 링크가 유효하지 않습니다
              </h1>
              <p className="muted" style={{ margin: 0, fontSize: ".86rem", lineHeight: 1.6 }}>
                만료되었거나 이미 사용된 링크일 수 있습니다. 병원에 문의해 주세요.
              </p>
            </div>
            <Link href="/login/portal" className="muted" style={{ textAlign: "center", fontSize: ".8rem", textDecoration: "none" }}>
              이미 계정이 있으신가요? 로그인 →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const roleLabel = target.role === "owner" ? "보호자" : "1차 병원";
  return (
    <main className="portal-shell" style={{ display: "grid", placeItems: "center" }}>
      <div className="portal-phone" style={{ justifyContent: "center" }}>
        <div style={{ padding: "26px 22px", display: "grid", gap: 16 }}>
          <BrandHero subtitle={`${roleLabel} · 읽기 전용 초대`} />

          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-.01em", color: "var(--text)" }}>
              {roleLabel} 계정 만들기
            </h1>
            <p className="muted" style={{ margin: 0, fontSize: ".86rem", lineHeight: 1.6 }}>
              <b style={{ color: "var(--text)" }}>{target.label}</b> 기록을 열람할 수 있는 읽기 전용 계정을 만듭니다.
            </p>
          </div>

          {error && (
            <p style={{ margin: 0, color: "var(--danger)", fontSize: ".86rem" }}>{error}</p>
          )}

          <form action={redeemInvite.bind(null, token)} style={{ display: "grid", gap: 12 }}>
            <input name="email" type="email" placeholder="이메일" required className="field" />
            <input name="password" type="password" placeholder="비밀번호 (8자 이상)" required className="field" />
            <button type="submit" className="btn btn-primary" style={{ padding: 13 }}>
              계정 만들기
            </button>
          </form>

          <Link href="/login/portal" className="muted" style={{ textAlign: "center", fontSize: ".8rem", textDecoration: "none" }}>
            이미 계정이 있으신가요? 로그인 →
          </Link>
        </div>
      </div>
    </main>
  );
}
