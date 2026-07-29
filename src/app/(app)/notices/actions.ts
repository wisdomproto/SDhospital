"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const back = (msg?: string) => redirect("/notices" + (msg ? "?error=" + encodeURIComponent(msg) : ""));

export async function createNotice(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) back("제목을 적어주세요.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("notice").insert({
    title,
    body: String(formData.get("body") ?? "").trim() || null,
    link_url: String(formData.get("link_url") ?? "").trim() || null,
    link_label: String(formData.get("link_label") ?? "").trim() || null,
    coupon_label: String(formData.get("coupon_label") ?? "").trim() || null,
    starts_on: String(formData.get("starts_on") ?? "").trim() || undefined,
    ends_on: String(formData.get("ends_on") ?? "").trim() || null,
    pinned: formData.get("pinned") === "1",
    created_by: user?.id ?? null,
  });
  if (error) back(error.message);
  revalidatePath("/notices");
}

export async function deleteNotice(id: string) {
  const supabase = await createClient();
  await supabase.from("notice").delete().eq("id", id);
  revalidatePath("/notices");
}

export async function togglePinned(id: string, pinned: boolean) {
  const supabase = await createClient();
  await supabase.from("notice").update({ pinned }).eq("id", id);
  revalidatePath("/notices");
}
