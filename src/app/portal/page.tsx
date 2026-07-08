import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "../(app)/logout";

export default async function PortalHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profile")
    .select("role, name")
    .eq("id", user!.id)
    .single();
  const isOwner = profile?.role === "owner";

  const { data: patients } = await supabase
    .from("patient")
    .select("id, name, species, breed")
    .order("name");

  // Owner with a single pet → jump straight into it
  if (isOwner && patients && patients.length === 1) {
    redirect(`/portal/patients/${patients[0].id}`);
  }

  return (
    <>
      <header className="portal-appbar">
        <span className="title">진료 기록</span>
        <form action={signOut}>
          <button className="portal-iconbtn" aria-label="로그아웃">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </header>
      <div className="portal-body">
        <div className="portal-hero">
          <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".08em", opacity: 0.9 }}>
            {isOwner ? "보호자 · 읽기 전용" : "의뢰 병원 · 읽기 전용"}
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, marginTop: 4 }}>
            {profile?.name ?? "내 반려동물"}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: ".85rem", opacity: 0.92 }}>
            SDhospital 진료·입원 기록을 확인하세요.
          </p>
        </div>

        <div style={{ fontWeight: 800, fontSize: ".95rem", padding: "4px 2px" }}>
          {isOwner ? "내 반려동물" : "의뢰 환자"}
        </div>
        {(patients ?? []).map((p) => (
          <Link key={p.id} href={`/portal/patients/${p.id}`} className="portal-tile">
            <span style={{ width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center", background: "var(--surface-soft)", fontSize: 24 }}>
              {p.species === "고양이" ? "🐱" : "🐶"}
            </span>
            <div style={{ flex: 1 }}>
              <div className="portal-tile-title">{p.name}</div>
              <div className="portal-tile-sub">{[p.species, p.breed].filter(Boolean).join(" / ") || "-"}</div>
            </div>
            <span style={{ color: "var(--muted)", fontSize: "1.2rem" }}>›</span>
          </Link>
        ))}
        {(patients ?? []).length === 0 && (
          <div className="empty-state">열람 가능한 환자가 없습니다.</div>
        )}
      </div>
    </>
  );
}
