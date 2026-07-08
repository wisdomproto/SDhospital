import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PortalLayout({
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
  const role = profile?.role;
  if (role === "staff") redirect("/");
  if (role !== "owner" && role !== "referring_vet") redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/portal" className="text-sm font-medium">
          진료 기록
        </Link>
        <span className="text-sm text-gray-500">
          {profile?.name ?? ""} · {role === "owner" ? "보호자" : "의뢰 병원"} (읽기 전용)
        </span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
