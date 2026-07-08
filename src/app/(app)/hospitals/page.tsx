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
              <Link href={`/hospitals/${h.id}/edit`} className="link-btn">
                수정
              </Link>
              <form action={issueVetInvite.bind(null, h.id)}>
                <button className="link-btn">초대 발급</button>
              </form>
              <form action={deleteHospital.bind(null, h.id)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </span>,
          ])}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">발급된 1차병원 초대</h2>
        <ul className="space-y-1 text-sm">
          {(vetInvites ?? []).map((iv) => (
            <li key={iv.id} className="flex items-center gap-3">
              <span className="shrink-0 text-gray-600">
                {(iv.hospital as unknown as { name: string } | null)?.name ?? "-"}
              </span>
              <code className="rounded bg-gray-100 px-2 py-1 text-xs break-all">
                {inviteUrl(host, iv.token)}
              </code>
              <span className="shrink-0 text-gray-500">{iv.used ? "사용됨" : "미사용"}</span>
              <form action={revokeVetInvite.bind(null, iv.id)}>
                <button className="link-btn danger">취소</button>
              </form>
            </li>
          ))}
          {(vetInvites ?? []).length === 0 && (
            <li className="text-gray-500">발급된 초대가 없습니다.</li>
          )}
        </ul>
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
