import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { createHospital, deleteHospital } from "./actions";
import { issueVetInvite, revokeVetInvite } from "./invites/actions";
import { inviteUrl } from "@/lib/invites";
import { headers } from "next/headers";
import Link from "next/link";

export default async function HospitalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: hospitals } = await supabase
    .from("referring_hospital")
    .select("id, name, contact")
    .order("name");

  const host = (await headers()).get("host") ?? "localhost:3000";
  const { data: vetInvites } = await supabase
    .from("invite")
    .select("id, token, used, hospital:referring_hospital_id(name)")
    .eq("role", "referring_vet")
    .order("created_at", { ascending: false });

  return (
    <div style={{ maxWidth: 880, display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">Referring Hospitals</p>
        <h1 className="page-title">1차 병원</h1>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">병원 목록</h2>
          <span className="pill muted">{(hospitals ?? []).length}곳</span>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: ".9rem", margin: "0 0 10px" }}>{error}</p>}
        <DataTable
          headers={["병원명", "연락처", ""]}
          empty="등록된 1차 병원이 없습니다."
          rows={(hospitals ?? []).map((h) => [
            h.name,
            h.contact ?? "-",
            <span key="a" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Link href={`/hospitals/${h.id}/edit`} className="link-btn">수정</Link>
              <form action={issueVetInvite.bind(null, h.id)}>
                <button className="link-btn">초대 발급</button>
              </form>
              <form action={deleteHospital.bind(null, h.id)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </span>,
          ])}
        />
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">발급된 원장 초대</h2></div>
        <div style={{ display: "grid", gap: 8 }}>
          {(vetInvites ?? []).map((iv) => (
            <div key={iv.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: ".85rem" }}>
                {(iv.hospital as unknown as { name: string } | null)?.name ?? "-"}
              </span>
              <code style={{ background: "var(--surface-soft)", padding: "5px 9px", borderRadius: 8, fontSize: ".72rem", wordBreak: "break-all" }}>
                {inviteUrl(host, iv.token)}
              </code>
              <span className={`pill ${iv.used ? "muted" : "success"}`}>{iv.used ? "사용됨" : "미사용"}</span>
              <form action={revokeVetInvite.bind(null, iv.id)}>
                <button className="link-btn danger">취소</button>
              </form>
            </div>
          ))}
          {(vetInvites ?? []).length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: 0 }}>발급된 초대가 없습니다.</p>
          )}
        </div>
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
