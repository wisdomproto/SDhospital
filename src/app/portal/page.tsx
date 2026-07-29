import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_PET_COOKIE } from "@/lib/last-pet";

/**
 * 보호자 홈 = 화면이 아니라 갈림길이다.
 *
 * 반려동물 목록 화면을 따로 두지 않는다. 앱을 열 때마다 고르게 하면 군더더기이고,
 * 바꿀 일은 헤더에서 한다. 마지막에 보던 아이로 바로 들어간다.
 * 푸시 알림의 기본 주소(`/portal`)도 여기로 들어오므로 이 판단이 한 곳에 있어야 한다.
 */
export default async function PortalHome() {
  const supabase = await createClient();

  // RLS 상 자기 반려동물만 조회된다 — 쿠키 값이 남의 아이여도 여기서 걸러진다
  const { data: patients } = await supabase.from("patient").select("id").order("name");
  const mine = patients ?? [];
  if (mine.length === 0) redirect("/login");

  const last = (await cookies()).get(LAST_PET_COOKIE)?.value;
  if (last && mine.some((p) => p.id === last)) redirect(`/portal/patients/${last}`);

  // 처음 들어온 보호자 — 최근에 진료받은 아이가 궁금할 확률이 가장 높다
  const { data: recent } = await supabase
    .from("visit")
    .select("patient_id")
    .in("patient_id", mine.map((p) => p.id))
    .order("visit_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  redirect(`/portal/patients/${recent?.patient_id ?? mine[0].id}`);
}
