"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Visit = { id: string; visit_date: string; visit_no: number | null };
type Admission = { id: string; admitted_at: string; status: string };

export function PatientNav({
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
  const base = `/patients/${patientId}`;
  const overviewActive = pathname === base || pathname === `${base}/edit`;

  return (
    <aside className="patient-nav">
      <div className="pnav-head">
        <span className="avatar" style={{ width: 42, height: 42, borderRadius: 13, fontSize: 20 }}>
          {species === "고양이" ? "🐱" : "🐶"}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>{name}</div>
          <Link href="/patients" className="pnav-meta" style={{ textDecoration: "none" }}>
            ← 환자 목록
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
        return (
          <Link key={v.id} href={href} className={`pnav-item${pathname === href ? " active" : ""}`}>
            <span>{v.visit_date}</span>
            <span className="pnav-meta">{v.visit_no != null ? `${v.visit_no}회` : ""}</span>
          </Link>
        );
      })}

      <div className="pnav-section">입원 · {admissions.length}</div>
      {admissions.length === 0 && <span className="pnav-meta" style={{ padding: "4px 11px" }}>없음</span>}
      {admissions.map((a) => {
        const href = `${base}/a/${a.id}`;
        return (
          <Link key={a.id} href={href} className={`pnav-item${pathname === href ? " active" : ""}`}>
            <span>{a.admitted_at}</span>
            <span className="pnav-meta">{a.status === "admitted" ? "입원중" : "퇴원"}</span>
          </Link>
        );
      })}
    </aside>
  );
}
