"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS, DEMO_ENABLED } from "../demo";

export async function signInPortal(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login/portal?error=" + encodeURIComponent(error.message));
  redirect("/portal");
}

// ⚠️ DEMO ONLY — remove before production. One-click owner login (mobile portal).
// 원장(1차병원)은 PC 데스크탑 포털을 쓰므로 여기서는 보호자만 제공한다.
export async function quickOwner() {
  if (!DEMO_ENABLED) redirect("/login/portal?error=" + encodeURIComponent("데모 로그인이 비활성화되어 있습니다."));
  const { email, password } = DEMO_ACCOUNTS.owner;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login/portal?error=" + encodeURIComponent(error.message));
  redirect("/portal");
}

/**
 * ⚠️ DEMO ONLY — 원장님 EMR 실제 환자를 골라 그 아이 앱으로 들어간다.
 *
 * 보호자 계정은 여전히 하나다. 106명이 전부 그 계정에 묶여 있어(`patient.owner_id`)
 * RLS 는 그대로 통과하고, **새 권한 함수를 만들지 않았다.**
 * 실제 보호자는 `patient.emr_owner_id` 가 가리키고 화면 표시에만 쓴다.
 */
export async function quickOwnerAs(formData: FormData) {
  if (!DEMO_ENABLED) redirect("/login/portal?error=" + encodeURIComponent("데모 로그인이 비활성화되어 있습니다."));
  const patientId = String(formData.get("patientId") ?? "");
  const { email, password } = DEMO_ACCOUNTS.owner;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login/portal?error=" + encodeURIComponent(error.message));
  // 고른 아이로 바로 간다. 마지막 본 아이 쿠키는 그 화면이 알아서 남긴다
  redirect(patientId ? `/portal/patients/${patientId}` : "/portal");
}
