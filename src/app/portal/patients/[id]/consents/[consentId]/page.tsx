import { createClient } from "@/lib/supabase/server";
import { ConsentSheet, type ConsentRow } from "@/components/ConsentSheet";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PortalConsent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; consentId: string }>;
  searchParams: Promise<{ error?: string; signed?: string }>;
}) {
  const { id, consentId } = await params;
  const { error, signed } = await searchParams;
  const supabase = await createClient();

  const [{ data: c }, { data: p }] = await Promise.all([
    supabase
      .from("consent")
      .select(
        "id, form_code, form_title, fields, answers, body_snapshot, signer_name, signature_png, signed_at"
      )
      .eq("id", consentId)
      .single(),
    supabase.from("patient").select("name").eq("id", id).single(),
  ]);
  if (!c) notFound();

  return (
    <>
      <div className="no-print">
        <Link href={`/portal/patients/${id}`} className="portal-tile-sub" style={{ textDecoration: "none" }}>
          ← 돌아가기
        </Link>
      </div>
      {signed && (
        <div className="portal-card no-print" style={{ borderLeft: "4px solid #0f9b8e", fontWeight: 700 }}>
          서명이 완료되었습니다. 감사합니다.
        </div>
      )}
      <ConsentSheet
        consent={c as ConsentRow}
        patientName={p?.name ?? ""}
        backPath={`/portal/patients/${id}/consents/${consentId}`}
        error={error}
      />
    </>
  );
}
