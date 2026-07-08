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
