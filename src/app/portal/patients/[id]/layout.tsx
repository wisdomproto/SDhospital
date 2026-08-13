import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { signOut } from "../../../(app)/logout";
import { PortalTabBar } from "./PortalTabBar";
import { InstallApp } from "../../InstallApp";
import { PetSwitcher, type Pet } from "./PetSwitcher";
import { RememberPet } from "../../RememberPet";
import { unreadCounts } from "@/lib/reports";
import { cookies } from "next/headers";
import { NEWS_SEEN_COOKIE } from "@/lib/seen";

export default async function PortalPatientLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS 상 보호자에게는 자기 반려동물만 조회된다
  const { data: pets } = await supabase
    .from("patient")
    .select("id, name, species, breed, photo, emr_owner:emr_owner_id(name)")
    .order("name");
  const patient = (pets ?? []).find((p) => p.id === id);
  if (!patient) notFound();

  const unread = await unreadCounts(supabase, (pets ?? []).map((p) => p.id));

  // 마지막으로 소식 화면을 연 뒤에 올라온 것 (RLS 가 기간 밖 소식은 이미 감춘다)
  const seen = (await cookies()).get(NEWS_SEEN_COOKIE)?.value;
  let newsQuery = supabase.from("notice").select("id", { count: "exact", head: true });
  if (seen) newsQuery = newsQuery.gt("starts_on", seen.slice(0, 10));
  const { count: newNews } = await newsQuery;
  const list: Pet[] = (pets ?? []).map((p) => ({
    ...p,
    owner: (p.emr_owner as unknown as { name: string } | null)?.name ?? null,
    unread: unread.get(p.id) ?? 0,
  }));
  const current = list.find((p) => p.id === id)!;

  return (
    <>
      <RememberPet patientId={patient.id} />
      <header className="portal-appbar">
        <span className="portal-head-av">
          {patient.photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={patient.photo} alt="" />
          ) : (
            <span style={{ fontSize: 20 }}>{patient.species === "고양이" ? "🐱" : "🐶"}</span>
          )}
        </span>
        <PetSwitcher pets={list} current={current} />
        <InstallApp />
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

      <PortalTabBar patientId={patient.id} unread={current.unread} news={newNews ?? 0} />
    </>
  );
}
