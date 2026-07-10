import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReferralSidebar } from "./ReferralSidebar";

// 1차(의뢰) 병원 원장 전용 데스크탑 포털.
// 직원 EMR과 동일한 셸/컴포넌트를 재사용하고, 편집 기능만 제거한 읽기 전용 화면.
export default async function ReferralLayout({
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
    .select("role, name, hospital:referring_hospital_id(name)")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (role === "staff") redirect("/");
  if (role === "owner") redirect("/portal");
  if (role !== "referring_vet") redirect("/login");

  const hospital =
    (profile?.hospital as unknown as { name: string } | null)?.name ??
    profile?.name ??
    "의뢰 병원";

  return (
    <div className="app-shell">
      <ReferralSidebar hospital={hospital} />
      <div className="workspace">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pill">🏥 {hospital}</span>
            <span className="pill muted">읽기 전용</span>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
