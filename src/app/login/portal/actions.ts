"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS } from "../demo";

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
  const { email, password } = DEMO_ACCOUNTS.owner;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login/portal?error=" + encodeURIComponent(error.message));
  redirect("/portal");
}
