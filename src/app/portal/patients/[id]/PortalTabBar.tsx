"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ name }: { name: string }) {
  const c = {
    width: 22,
    height: 22,
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
    case "visit":
      return (<svg {...c}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v3h6V3M8.5 11h7M8.5 15h4" /></svg>);
    case "admission":
      return (<svg {...c}><path d="M3 18v-6a2 2 0 0 1 2-2h10a4 4 0 0 1 4 4v4" /><path d="M3 14h18M3 18h18" /><circle cx="7.5" cy="9" r="1.5" /></svg>);
    default:
      return null;
  }
}

export function PortalTabBar({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const base = `/portal/patients/${patientId}`;
  const tabs = [
    { href: base, label: "개요", icon: "home", match: (p: string) => p === base },
    { href: `${base}/visits`, label: "진료", icon: "visit", match: (p: string) => p.startsWith(`${base}/visits`) },
    { href: `${base}/admissions`, label: "입원", icon: "admission", match: (p: string) => p.startsWith(`${base}/admissions`) },
  ];
  return (
    <nav className="portal-tabbar">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`portal-tab${t.match(pathname) ? " active" : ""}`}>
          <Icon name={t.icon} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
