"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "../(app)/logout";

function Paw() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="10.5" r="1.6" /><circle cx="9.5" cy="6.5" r="1.6" />
      <circle cx="14.5" cy="6.5" r="1.6" /><circle cx="18.5" cy="10.5" r="1.6" />
      <path d="M8 16c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5c0 1.9-1.8 2.8-4 2.8S8 17.9 8 16Z" />
    </svg>
  );
}

export function ReferralSidebar({ hospital }: { hospital: string }) {
  const pathname = usePathname();
  const active = pathname === "/referral" || pathname.startsWith("/referral/patients");

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-glyph">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="10" r="1.9" /><circle cx="10" cy="6" r="1.9" />
            <circle cx="14" cy="6" r="1.9" /><circle cx="18" cy="10" r="1.9" />
            <path d="M7 16.2c0-2.4 2.2-3.9 5-3.9s5 1.5 5 3.9c0 2.2-2.2 3.6-5 3.6s-5-1.4-5-3.6Z" />
          </svg>
        </span>
        <span className="brand-text">
          <span style={{ display: "block", lineHeight: 1.15 }}>SDhospital</span>
          <span style={{ display: "block", fontSize: ".68rem", fontWeight: 400, color: "var(--muted-2)" }}>
            의뢰 병원 포털
          </span>
        </span>
      </div>

      <div
        className="brand-text"
        style={{ fontSize: ".7rem", fontWeight: 600, color: "var(--muted-2)", letterSpacing: ".08em", padding: "0 10px 8px" }}
      >
        진료
      </div>
      <nav className="side-nav">
        <Link href="/referral" className={`nav-item${active ? " active" : ""}`} title="의뢰 환자">
          <span className="ico"><Paw /></span>
          <span className="label">의뢰 환자</span>
        </Link>
      </nav>

      <div className="role-panel" style={{ marginTop: "auto" }}>
        <span
          aria-hidden="true"
          style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, fontSize: ".85rem", flexShrink: 0 }}
        >
          {hospital.slice(0, 1)}
        </span>
        <div className="brand-text" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: ".82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hospital}</div>
          <div style={{ fontSize: ".68rem", color: "var(--muted-2)" }}>1차병원 원장 · 읽기 전용</div>
        </div>
        <form action={signOut} className="brand-text">
          <button className="portal-iconbtn" aria-label="로그아웃" style={{ width: 32, height: 32, background: "transparent" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
