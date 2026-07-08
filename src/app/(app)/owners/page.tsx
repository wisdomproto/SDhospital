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
    <div className="max-w-3xl space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">보호자</h1>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable
          headers={["이름", "연락처", ""]}
          rows={(owners ?? []).map((o) => [
            o.name,
            o.contact ?? "-",
            <span key="a" className="flex gap-3">
              <Link href={`/owners/${o.id}/edit`} className="link-btn">
                수정
              </Link>
              <form action={deleteOwner.bind(null, o.id)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </span>,
          ])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">보호자 추가</h2>
        <form action={createOwner} className="space-y-3">
          <FormField label="이름">
            <input name="name" required className={inputClass} />
          </FormField>
          <FormField label="연락처">
            <input name="contact" className={inputClass} />
          </FormField>
          <SubmitButton>추가</SubmitButton>
        </form>
      </section>
    </div>
  );
}
