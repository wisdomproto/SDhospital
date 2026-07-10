import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Role } from "@/lib/auth/roles";
import { AppSidebar } from "./AppSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("role, name")
    .eq("id", user.id)
    .single();
  const role = profile?.role as Role | undefined;
  if (role !== "staff") redirect("/portal");

  return (
    <div className="app-shell">
      <AppSidebar name={profile?.name ?? "직원"} />
      <div className="workspace">
        <header className="topbar">
          <Link href="/patients" className="topbar-search" aria-label="검색">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" />
            </svg>
            <span className="ph">환자 · 보호자 · 차트 검색</span>
            <span className="kbd">⌘K</span>
          </Link>
          <Link href="/patients" className="btn btn-primary btn-sm">
            ＋ 진료 입력
          </Link>
          <Link href="/patients/new" className="btn btn-ghost btn-sm">
            환자 등록
          </Link>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
