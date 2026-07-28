import { createClient } from "@/lib/supabase/server";
import { deletePatient } from "../actions";
import { createVisit } from "./visits/actions";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";
import { notFound } from "next/navigation";

const ACTOR_LABEL: Record<string, string> = {
  staff: "직원",
  referring_vet: "1차병원 원장",
  owner: "보호자",
};

export default async function PatientOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patient")
    .select(
      "id, chart_no, name, species, breed, sex, birth_date, note, owner:owner_id(name, contact), hospital:referring_hospital_id(name, contact)"
    )
    .eq("id", id)
    .single();
  if (!p) notFound();

  const owner = p.owner as unknown as { name: string; contact: string | null } | null;
  const hospital = p.hospital as unknown as { name: string; contact: string | null } | null;

  const [{ data: visits }, { data: admissions }, { data: accessLog }] = await Promise.all([
    supabase
      .from("visit")
      .select("id, visit_date, visit_no, note")
      .eq("patient_id", id)
      .order("visit_date", { ascending: false }),
    supabase
      .from("admission")
      .select("id, admitted_at, discharged_at, status")
      .eq("patient_id", id)
      .order("admitted_at", { ascending: false }),
    supabase
      .from("access_log")
      .select("id, actor_role, target, at")
      .eq("patient_id", id)
      .order("at", { ascending: false })
      .limit(20),
  ]);

  const info: [string, string][] = [
    ["종", p.species ?? "-"],
    ["품종", p.breed ?? "-"],
    ["성별", p.sex ?? "-"],
    ["생일", p.birth_date ?? "-"],
    ["보호자", owner ? `${owner.name}${owner.contact ? ` · ${owner.contact}` : ""}` : "-"],
    ["의뢰 병원", hospital ? `${hospital.name}${hospital.contact ? ` · ${hospital.contact}` : ""}` : "-"],
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="eyebrow">Patient · 개요{p.chart_no ? ` · 차트 ${p.chart_no}` : ""}</p>
          <h1 className="page-title">{p.name}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <span className="pill">{[p.species, p.breed].filter(Boolean).join(" / ") || "종 미상"}</span>
            {p.sex && <span className="pill muted">{p.sex}</span>}
            {hospital && <span className="pill">의뢰 · {hospital.name}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/patients/${p.id}/edit`} className="btn btn-ghost btn-sm">수정</Link>
          <form action={deletePatient.bind(null, p.id)}>
            <button className="btn btn-danger btn-sm">삭제</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">기본 정보</h2></div>
        <div className="info-grid">
          {info.map(([k, v]) => (
            <div key={k} className="info-row">
              <span className="k">{k}</span>
              <span className="v">{v}</span>
            </div>
          ))}
        </div>
        {p.note && <p style={{ marginTop: 12, fontSize: ".9rem", color: "var(--muted)" }}>{p.note}</p>}
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">진료 회차</h2>
          <span className="pill muted">{(visits ?? []).length}건</span>
        </div>
        <DataTable
          headers={["날짜", "회차", "진료 요약", ""]}
          empty="진료 회차가 없습니다."
          rows={(visits ?? []).map((v) => [
            v.visit_date,
            v.visit_no ?? "-",
            (v.note ?? "").slice(0, 40) || "-",
            <Link key="o" href={`/patients/${p.id}/v/${v.id}`} className="link-btn">열기 →</Link>,
          ])}
        />
        <details style={{ marginTop: 12 }}>
          <summary><span className="btn btn-secondary btn-sm">+ 회차 추가</span></summary>
          <form action={createVisit.bind(null, p.id)} style={{ display: "grid", gap: 12, maxWidth: 460, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="날짜"><input type="date" name="visit_date" className={inputClass} /></FormField>
              <FormField label="회차"><input name="visit_no" inputMode="numeric" className={inputClass} /></FormField>
            </div>
            <FormField label="진료 내용"><textarea name="note" rows={3} className={inputClass} /></FormField>
            <SubmitButton>회차 추가</SubmitButton>
          </form>
        </details>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">입원</h2>
          <span className="pill muted">{(admissions ?? []).length}건</span>
        </div>
        <DataTable
          headers={["입원일", "퇴원일", "상태", ""]}
          empty="입원 이력이 없습니다."
          rows={(admissions ?? []).map((a) => [
            a.admitted_at,
            a.discharged_at ?? "-",
            a.status === "admitted" ? (
              <span key="s" className="pill warning">입원중</span>
            ) : (
              <span key="s" className="pill success">퇴원</span>
            ),
            <Link key="o" href={`/patients/${p.id}/a/${a.id}`} className="link-btn">열기 →</Link>,
          ])}
        />
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          입원은 진료 회차에서 시작합니다. 위 회차를 열어 <b>입원 시작</b>을 누르세요.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">열람 기록</h2>
          <span className="pill muted">최근 {(accessLog ?? []).length}건</span>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          외부(1차병원·보호자)에서 이 환자 기록을 연 내역입니다.
        </p>
        <DataTable
          headers={["시각", "열람자", "대상"]}
          empty="열람 기록이 없습니다."
          rows={(accessLog ?? []).map((l) => [
            new Date(l.at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }),
            ACTOR_LABEL[l.actor_role] ?? l.actor_role,
            l.target,
          ])}
        />
      </div>
    </div>
  );
}
