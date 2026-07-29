"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Visit = { id: string; visit_date: string; visit_no: number | null };
type Admission = { id: string; visit_id: string | null; admitted_at: string; status: string };

export function ReferralPatientNav({
  patientId,
  name,
  species,
  visits,
  admissions,
}: {
  patientId: string;
  name: string;
  species: string | null;
  visits: Visit[];
  admissions: Admission[];
}) {
  const pathname = usePathname();
  const base = `/referral/patients/${patientId}`;
  // visit_id 가 없는 옛 입원(0007 이전 데이터)은 갈 곳이 없으니 따로 모아 둔다
  const visitIds = new Set(visits.map((v) => v.id));
  const orphans = admissions.filter((a) => !a.visit_id || !visitIds.has(a.visit_id));
  const overviewActive = pathname === base;

  return (
    <aside className="patient-nav">
      <div className="pnav-head">
        <span className="avatar" style={{ width: 42, height: 42, borderRadius: 13, fontSize: 20 }}>
          {species === "고양이" ? "🐱" : "🐶"}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>{name}</div>
          <Link href="/referral" className="pnav-meta" style={{ textDecoration: "none" }}>
            ← 의뢰 환자 목록
          </Link>
        </div>
      </div>

      <Link href={base} className={`pnav-item${overviewActive ? " active" : ""}`}>
        개요
      </Link>

      <div className="pnav-section">진료 회차 · {visits.length}</div>
      {visits.length === 0 && <span className="pnav-meta" style={{ padding: "4px 11px" }}>없음</span>}
      {visits.map((v) => {
        const href = `${base}/v/${v.id}`;
        // 입원은 회차에 딸린 기록이다. 따로 떼어 놓으면 "이 입원이 어느 진료였나"를
        // 날짜로 되짚어야 한다 — 데이터가 이미 알고 있는 것을 사람이 다시 맞추는 셈이다.
        const stays = admissions.filter((a) => a.visit_id === v.id);
        return (
          <div key={v.id}>
            <Link href={href} className={`pnav-item${pathname === href ? " active" : ""}`}>
              <span>{v.visit_date}</span>
              <span className="pnav-meta">{v.visit_no != null ? `${v.visit_no}회` : ""}</span>
            </Link>
            {stays.map((a) => {
              const ahref = `${base}/a/${a.id}`;
              return (
                <Link key={a.id} href={ahref} className={`pnav-item pnav-sub${pathname === ahref ? " active" : ""}`}>
                  <span>입원 {a.admitted_at}</span>
                  <span className="pnav-meta">{a.status === "admitted" ? "입원중" : "퇴원"}</span>
                </Link>
              );
            })}
          </div>
        );
      })}

      {orphans.length > 0 && (
        <>
          <div className="pnav-section">회차 없는 입원 · {orphans.length}</div>
          {orphans.map((a) => {
            const href = `${base}/a/${a.id}`;
            return (
              <Link key={a.id} href={href} className={`pnav-item${pathname === href ? " active" : ""}`}>
                <span>{a.admitted_at}</span>
                <span className="pnav-meta">{a.status === "admitted" ? "입원중" : "퇴원"}</span>
              </Link>
            );
          })}
        </>
      )}
    </aside>
  );
}
