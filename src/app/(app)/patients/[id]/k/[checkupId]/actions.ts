"use server";
import { createClient } from "@/lib/supabase/server";
import { CHECKUP_SECTIONS } from "@/lib/checkup/template";
import { notifyOwner } from "@/lib/push";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const kpath = (patientId: string, checkupId: string) =>
  `/patients/${patientId}/k/${checkupId}`;

/**
 * 값 전체를 다시 쓴다 — 지우고 넣는다.
 *
 * `unique(checkup_id, section_key, item_key, side)` 는 `side` 가 null 인 행끼리
 * 충돌하지 않아서(Postgres 는 null 을 서로 다르게 본다) upsert 가 듣지 않는다.
 * 항목이 백 개뿐이라 통째로 다시 넣는 게 제일 짧고 확실하다.
 */
export async function saveCheckup(
  patientId: string,
  checkupId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const send = formData.get("send") === "1";

  const { error: headErr } = await supabase
    .from("checkup")
    .update({
      checked_on: String(formData.get("checked_on") ?? "").trim() || undefined,
      vet_name: String(formData.get("vet_name") ?? "").trim() || null,
      conclusion: String(formData.get("conclusion") ?? "").trim() || null,
      recheck_on: String(formData.get("recheck_on") ?? "").trim() || null,
      recheck_note: String(formData.get("recheck_note") ?? "").trim() || null,
      ...(send ? { sent_at: new Date().toISOString() } : {}),
    })
    .eq("id", checkupId);
  if (headErr) redirect(kpath(patientId, checkupId) + "?error=" + encodeURIComponent(headErr.message));

  const rows: {
    checkup_id: string; section_key: string; item_key: string;
    value: string | null; side: string | null; note: string | null;
  }[] = [];
  for (const s of CHECKUP_SECTIONS) {
    const note = String(formData.get(`n|${s.key}`) ?? "").trim();
    if (note) {
      rows.push({ checkup_id: checkupId, section_key: s.key, item_key: "_note", value: null, side: null, note });
    }
    for (const item of s.items ?? []) {
      for (const side of s.bilateral ? ["L", "R"] : [null]) {
        const raw = String(formData.get(`v|${s.key}|${item.key}${side ? `|${side}` : ""}`) ?? "").trim();
        if (!raw) continue;
        rows.push({ checkup_id: checkupId, section_key: s.key, item_key: item.key, value: raw, side, note: null });
      }
    }
  }

  await supabase.from("checkup_value").delete().eq("checkup_id", checkupId);
  if (rows.length) {
    const { error } = await supabase.from("checkup_value").insert(rows);
    if (error) redirect(kpath(patientId, checkupId) + "?error=" + encodeURIComponent(error.message));
  }

  if (send) {
    const { data: p } = await supabase.from("patient").select("name").eq("id", patientId).single();
    await notifyOwner(supabase, patientId, {
      title: `${p?.name ?? "반려동물"} 건강검진 결과가 나왔어요`,
      body: "확인이 필요한 항목과 담당의 소견을 확인해 주세요.",
      url: `/portal/patients/${patientId}/checkups/${checkupId}`,
    });
  }

  revalidatePath(kpath(patientId, checkupId));
  revalidatePath(`/patients/${patientId}`, "layout");
}

export async function deleteCheckup(patientId: string, visitId: string, checkupId: string) {
  const supabase = await createClient();
  await supabase.from("checkup").delete().eq("id", checkupId);
  redirect(`/patients/${patientId}/v/${visitId}`);
}
