import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { createOwner, deleteOwner } from "./actions";
import Link from "next/link";

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: owners } = await supabase
    .from("owner")
    .select("id, name, contact")
    .order("name");

  return (
    <div style={{ maxWidth: 880, display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">Owners</p>
        <h1 className="page-title">보호자</h1>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">보호자 목록</h2>
          <span className="pill muted">{(owners ?? []).length}명</span>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: ".9rem", margin: "0 0 10px" }}>{error}</p>}
        <DataTable
          headers={["이름", "연락처", ""]}
          empty="등록된 보호자가 없습니다."
          rows={(owners ?? []).map((o) => [
            o.name,
            o.contact ?? "-",
            <span key="a" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Link href={`/owners/${o.id}/edit`} className="link-btn">수정</Link>
              <form action={deleteOwner.bind(null, o.id)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </span>,
          ])}
        />
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
