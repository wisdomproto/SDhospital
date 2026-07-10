"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "./logout";

const NAV = [
  { href: "/", label: "대시보드", icon: "home", exact: true },
  { href: "/patients", label: "환자", icon: "paw" },
  { href: "/owners", label: "보호자", icon: "user" },
  { href: "/hospitals", label: "1차병원", icon: "hospital" },
  { href: "/drugs", label: "약품", icon: "pill" },
] as const;

function Icon({ name }: { name: string }) {
  const c = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (<svg {...c}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg>);
    case "paw":
      return (<svg {...c}><circle cx="5.5" cy="10.5" r="1.6" /><circle cx="9.5" cy="6.5" r="1.6" /><circle cx="14.5" cy="6.5" r="1.6" /><circle cx="18.5" cy="10.5" r="1.6" /><path d="M8 16c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5c0 1.9-1.8 2.8-4 2.8S8 17.9 8 16Z" /></svg>);
    case "user":
      return (<svg {...c}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" /></svg>);
    case "hospital":
      return (<svg {...c}><path d="M4 21V6l8-3 8 3v15" /><path d="M12 9v6M9 12h6" /></svg>);
    case "pill":
      return (<svg {...c}><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" /></svg>);
    case "chevrons":
      return (<svg {...c}><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></svg>);
    default:
      return null;
  }
}

export function AppSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // restore persisted collapse state (default: expanded)
  useEffect(() => {
    if (localStorage.getItem("sidebar-collapsed") === "1") setCollapsed(true);
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-brand">
        <span className="brand-glyph">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="10" r="1.9" />
            <circle cx="10" cy="6" r="1.9" />
            <circle cx="14" cy="6" r="1.9" />
            <circle cx="18" cy="10" r="1.9" />
            <path d="M7 16.2c0-2.4 2.2-3.9 5-3.9s5 1.5 5 3.9c0 2.2-2.2 3.6-5 3.6s-5-1.4-5-3.6Z" />
          </svg>
        </span>
        <span className="brand-text">
          <span style={{ display: "block", lineHeight: 1.15 }}>SDhospital</span>
          <span style={{ display: "block", fontSize: ".68rem", fontWeight: 400, color: "var(--muted-2)" }}>
            2차 동물병원 EMR
          </span>
        </span>
      </div>
      <button
        type="button"
        className="nav-item sidebar-toggle"
        onClick={toggle}
        title={collapsed ? "사이드바 펴기" : "사이드바 접기"}
        aria-label={collapsed ? "사이드바 펴기" : "사이드바 접기"}
        aria-expanded={!collapsed}
        style={{
          width: "100%",
          marginBottom: 10,
          cursor: "pointer",
          background: "var(--bg)",
          border: "1px solid var(--line)",
          font: "inherit",
        }}
      >
        <span className="ico" style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <Icon name="chevrons" />
        </span>
        <span className="label">접기</span>
      </button>
      <div
        className="brand-text"
        style={{
          fontSize: ".7rem",
          fontWeight: 600,
          color: "var(--muted-2)",
          letterSpacing: ".08em",
          padding: "0 10px 8px",
        }}
      >
        진료
      </div>
      <nav className="side-nav">
        {NAV.map((item) => {
          const exact = "exact" in item && item.exact;
          const active = exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? " active" : ""}`}
              title={item.label}
            >
              <span className="ico">
                <Icon name={item.icon} />
              </span>
              <span className="label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="role-panel" style={{ marginTop: "auto" }}>
        <span
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 600,
            fontSize: ".85rem",
            flexShrink: 0,
          }}
        >
          {name.slice(0, 1)}
        </span>
        <div className="brand-text" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: ".82rem" }}>{name}</div>
          <div style={{ fontSize: ".68rem", color: "var(--muted-2)" }}>STAFF</div>
        </div>
        <form action={signOut} className="brand-text">
          <button
            className="portal-iconbtn"
            aria-label="로그아웃"
            style={{ width: 32, height: 32, background: "transparent" }}
          >
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
