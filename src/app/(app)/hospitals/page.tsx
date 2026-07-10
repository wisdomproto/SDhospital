import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { createHospital, deleteHospital } from "./actions";
import { issueVetInvite, revokeVetInvite } from "./invites/actions";
import { inviteUrl } from "@/lib/invites";
import { headers } from "next/headers";
import Link from "next/link";

type HospPatient = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  referring_hospital_id: string | null;
  owner: { name: string } | null;
};
type VetInvite = { id: string; token: string; used: boolean; referring_hospital_id: string | null };

export default async function HospitalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const host = (await headers()).get("host") ?? "localhost:3000";

  const [{ data: hospitals }, { data: patients }, { data: invites }] = await Promise.all([
    supabase.from("referring_hospital").select("id, name, contact").order("name"),
    supabase
      .from("patient")
      .select("id, name, species, breed, referring_hospital_id, owner:owner_id(name)")
      .order("name"),
    supabase
      .from("invite")
      .select("id, token, used, referring_hospital_id")
      .eq("role", "referring_vet")
      .order("created_at", { ascending: false }),
  ]);

  const petsByHosp = new Map<string, HospPatient[]>();
  for (const p of (patients ?? []) as unknown as HospPatient[]) {
    if (!p.referring_hospital_id) continue;
    const arr = petsByHosp.get(p.referring_hospital_id) ?? [];
    arr.push(p);
    petsByHosp.set(p.referring_hospital_id, arr);
  }
  const invitesByHosp = new Map<string, VetInvite[]>();
  for (const iv of (invites ?? []) as VetInvite[]) {
    if (!iv.referring_hospital_id) continue;
    const arr = invitesByHosp.get(iv.referring_hospital_id) ?? [];
    arr.push(iv);
    invitesByHosp.set(iv.referring_hospital_id, arr);
  }

  const hospitalList = hospitals ?? [];

  return (
    <div style={{ maxWidth: 960, display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="eyebrow">Referring Hospitals</p>
          <h1 className="page-title">1차 병원</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>
            의뢰 병원별 연결된 환자·보호자와 원장 초대를 관리합니다.
          </p>
        </div>
        <span className="muted" style={{ fontSize: ".78rem" }}>전체 {hospitalList.length}곳</span>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: ".9rem", margin: 0 }}>{error}</p>}

      {hospitalList.length === 0 && <div className="empty-state">등록된 1차 병원이 없습니다.</div>}

      <div style={{ display: "grid", gap: 14 }}>
        {hospitalList.map((h) => {
          const pets = petsByHosp.get(h.id) ?? [];
          const ownerCount = new Set(pets.map((p) => p.owner?.name).filter(Boolean)).size;
          const myInvites = invitesByHosp.get(h.id) ?? [];
          const pending = myInvites.filter((iv) => !iv.used).length;
          return (
            <div key={h.id} className="card" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 40, height: 40, borderRadius: 12, background: "var(--surface-soft)", color: "var(--primary-dark)", display: "grid", placeItems: "center", flexShrink: 0 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 21V6l8-3 8 3v15" />
                    <path d="M12 9v6M9 12h6" />
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{h.name}</div>
                  <div style={{ fontSize: ".8rem", color: "var(--muted)" }}>{h.contact ?? "연락처 없음"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {pending > 0 && <span className="pill success">가입 대기 {pending}</span>}
                  <form action={issueVetInvite.bind(null, h.id)}>
                    <SubmitButton variant="secondary">＋ 원장 초대</SubmitButton>
                  </form>
                  <Link href={`/hospitals/${h.id}/edit`} className="btn btn-ghost btn-sm">수정</Link>
                  <form action={deleteHospital.bind(null, h.id)}>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>삭제</button>
                  </form>
                </div>
              </div>

              {/* connected patients / owners — expandable */}
              <details>
                <summary
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".82rem", fontWeight: 600, color: "var(--ink-2)", padding: "4px 0" }}
                >
                  <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform .15s" }}>
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  연결 환자 {pets.length} · 보호자 {ownerCount}
                </summary>
                <div style={{ marginTop: 10 }}>
                  <DataTable
                    headers={["환자", "종 / 품종", "보호자"]}
                    empty="연결된 환자가 없습니다."
                    rows={pets.map((p) => [
                      <Link
                        key="n"
                        href={`/patients/${p.id}`}
                        style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)", fontWeight: 600 }}
                      >
                        <span className="avatar-chip">{p.species === "고양이" ? "🐱" : "🐶"}</span>
                        {p.name}
                      </Link>,
                      [p.species, p.breed].filter(Boolean).join(" / ") || "-",
                      p.owner?.name ?? "-",
                    ])}
                  />
                </div>
              </details>

              {/* issued invites (integrated per hospital) */}
              {myInvites.length > 0 && (
                <div style={{ display: "grid", gap: 8, paddingTop: 4, borderTop: "1px solid var(--line-soft)" }}>
                  {myInvites.map((iv) => (
                    <div key={iv.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <code style={{ background: "var(--surface-soft)", color: "var(--primary-dark)", padding: "5px 9px", borderRadius: 8, fontSize: ".72rem", wordBreak: "break-all", flex: 1, minWidth: 0 }}>
                        {inviteUrl(host, iv.token)}
                      </code>
                      <span className={`pill ${iv.used ? "muted" : "success"}`}>{iv.used ? "가입 완료" : "가입 대기"}</span>
                      <form action={revokeVetInvite.bind(null, iv.id)}>
                        <button className="link-btn danger">취소</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">병원 추가</h2></div>
        <form action={createHospital} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <FormField label="병원명"><input name="name" required className={inputClass} /></FormField>
          <FormField label="연락처"><input name="contact" className={inputClass} /></FormField>
          <div><SubmitButton>추가</SubmitButton></div>
        </form>
      </div>
    </div>
  );
}
