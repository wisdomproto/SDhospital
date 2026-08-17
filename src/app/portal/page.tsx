import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_PET_COOKIE } from "@/lib/last-pet";
import { HOSPITAL_PHONE } from "@/lib/hospital";

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
  // ⚠️ **로그인은 됐는데 보여 줄 아이가 없는 자리가 실제로 생긴다** — 생사 미확정인 아이는
  // RLS 가 감추기 때문이다(`0038`). 그 아이가 유일한 반려동물이면 여기가 0이 된다.
  // 예전엔 `/login` 으로 보냈는데, 이미 로그인한 사람이라 **로그인 화면과 무한히 오간다.**
  // ⚠️ 이유는 설명하지 않는다 — 「확인 중」이 우리가 할 수 있는 말의 전부다.
  if (mine.length === 0) {
    return (
      <div className="portal-card" style={{ margin: 16 }}>
        <div style={{ fontWeight: 800 }}>지금은 보여 드릴 수 있는 기록이 없어요</div>
        <p className="portal-tile-sub" style={{ margin: "8px 0 0" }}>
          담당 선생님이 기록을 확인하고 있어요. 확인이 끝나면 여기에서 다시 보실 수 있습니다.
          <br />
          궁금하신 것은 병원으로 전화 주시면 바로 답해 드릴게요.
        </p>
        <a className="chat-call" style={{ marginTop: 12 }} href={`tel:${HOSPITAL_PHONE}`}>
          📞 병원에 전화하기 {HOSPITAL_PHONE}
        </a>
      </div>
    );
  }

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
