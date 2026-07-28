import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InstallApp } from "./InstallApp";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SD동물의료센터",
  appleWebApp: { capable: true, title: "SD동물병원", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f9b8e",
  // 노치·홈바 영역까지 앱처럼 쓰기 위해
  viewportFit: "cover",
};

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
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role;
  if (role === "staff") redirect("/");
  // 1차병원 원장은 PC 데스크탑 포털(/referral)을 사용한다.
  if (role === "referring_vet") redirect("/referral");
  if (role !== "owner") redirect("/login");

  return (
    <div className="portal-shell">
      <div className="portal-phone">{children}</div>
      <InstallApp />
    </div>
  );
}
