"use server";
import { createClient } from "@/lib/supabase/server";
import { validateConsentIssue, validateConsentSign } from "@/lib/validation/consent";
import { getForm, renderBody } from "@/lib/consent/forms";
import { encryptSecret } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

/** 직원이 회차 화면에서 동의서를 발행한다 */
export async function issueConsent(patientId: string, visitId: string, formData: FormData) {
  const back = `/patients/${patientId}/v/${visitId}`;
  const code = String(formData.get("form_code") ?? "");
  const form = getForm(code);
  if (!form) redirect(`${back}?error=${encodeURIComponent("동의서 양식을 선택하세요.")}`);

  const values: Record<string, string> = {};
  for (const f of form!.fields) values[f.key] = String(formData.get(`f_${f.key}`) ?? "");

  const v = validateConsentIssue({ form_code: code, values });
  if (!v.ok) redirect(`${back}?error=${encodeURIComponent(v.error)}`);

  const supabase = await createClient();
  const { error } = await supabase.from("consent").insert({
    visit_id: visitId,
    patient_id: patientId,
    form_code: v.value.form_code,
    form_title: v.value.form_title,
    fields: v.value.fields,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(back);
}

export async function deleteConsent(patientId: string, visitId: string, consentId: string) {
  const supabase = await createClient();
  // 서명된 동의서는 증빙이라 지우지 않는다
  await supabase.from("consent").delete().eq("id", consentId).is("signed_at", null);
  revalidatePath(`/patients/${patientId}/v/${visitId}`);
}

/**
 * 서명 제출. 보호자 앱에서도, 병원 태블릿에서도 같은 액션을 쓴다.
 *
 * 저장은 DEFINER 함수로만 — 보호자는 consent 에 쓰기 권한이 없고,
 * 함수 안에서 "본인 반려동물 + 아직 미서명" 을 다시 확인하므로 두 번 서명될 수 없다.
 */
export async function signConsent(consentId: string, backPath: string, formData: FormData) {
  const fail = (m: string) => redirect(`${backPath}?error=${encodeURIComponent(m)}`);
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("consent")
    .select("id, form_code, fields, signed_at")
    .eq("id", consentId)
    .single();
  if (!row) fail("동의서를 찾을 수 없습니다.");
  if (row!.signed_at) fail("이미 서명이 완료된 동의서입니다.");

  const form = getForm(row!.form_code);
  if (!form) fail("동의서 양식을 찾을 수 없습니다.");

  const answers: Record<string, string> = {};
  for (const c of form!.choices) answers[c.key] = String(formData.get(`c_${c.key}`) ?? "");

  const v = validateConsentSign(form!, {
    answers,
    signer_name: String(formData.get("signer_name") ?? ""),
    resident_no: String(formData.get("resident_no") ?? ""),
    signature: String(formData.get("signature") ?? ""),
  });
  if (!v.ok) fail(v.error);

  // 서명 시점의 본문을 통째로 박아둔다 — 나중에 양식 문구가 바뀌어도 증빙이 남는다
  const body = renderBody(form!, (row!.fields ?? {}) as Record<string, string>);

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? null;

  const { data: ok, error } = await supabase.rpc("sign_consent", {
    p_consent_id: consentId,
    p_body: body,
    p_answers: v.ok ? v.value.answers : {},
    p_name: v.ok ? v.value.signer_name : "",
    // 주민등록번호는 고유식별정보 — 평문으로 DB 에 들어가지 않는다
    p_rrn_enc: v.ok && v.value.resident_no ? encryptSecret(v.value.resident_no) : null,
    p_signature: v.ok ? v.value.signature : "",
    p_ip: ip,
    p_ua: h.get("user-agent") ?? null,
  });
  if (error) fail(error.message);
  if (!ok) fail("서명 권한이 없거나 이미 처리된 동의서입니다.");

  revalidatePath(backPath);
  redirect(`${backPath}?signed=1`);
}
