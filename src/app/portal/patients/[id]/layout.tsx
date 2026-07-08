import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { signOut } from "../../../(app)/logout";
import { PortalTabBar } from "./PortalTabBar";

export default async function PortalPatientLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: patient }, { count }] = await Promise.all([
    supabase.from("patient").select("id, name, species").eq("id", id).single(),
    supabase.from("patient").select("id", { count: "exact", head: true }),
  ]);
  if (!patient) notFound();
  const showBack = (count ?? 1) > 1;

  return (
    <>
      <header className="portal-appbar">
        {showBack ? (
          <Link href="/portal" className="portal-iconbtn" aria-label="목록">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        ) : (
          <span style={{ fontSize: 20 }}>{patient.species === "고양이" ? "🐱" : "🐶"}</span>
        )}
        <span className="title">{patient.name}</span>
        <form action={signOut}>
          <button className="portal-iconbtn" aria-label="로그아웃">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </header>

      <div className="portal-body">{children}</div>

      <PortalTabBar patientId={patient.id} />
    </>
  );
}
