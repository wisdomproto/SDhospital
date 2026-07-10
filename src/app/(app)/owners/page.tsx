import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { createOwner, deleteOwner, issueOwnerInvite, revokeOwnerInvite } from "./actions";
import { inviteUrl } from "@/lib/invites";
import { headers } from "next/headers";
import Link from "next/link";

type OwnerPet = { id: string; name: string; species: string | null };
type OwnerInvite = { id: string; token: string; used: boolean; owner_id: string | null };

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const host = (await headers()).get("host") ?? "localhost:3000";

  const [{ data: owners }, { data: pets }, { data: invites }] = await Promise.all([
    supabase.from("owner").select("id, name, contact").order("name"),
    supabase.from("patient").select("id, name, species, owner_id"),
    supabase.from("invite").select("id, token, used, owner_id").eq("role", "owner").order("created_at", { ascending: false }),
  ]);

  const petsByOwner = new Map<string, OwnerPet[]>();
  for (const p of (pets ?? []) as (OwnerPet & { owner_id: string | null })[]) {
    if (!p.owner_id) continue;
    const arr = petsByOwner.get(p.owner_id) ?? [];
    arr.push(p);
    petsByOwner.set(p.owner_id, arr);
  }
  const invitesByOwner = new Map<string, OwnerInvite[]>();
  for (const iv of (invites ?? []) as OwnerInvite[]) {
    if (!iv.owner_id) continue;
    const arr = invitesByOwner.get(iv.owner_id) ?? [];
    arr.push(iv);
    invitesByOwner.set(iv.owner_id, arr);
  }

  const ownerList = owners ?? [];

  return (
    <div style={{ maxWidth: 920, display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="eyebrow">Owners · 공유</p>
          <h1 className="page-title">보호자</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>
            보호자별 반려동물과 포털 초대 링크를 관리합니다.
          </p>
        </div>
        <span className="muted" style={{ fontSize: ".78rem" }}>전체 {ownerList.length}명</span>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: ".9rem", margin: 0 }}>{error}</p>
      )}

      {ownerList.length === 0 && (
        <div className="empty-state">등록된 보호자가 없습니다.</div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {ownerList.map((o) => {
          const myPets = petsByOwner.get(o.id) ?? [];
          const myInvites = invitesByOwner.get(o.id) ?? [];
          const pending = myInvites.filter((iv) => !iv.used).length;
          return (
            <div key={o.id} className="card" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, flexShrink: 0 }}
                >
                  {o.name.slice(0, 1)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{o.name}</div>
                  <div style={{ fontSize: ".8rem", color: "var(--muted)" }}>{o.contact ?? "연락처 없음"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {pending > 0 && <span className="pill success">가입 대기 {pending}</span>}
                  <form action={issueOwnerInvite.bind(null, o.id)}>
                    <SubmitButton variant="secondary">＋ 초대 링크</SubmitButton>
                  </form>
                  <Link href={`/owners/${o.id}/edit`} className="btn btn-ghost btn-sm">수정</Link>
                  <form action={deleteOwner.bind(null, o.id)}>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>삭제</button>
                  </form>
                </div>
              </div>

              {/* pets */}
              {myPets.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {myPets.map((p) => (
                    <Link
                      key={p.id}
                      href={`/patients/${p.id}`}
                      className="pill"
                      style={{ textDecoration: "none", gap: 5 }}
                    >
                      <span>{p.species === "고양이" ? "🐱" : "🐶"}</span>
                      {p.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* invites */}
              {myInvites.length > 0 && (
                <div style={{ display: "grid", gap: 8, paddingTop: 4, borderTop: "1px solid var(--line-soft)" }}>
                  {myInvites.map((iv) => (
                    <div key={iv.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <code style={{ background: "var(--surface-soft)", color: "var(--primary-dark)", padding: "5px 9px", borderRadius: 8, fontSize: ".72rem", wordBreak: "break-all", flex: 1, minWidth: 0 }}>
                        {inviteUrl(host, iv.token)}
                      </code>
                      <span className={`pill ${iv.used ? "muted" : "success"}`}>{iv.used ? "가입 완료" : "가입 대기"}</span>
                      <form action={revokeOwnerInvite.bind(null, iv.id)}>
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
        <div className="card-head"><h2 className="section-title">보호자 추가</h2></div>
        <form action={createOwner} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <FormField label="이름"><input name="name" required className={inputClass} /></FormField>
          <FormField label="연락처"><input name="contact" className={inputClass} /></FormField>
          <div><SubmitButton>추가</SubmitButton></div>
        </form>
      </div>
    </div>
  );
}
