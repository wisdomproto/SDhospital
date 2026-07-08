import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

export default async function PortalHome() {
  const supabase = await createClient();
  const { data: patients } = await supabase
    .from("patient")
    .select("id, name, species, breed")
    .order("name");
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">환자</h1>
      <DataTable
        headers={["이름", "종/품종"]}
        empty="열람 가능한 환자가 없습니다."
        rows={(patients ?? []).map((p) => [
          <Link key="n" href={`/portal/patients/${p.id}`} className="text-blue-600">
            {p.name}
          </Link>,
          [p.species, p.breed].filter(Boolean).join(" / ") || "-",
        ])}
      />
    </div>
  );
}
