import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signInPortal, quickOwner } from "./actions";
import { DEMO_ENABLED } from "../demo";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/portal");

  return (
    <main className="portal-shell" style={{ display: "grid", placeItems: "center" }}>
      <div className="portal-phone" style={{ justifyContent: "center" }}>
        <div style={{ padding: "26px 22px", display: "grid", gap: 16 }}>
          {/* brand hero */}
          <div className="portal-hero" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, position: "relative" }}>
              <span
                style={{ width: 40, height: 40, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(255,255,255,.18)" }}
              >
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
                <div style={{ fontSize: ".74rem", opacity: 0.9 }}>보호자 · 1차병원 읽기 전용 포털</div>
              </div>
            </div>
          </div>

          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-.01em", color: "var(--text)" }}>
              로그인
            </h1>
            <p className="muted" style={{ margin: 0, fontSize: ".86rem" }}>
              계정 정보로 진료·입원 기록을 확인하세요.
            </p>
          </div>

          {error && (
            <p style={{ margin: 0, color: "var(--danger)", fontSize: ".86rem" }}>{error}</p>
          )}

          <form action={signInPortal} style={{ display: "grid", gap: 12 }}>
            <input name="email" type="email" placeholder="이메일" required className="field" />
            <input name="password" type="password" placeholder="비밀번호" required className="field" />
            <button type="submit" className="btn btn-primary" style={{ padding: 13 }}>
              로그인
            </button>
          </form>

          {DEMO_ENABLED && (
            <>
              <div className="login-divider">테스트 계정 · 클릭하면 바로 입장</div>
              {/* ⚠️ DEMO ONLY — gated by NEXT_PUBLIC_ENABLE_DEMO */}
              <form action={quickOwner}>
                <button className="login-demo-btn" style={{ width: "100%" }}>
                  <span className="ic" style={{ fontSize: 16 }}>🐶</span>
                  <span style={{ fontWeight: 600, fontSize: ".82rem", color: "var(--text)" }}>보호자</span>
                  <span style={{ fontSize: ".68rem", color: "var(--muted-2)" }}>포털 입장</span>
                </button>
              </form>
            </>
          )}

          <Link href="/login" className="muted" style={{ textAlign: "center", fontSize: ".8rem", textDecoration: "none" }}>
            직원 · 1차병원 원장이신가요? PC 로그인 →
          </Link>
        </div>
      </div>
    </main>
  );
}
