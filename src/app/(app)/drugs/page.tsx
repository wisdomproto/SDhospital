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
    <div className="max-w-3xl space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">약품</h1>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable
          headers={["약품명", "단위", "규격", ""]}
          rows={(drugs ?? []).map((d) => [
            d.name,
            d.unit ?? "-",
            d.spec ?? "-",
            <span key="a" className="flex gap-3">
              <Link href={`/drugs/${d.id}/edit`} className="link-btn">
                수정
              </Link>
              <form action={deleteDrug.bind(null, d.id)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </span>,
          ])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">약품 추가</h2>
        <form action={createDrug} className="space-y-3">
          <FormField label="약품명">
            <input name="name" required className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="단위">
              <input name="unit" className={inputClass} />
            </FormField>
            <FormField label="규격">
              <input name="spec" className={inputClass} />
            </FormField>
          </div>
          <FormField label="비고">
            <input name="note" className={inputClass} />
          </FormField>
          <SubmitButton>추가</SubmitButton>
        </form>
      </section>
    </div>
  );
}
