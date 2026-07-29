import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { signOut } from "../../../(app)/logout";
import { PortalTabBar } from "./PortalTabBar";
import { InstallApp } from "../../InstallApp";
import { PetSwitcher, type Pet } from "./PetSwitcher";
import { RememberPet } from "../../RememberPet";
import { unreadCounts } from "@/lib/reports";

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
    .select("id, name, species, breed, photo")
    .order("name");
  const patient = (pets ?? []).find((p) => p.id === id);
  if (!patient) notFound();

  const unread = await unreadCounts(supabase, (pets ?? []).map((p) => p.id));
  const list: Pet[] = (pets ?? []).map((p) => ({ ...p, unread: unread.get(p.id) ?? 0 }));
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

      <PortalTabBar patientId={patient.id} unread={current.unread} />
    </>
  );
}
