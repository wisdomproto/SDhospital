import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { createDrug, deleteDrug } from "./actions";
import Link from "next/link";

export default async function DrugsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: drugs } = await supabase
    .from("drug")
    .select("id, name, unit, spec")
    .order("name");

  return (
    <div style={{ maxWidth: 880, display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">Drugs</p>
        <h1 className="page-title">약품</h1>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">약품 목록</h2>
          <span className="pill muted">{(drugs ?? []).length}종</span>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: ".9rem", margin: "0 0 10px" }}>{error}</p>}
        <DataTable
          headers={["약품명", "단위", "규격", ""]}
          empty="등록된 약품이 없습니다."
          rows={(drugs ?? []).map((d) => [
            d.name,
            d.unit ?? "-",
            d.spec ?? "-",
            <span key="a" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Link href={`/drugs/${d.id}/edit`} className="link-btn">수정</Link>
              <form action={deleteDrug.bind(null, d.id)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </span>,
          ])}
        />
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">약품 추가</h2></div>
        <form action={createDrug} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
          <FormField label="약품명"><input name="name" required className={inputClass} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="단위"><input name="unit" className={inputClass} /></FormField>
            <FormField label="규격"><input name="spec" className={inputClass} /></FormField>
          </div>
          <FormField label="비고"><input name="note" className={inputClass} /></FormField>
          <div><SubmitButton>추가</SubmitButton></div>
        </form>
      </div>
    </div>
  );
}
