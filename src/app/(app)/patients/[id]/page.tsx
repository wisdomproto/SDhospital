import { createClient } from "@/lib/supabase/server";
import { deletePatient } from "../actions";
import { createVisit } from "./visits/actions";
import { createAdmission } from "./admissions/actions";
import { issueOwnerInvite, revokeInvite } from "./invites/actions";
import { inviteUrl } from "@/lib/invites";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PatientDetail({
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

  const { data: visits } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note")
    .eq("patient_id", id)
    .order("visit_date", { ascending: false });

  const { data: admissions } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status")
    .eq("patient_id", id)
    .order("admitted_at", { ascending: false });

  const rows: [string, string][] = [
    ["종/품종", [p.species, p.breed].filter(Boolean).join(" / ") || "-"],
    ["성별", p.sex ?? "-"],
    ["생일", p.birth_date ?? "-"],
    ["보호자", owner ? `${owner.name}${owner.contact ? ` (${owner.contact})` : ""}` : "-"],
    [
      "의뢰 병원",
      hospital ? `${hospital.name}${hospital.contact ? ` (${hospital.contact})` : ""}` : "-",
    ],
    ["비고", p.note ?? "-"],
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <div className="flex gap-3 text-sm">
          <Link href={`/patients/${p.id}/edit`} className="link-btn">
            수정
          </Link>
          <form action={deletePatient.bind(null, p.id)}>
            <button className="link-btn danger">삭제</button>
          </form>
        </div>
      </div>

      <dl className="divide-y rounded border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex px-4 py-2 text-sm">
            <dt className="w-28 shrink-0 text-gray-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">진료 회차</h2>
        <DataTable
          headers={["날짜", "회차", "요약", ""]}
          empty="회차가 없습니다."
          rows={(visits ?? []).map((v) => [
            v.visit_date,
            v.visit_no ?? "-",
            (v.note ?? "").slice(0, 30) || "-",
            <Link key="o" href={`/visits/${v.id}`} className="link-btn">
              열기
            </Link>,
          ])}
        />
        <form
          action={createVisit.bind(null, p.id)}
          className="grid max-w-md grid-cols-2 gap-3"
        >
          <FormField label="날짜">
            <input type="date" name="visit_date" className={inputClass} />
          </FormField>
          <FormField label="회차">
            <input name="visit_no" inputMode="numeric" className={inputClass} />
          </FormField>
          <div className="col-span-2">
            <FormField label="진료 내용">
              <textarea name="note" rows={3} className={inputClass} />
            </FormField>
          </div>
          <div className="col-span-2">
            <SubmitButton>회차 추가</SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">입원</h2>
        <DataTable
          headers={["입원일", "퇴원일", "상태", ""]}
          empty="입원 이력이 없습니다."
          rows={(admissions ?? []).map((a) => [
            a.admitted_at,
            a.discharged_at ?? "-",
            a.status === "admitted" ? "입원중" : "퇴원",
            <Link key="o" href={`/admissions/${a.id}`} className="link-btn">
              열기
            </Link>,
          ])}
        />
        <form
          action={createAdmission.bind(null, p.id)}
          className="grid max-w-md grid-cols-2 gap-3"
        >
          <FormField label="입원일">
            <input type="date" name="admitted_at" className={inputClass} />
          </FormField>
          <div className="col-span-2">
            <FormField label="비고">
              <input name="note" className={inputClass} />
            </FormField>
          </div>
          <div className="col-span-2">
            <SubmitButton>입원 등록</SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">보호자 초대</h2>
        <ul className="space-y-1 text-sm">
          {(ownerInvites ?? []).map((iv) => (
            <li key={iv.id} className="flex items-center gap-3">
              <code className="rounded bg-gray-100 px-2 py-1 text-xs break-all">
                {inviteUrl(host, iv.token)}
              </code>
              <span className="shrink-0 text-gray-500">{iv.used ? "사용됨" : "미사용"}</span>
              <form action={revokeInvite.bind(null, p.id, iv.id)}>
                <button className="link-btn danger">취소</button>
              </form>
            </li>
          ))}
          {(ownerInvites ?? []).length === 0 && (
            <li className="text-gray-500">발급된 초대가 없습니다.</li>
          )}
        </ul>
        <form action={issueOwnerInvite.bind(null, p.id, p.owner_id)}>
          <SubmitButton>보호자 초대 링크 발급</SubmitButton>
        </form>
      </section>
    </div>
  );
}
