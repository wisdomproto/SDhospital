import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "../(app)/logout";

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
    <div className="portal-shell">
      <div className="portal-phone">
        <div className="portal-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".08em", opacity: 0.9 }}>
                {role === "owner" ? "보호자 · 읽기 전용" : "의뢰 병원 · 읽기 전용"}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, marginTop: 4 }}>
                {profile?.name ?? "내 반려동물"}
              </div>
            </div>
            <span style={{ fontSize: 26 }}>🐾</span>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: ".85rem", opacity: 0.92 }}>
            SDhospital 진료·입원 기록
          </p>
        </div>
        <div className="portal-content">{children}</div>
        <div style={{ padding: "0 18px 18px" }}>
          <form action={signOut}>
            <button className="btn btn-ghost btn-sm" style={{ width: "100%" }}>
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
