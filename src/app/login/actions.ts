"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS } from "./demo";

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

export async function quickLoginVet() {
  await quickLogin("vet");
}
