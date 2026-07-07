import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Role } from "@/lib/auth/roles";

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
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <nav className="flex gap-4 text-sm">
          <Link href="/">대시보드</Link>
          <Link href="/patients">환자</Link>
          <Link href="/owners">보호자</Link>
          <Link href="/hospitals">1차병원</Link>
          <Link href="/drugs">약품</Link>
        </nav>
        <span className="text-sm text-gray-500">{profile?.name} · 직원</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
