import { createClient } from "@/lib/supabase/server";
import { EnableNotifications } from "@/components/EnableNotifications";
import { formatAge } from "@/lib/owner-report";
import { kstToday } from "@/lib/worklist";
import { signOut } from "@/app/(app)/logout";
import { PetPhoto } from "./PetPhoto";
import { notFound } from "next/navigation";

/**
 * 내 정보 — 반려동물 프로필과 앱 설정.
 *
 * 병원 소식 화면에 프로필 카드를 얹어 두면 매일 보는 화면이 자기소개로 시작한다.
 * 자기 아이 정보는 가끔 확인하는 것이라 따로 둔다. 알림·설치·로그아웃도 여기 모은다.
 */
export default async function PortalProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: p } = await supabase
    .from("patient")
    .select("id, name, species, breed, sex, birth_date, chart_no, photo, hospital:referring_hospital_id(name)")
    .eq("id", id)
    .single();
  if (!p) notFound();
  const hospital = p.hospital as unknown as { name: string } | null;

  // 체중은 진료 때마다 재는 값이라 가장 최근 회차에서 가져온다
  const { data: last } = await supabase
    .from("visit")
    .select("visit_date, weight_kg")
    .eq("patient_id", id)
    .not("weight_kg", "is", null)
    .order("visit_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const age = formatAge(p.birth_date, kstToday());
  const rows: [string, string][] = [
    ["종", p.species ?? "-"],
    ["품종", p.breed ?? "-"],
    ["성별", p.sex ?? "-"],
    ["나이", age ?? "생일 미등록"],
    ["생일", p.birth_date ?? "-"],
    ["체중", last?.weight_kg != null ? `${last.weight_kg}kg (${last.visit_date})` : "-"],
    ["차트번호", p.chart_no ?? "-"],
    ["의뢰 병원", hospital?.name ?? "-"],
  ];

  return (
    <>
      <div className="portal-card" style={{ display: "grid", gap: 14 }}>
        <PetPhoto patientId={p.id} name={p.name} species={p.species} photo={p.photo} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 900 }}>{p.name}</div>
          <div className="portal-tile-sub">
            {[p.species, p.breed].filter(Boolean).join(" / ")}
            {age ? ` · ${age}` : ""}
          </div>
        </div>
      </div>

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>기본 정보</div>
        {rows.map(([k, v], i) => (
          <div key={k} className="info-row" style={i === rows.length - 1 ? { borderBottom: 0 } : undefined}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
        <p className="portal-tile-sub" style={{ margin: "10px 0 0" }}>
          정보가 다르면 병원에 말씀해 주세요. 진료 기록과 이어져 있어 앱에서 직접 고칠 수 없습니다.
        </p>
      </div>

      <EnableNotifications />

      <form action={signOut}>
        <button className="portal-action" style={{ width: "100%" }}>
          로그아웃
        </button>
      </form>
    </>
  );
}
