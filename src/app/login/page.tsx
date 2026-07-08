import { signIn, quickLoginStaff, quickLoginOwner, quickLoginVet } from "./actions";
import { DEMO_ACCOUNTS } from "./demo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">🐾</div>
        <p className="eyebrow" style={{ marginTop: 16 }}>
          Veterinary EMR
        </p>
        <h1 style={{ margin: "6px 0 4px", fontSize: "1.9rem", fontWeight: 800 }}>
          SDhospital EMR
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          2차 동물병원 진료·입원·공유 시스템
        </p>

        {error && (
          <p style={{ marginTop: 18, marginBottom: 0, color: "var(--danger)", fontSize: ".9rem" }}>
            {error}
          </p>
        )}

        <form action={signIn} style={{ display: "grid", gap: 12, marginTop: 22 }}>
          <label className="field-label" style={{ marginBottom: 0 }}>
            이메일
            <input name="email" type="email" required className="field" style={{ marginTop: 6 }} />
          </label>
          <label className="field-label" style={{ marginBottom: 0 }}>
            비밀번호
            <input
              name="password"
              type="password"
              required
              className="field"
              style={{ marginTop: 6 }}
            />
          </label>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}>
            로그인
          </button>
        </form>

        {/* ⚠️ DEMO ONLY — remove before production */}
        <div
          style={{
            marginTop: 26,
            padding: 16,
            borderRadius: 16,
            border: "1px dashed var(--line)",
            background: "var(--surface-soft)",
          }}
        >
          <p
            className="eyebrow"
            style={{ fontSize: ".68rem", color: "var(--muted)", margin: "0 0 12px" }}
          >
            테스트 계정 · 클릭하면 바로 입장
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                <div style={{ fontWeight: 800, color: "var(--text)" }}>직원 · EMR</div>
                <code>{DEMO_ACCOUNTS.staff.email}</code> / <code>{DEMO_ACCOUNTS.staff.password}</code>
              </div>
              <form action={quickLoginStaff}>
                <button className="btn btn-ghost btn-sm">직원 입장</button>
              </form>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                <div style={{ fontWeight: 800, color: "var(--text)" }}>보호자 · 포털</div>
                <code>{DEMO_ACCOUNTS.owner.email}</code> / <code>{DEMO_ACCOUNTS.owner.password}</code>
              </div>
              <form action={quickLoginOwner}>
                <button className="btn btn-ghost btn-sm">보호자 입장</button>
              </form>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: ".78rem", color: "var(--muted)" }}>
                <div style={{ fontWeight: 800, color: "var(--text)" }}>1차병원 원장 · 포털</div>
                <code>{DEMO_ACCOUNTS.vet.email}</code> / <code>{DEMO_ACCOUNTS.vet.password}</code>
              </div>
              <form action={quickLoginVet}>
                <button className="btn btn-ghost btn-sm">원장 입장</button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
