import { createClient } from "@/lib/supabase/server";
import { ConsentSheet, type ConsentRow } from "@/components/ConsentSheet";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * 직원용 동의서 화면. 병원 태블릿을 보호자에게 건네 그 자리에서 서명받을 때도 이 화면을 쓴다.
 * (보호자가 앱을 안 깔았거나 내원 중일 때)
 */
export default async function StaffConsent({
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
        "id, visit_id, form_code, form_title, fields, answers, body_snapshot, signer_name, signature_png, signed_at"
      )
      .eq("id", consentId)
      .single(),
    supabase.from("patient").select("name").eq("id", id).single(),
  ]);
  if (!c) notFound();

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
      <div className="no-print">
        <Link href={`/patients/${id}/v/${c.visit_id}`} className="link-btn" style={{ fontSize: ".85rem" }}>
          ← 회차로
        </Link>
      </div>
      {signed && (
        <div className="pill success" style={{ padding: "10px 14px" }} data-print="hide">
          서명 완료
        </div>
      )}
      <ConsentSheet
        consent={c as ConsentRow}
        patientName={p?.name ?? ""}
        backPath={`/patients/${id}/c/${consentId}`}
        error={error}
      />
    </div>
  );
}
