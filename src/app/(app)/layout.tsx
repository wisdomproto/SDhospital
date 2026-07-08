import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Role } from "@/lib/auth/roles";
import { Sidebar } from "./Sidebar";
import { signOut } from "./logout";

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
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-glyph">🐾</span>
          <span>SDhospital</span>
        </div>
        <Sidebar />
        <div className="role-panel">
          <span className="role-badge">STAFF · {profile?.name ?? "직원"}</span>
          <form action={signOut}>
            <button className="btn btn-ghost btn-sm">로그아웃</button>
          </form>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span className="hospital-chip">SDhospital · 2차 동물병원 · Asia/Seoul</span>
          <Link href="/patients/new" className="btn btn-secondary btn-sm">
            + 환자 등록
          </Link>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
