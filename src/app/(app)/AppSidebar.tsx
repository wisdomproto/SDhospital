"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    default:
      return null;
  }
}

export function AppSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const collapsed =
    /^\/patients\/[^/]+/.test(pathname) && !pathname.startsWith("/patients/new");

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
        <span className="brand-text">SDhospital</span>
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
      <div className="role-panel">
        <span className="role-badge">STAFF · {name}</span>
        <form action={signOut}>
          <button className="btn btn-ghost btn-sm">로그아웃</button>
        </form>
      </div>
    </aside>
  );
}
