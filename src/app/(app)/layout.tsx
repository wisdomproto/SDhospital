import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Role } from "@/lib/auth/roles";
import { AppSidebar } from "./AppSidebar";
import { kstToday } from "@/lib/worklist";
import { CommandPalette } from "./CommandPalette";

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

  // "오늘 할 일" 배지 — 어느 화면에 있든 보내야 할 리포트가 남은 걸 알 수 있어야 한다.
  // 알림 채널이 붙기 전까지는 이게 유일한 재촉이다.
  const today = kstToday();
  const [{ count: unsentVisits }, { data: admitted }, { data: sent }] = await Promise.all([
    supabase
      .from("visit")
      .select("id", { count: "exact", head: true })
      .not("closed_at", "is", null)
      .is("report_sent_at", null),
    supabase.from("admission").select("id").eq("status", "admitted"),
    supabase.from("admission_report").select("admission_id").eq("report_date", today).not("sent_at", "is", null),
  ]);
  const sentSet = new Set((sent ?? []).map((r) => r.admission_id));
  const todoCount = (unsentVisits ?? 0) + (admitted ?? []).filter((a) => !sentSet.has(a.id)).length;

  return (
    <div className="app-shell">
      <AppSidebar name={profile?.name ?? "직원"} todoCount={todoCount} />
      <div className="workspace">
        <header className="topbar">
          <CommandPalette />
          <Link href="/patients/new" className="btn btn-ghost btn-sm">
            환자 등록
          </Link>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
