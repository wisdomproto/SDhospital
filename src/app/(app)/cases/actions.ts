"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const back = (msg?: string) => redirect("/cases" + (msg ? "?error=" + encodeURIComponent(msg) : ""));

export async function createCase(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  // 태그가 없으면 어느 회차에도 붙지 않는다. 저장은 되지만 알려는 준다.
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!title || !url) back("제목과 링크는 필요합니다.");
  if (tags.length === 0) back("태그가 없으면 어떤 진료에도 붙지 않습니다. 주 증상에 들어갈 말을 적어주세요.");

  const supabase = await createClient();
  const { error } = await supabase.from("case_story").insert({
    title,
    url,
    tags,
    summary: String(formData.get("summary") ?? "").trim() || null,
    species: String(formData.get("species") ?? "").trim() || null,
  });
  if (error) back(error.message);
  revalidatePath("/cases");
}

export async function toggleCase(id: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("case_story").update({ active }).eq("id", id);
  revalidatePath("/cases");
}

export async function deleteCase(id: string) {
  const supabase = await createClient();
  await supabase.from("case_story").delete().eq("id", id);
  revalidatePath("/cases");
}
