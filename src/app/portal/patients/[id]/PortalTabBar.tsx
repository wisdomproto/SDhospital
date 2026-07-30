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
    case "me":
      return (<svg {...c}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" /></svg>);
    case "chat":
      return (<svg {...c}><path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" /><path d="M9 10h6M9 13h4" /></svg>);
    case "case":
      return (<svg {...c}><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z" /><path d="M9 7.5h6M9 11h4" /></svg>);
    default:
      return null;
  }
}

/**
 * 새 리포트가 왔는데 탭에 표시가 없으면, 알림을 못 본 보호자는 영영 모른다.
 * 배지는 "진료 기록" 에만 붙인다 — 회차 리포트와 입원 경과가 전부 그 안에 있다.
 */
export function PortalTabBar({
  patientId,
  unread = 0,
  news = 0,
}: {
  patientId: string;
  unread?: number;
  news?: number;
}) {
  const pathname = usePathname();
  const base = `/portal/patients/${patientId}`;
  /** 진료 기록이 **아닌** 화면들. 새 탭이 생기면 여기에만 추가한다 */
  const OTHERS = ["cases", "chat", "profile"];
  // 입원은 따로 두지 않는다 — 입원은 진료 회차에 딸린 기록이라 "진료 기록" 안에서 이어 보는 게 맞다.
  const tabs = [
    { href: base, label: "병원 소식", icon: "home", match: (p: string) => p === base, badge: news },
    {
      href: `${base}/visits`,
      label: "진료 기록",
      icon: "visit",
      badge: unread,
      // 회차·입원·검진·동의서가 전부 여기 딸린다. 목록을 적어 두면 다음에 하나 늘 때 빠뜨리고,
      // 그러면 그 화면에서만 탭이 아무것도 안 켜져 앱 밖으로 나온 것처럼 보인다.
      match: (p: string) => p !== base && !OTHERS.some((o) => p.startsWith(`${base}/${o}`)),
    },
    { href: `${base}/cases`, label: "치료 사례", icon: "case", match: (p: string) => p.startsWith(`${base}/cases`) },
    { href: `${base}/chat`, label: "AI 채팅", icon: "chat", match: (p: string) => p.startsWith(`${base}/chat`) },
    { href: `${base}/profile`, label: "내 정보", icon: "me", match: (p: string) => p.startsWith(`${base}/profile`) },
  ];
  return (
    <nav className="portal-tabbar">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`portal-tab${t.match(pathname) ? " active" : ""}`}>
          <span className="portal-tab-ic">
            <Icon name={t.icon} />
            {!!t.badge && (
              <span className="tab-badge" aria-label={`새 소식 ${t.badge}`}>
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
