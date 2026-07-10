import { signIn, quickLoginStaff, quickLoginOwner, quickLoginVet } from "./actions";
import { DEMO_ACCOUNTS, VET_ACCOUNTS, DEMO_ENABLED } from "./demo";

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-split">
        {/* left brand panel */}
        <div className="login-brand">
          <span className="deco" style={{ right: -70, top: -70, width: 280, height: 280 }} />
          <span className="deco" style={{ right: 40, bottom: -90, width: 220, height: 220, background: "rgba(255,255,255,.06)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
            <span className="brand-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="6" cy="10" r="1.9" />
                <circle cx="10" cy="6" r="1.9" />
                <circle cx="14" cy="6" r="1.9" />
                <circle cx="18" cy="10" r="1.9" />
                <path d="M7 16.2c0-2.4 2.2-3.9 5-3.9s5 1.5 5 3.9c0 2.2-2.2 3.6-5 3.6s-5-1.4-5-3.6Z" />
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.15rem", letterSpacing: "-.01em" }}>SDhospital</div>
              <div style={{ fontSize: ".72rem", opacity: 0.8 }}>2차 동물병원 EMR</div>
            </div>
          </div>
          <div style={{ marginTop: "auto", position: "relative" }}>
            <div style={{ fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", fontSize: ".72rem", opacity: 0.85 }}>
              Veterinary EMR
            </div>
            <h2 className="login-brand-headline">
              진료·입원 기록을
              <br />한 곳에서, 안전하게.
            </h2>
            <p style={{ margin: 0, fontSize: ".95rem", lineHeight: 1.65, opacity: 0.9, maxWidth: 360 }}>
              의뢰한 1차 병원과 보호자에게 읽기 전용으로 공유하고, RLS로 접근 권한을 안전하게 관리합니다.
            </p>
            <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
              <div className="login-feat">
                <span className="ic"><Check /></span>진료 회차·처방·의료영상 통합 관리
              </div>
              <div className="login-feat">
                <span className="ic"><Check /></span>입원 바이털 시계열 모니터링
              </div>
              <div className="login-feat">
                <span className="ic"><Check /></span>초대 링크로 보호자·1차병원 공유
              </div>
            </div>
          </div>
        </div>

        {/* right form panel */}
        <div className="login-form">
          <p className="eyebrow">직원 로그인</p>
          <h1 style={{ margin: "8px 0 6px", fontSize: "1.7rem", fontWeight: 700, letterSpacing: "-.01em" }}>
            다시 오신 걸 환영합니다
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
            계정 정보로 EMR에 로그인하세요.
          </p>

          {error && (
            <p style={{ marginTop: 16, marginBottom: 0, color: "var(--danger)", fontSize: ".9rem" }}>
              {error}
            </p>
          )}

          <form action={signIn} style={{ display: "grid", gap: 14, marginTop: 24 }}>
            <label className="field-label" style={{ marginBottom: 0 }}>
              이메일
              <input name="email" type="email" required className="field" style={{ marginTop: 6 }} />
            </label>
            <label className="field-label" style={{ marginBottom: 0 }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                비밀번호
                <span style={{ color: "var(--primary)", fontWeight: 600, fontSize: ".78rem" }}>비밀번호 찾기</span>
              </span>
              <input name="password" type="password" required className="field" style={{ marginTop: 6 }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".83rem", color: "var(--ink-2)" }}>
              <input name="remember" type="checkbox" defaultChecked style={{ accentColor: "var(--primary)", width: 16, height: 16 }} />
              로그인 상태 유지
            </label>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 2, padding: "13px" }}>
              로그인
            </button>
          </form>

          {DEMO_ENABLED && (
          <>
          <div className="login-divider">테스트 계정 · 클릭하면 바로 입장</div>

          {/* ⚠️ DEMO ONLY — gated by NEXT_PUBLIC_ENABLE_DEMO */}
          <div className="login-demo-grid">
            <form action={quickLoginStaff}>
              <button className="login-demo-btn" title={DEMO_ACCOUNTS.staff.email} style={{ width: "100%" }}>
                <span className="ic">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" />
                  </svg>
                </span>
                <span style={{ fontWeight: 600, fontSize: ".78rem", color: "var(--text)" }}>우리 병원</span>
                <span style={{ fontSize: ".66rem", color: "var(--muted-2)" }}>직원 EMR</span>
              </button>
            </form>
            <form action={quickLoginOwner}>
              <button className="login-demo-btn" title={DEMO_ACCOUNTS.owner.email} style={{ width: "100%" }}>
                <span className="ic" style={{ fontSize: 15 }}>🐶</span>
                <span style={{ fontWeight: 600, fontSize: ".78rem", color: "var(--text)" }}>보호자</span>
                <span style={{ fontSize: ".66rem", color: "var(--muted-2)" }}>포털</span>
              </button>
            </form>
          </div>

          <div className="login-vet-label">
            <span className="ic" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21V6l8-3 8 3v15" />
                <path d="M12 9v6M9 12h6" />
              </svg>
            </span>
            의뢰 병원 원장 포털 · 병원 선택
          </div>
          <div className="login-demo-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {VET_ACCOUNTS.map((v) => (
              <form key={v.key} action={quickLoginVet.bind(null, v.email)}>
                <button className="login-demo-btn" title={v.email} style={{ width: "100%" }}>
                  <span className="ic">🏥</span>
                  <span style={{ fontWeight: 600, fontSize: ".78rem", color: "var(--text)" }}>{v.label}</span>
                  <span style={{ fontSize: ".66rem", color: "var(--muted-2)" }}>원장으로 입장 →</span>
                </button>
              </form>
            ))}
          </div>
          </>
          )}
        </div>
      </section>
    </main>
  );
}
