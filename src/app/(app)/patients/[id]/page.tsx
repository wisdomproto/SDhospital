import { createClient } from "@/lib/supabase/server";
import { deletePatient } from "../actions";
import { createVisit } from "./visits/actions";
import { createAdmission } from "./admissions/actions";
import { issueOwnerInvite, revokeInvite } from "./invites/actions";
import { inviteUrl } from "@/lib/invites";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

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
      "id, name, species, breed, sex, birth_date, note, owner_id, owner:owner_id(name, contact), hospital:referring_hospital_id(name, contact)"
    )
    .eq("id", id)
    .single();
  if (!p) notFound();

  const owner = p.owner as unknown as { name: string; contact: string | null } | null;
  const hospital = p.hospital as unknown as { name: string; contact: string | null } | null;

  const host = (await headers()).get("host") ?? "localhost:3000";
  const { data: ownerInvites } = await supabase
    .from("invite")
    .select("id, token, used")
    .eq("owner_id", p.owner_id)
    .eq("role", "owner")
    .order("created_at", { ascending: false });

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
          <p className="eyebrow">Patient · 개요</p>
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

      <div className="quickadd-grid">
        <div className="card">
          <div className="card-head"><h2 className="section-title">진료 회차 추가</h2></div>
          <form action={createVisit.bind(null, p.id)} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="날짜"><input type="date" name="visit_date" className={inputClass} /></FormField>
              <FormField label="회차"><input name="visit_no" inputMode="numeric" className={inputClass} /></FormField>
            </div>
            <FormField label="진료 내용"><textarea name="note" rows={3} className={inputClass} /></FormField>
            <SubmitButton>회차 추가</SubmitButton>
          </form>
        </div>

        <div className="card">
          <div className="card-head"><h2 className="section-title">입원 등록</h2></div>
          <form action={createAdmission.bind(null, p.id)} style={{ display: "grid", gap: 12 }}>
            <FormField label="입원일"><input type="date" name="admitted_at" className={inputClass} /></FormField>
            <FormField label="비고"><input name="note" className={inputClass} /></FormField>
            <SubmitButton>입원 등록</SubmitButton>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">보호자 초대</h2>
          <form action={issueOwnerInvite.bind(null, p.id, p.owner_id)}>
            <SubmitButton variant="secondary">+ 초대 링크 발급</SubmitButton>
          </form>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {(ownerInvites ?? []).map((iv) => (
            <div key={iv.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <code style={{ background: "var(--surface-soft)", padding: "5px 9px", borderRadius: 8, fontSize: ".72rem", wordBreak: "break-all" }}>
                {inviteUrl(host, iv.token)}
              </code>
              <span className={`pill ${iv.used ? "muted" : "success"}`}>{iv.used ? "사용됨" : "미사용"}</span>
              <form action={revokeInvite.bind(null, p.id, iv.id)}>
                <button className="link-btn danger">취소</button>
              </form>
            </div>
          ))}
          {(ownerInvites ?? []).length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: 0 }}>발급된 초대가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
