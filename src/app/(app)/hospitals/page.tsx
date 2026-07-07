import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { createHospital, deleteHospital } from "./actions";
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

  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">1차 병원</h1>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable
          headers={["병원명", "연락처", ""]}
          rows={(hospitals ?? []).map((h) => [
            h.name,
            h.contact ?? "-",
            <span key="a" className="flex gap-3">
              <Link href={`/hospitals/${h.id}/edit`} className="text-blue-600">
                수정
              </Link>
              <form action={deleteHospital.bind(null, h.id)}>
                <button className="text-red-600">삭제</button>
              </form>
            </span>,
          ])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">병원 추가</h2>
        <form action={createHospital} className="space-y-3">
          <FormField label="병원명">
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
