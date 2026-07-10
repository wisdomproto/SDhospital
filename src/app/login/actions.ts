"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS, VET_ACCOUNTS } from "./demo";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
  redirect("/");
}

// ⚠️ DEMO ONLY — remove before production. One-click login with test accounts.
async function quickLogin(kind: keyof typeof DEMO_ACCOUNTS) {
  const { email, password, dest } = DEMO_ACCOUNTS[kind];
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
  redirect(dest);
}

export async function quickLoginStaff() {
  await quickLogin("staff");
}

export async function quickLoginOwner() {
  await quickLogin("owner");
}

// 원장 계정 선택 로그인 → 데스크탑 포털. email is bound per hospital button.
export async function quickLoginVet(email: string) {
  const acct = VET_ACCOUNTS.find((a) => a.email === email);
  if (!acct) redirect("/login?error=" + encodeURIComponent("알 수 없는 계정"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: acct!.email,
    password: acct!.password,
  });
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
  redirect("/referral");
}
