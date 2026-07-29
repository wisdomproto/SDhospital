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
    case "chat":
      return (<svg {...c}><path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" /><path d="M9 10h6M9 13h4" /></svg>);
    default:
      return null;
  }
}

export function PortalTabBar({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const base = `/portal/patients/${patientId}`;
  // 입원은 따로 두지 않는다 — 입원은 진료 회차에 딸린 기록이라 "진료 기록" 안에서 이어 보는 게 맞다.
  const tabs = [
    { href: base, label: "병원 소식", icon: "home", match: (p: string) => p === base },
    {
      href: `${base}/visits`,
      label: "진료 기록",
      icon: "visit",
      match: (p: string) => p.startsWith(`${base}/visits`) || p.startsWith(`${base}/admissions`),
    },
    { href: `${base}/chat`, label: "AI 채팅", icon: "chat", match: (p: string) => p.startsWith(`${base}/chat`) },
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
