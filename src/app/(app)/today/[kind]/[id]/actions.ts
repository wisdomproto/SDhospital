"use server";
import { createClient } from "@/lib/supabase/server";
import { validateReportInput } from "@/lib/validation/report";
import { validateVitalInput } from "@/lib/validation/vital";
import { BUCKET, mediaPath } from "@/lib/storage";
import { kstToday } from "@/lib/worklist";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * 병동에서 한 번에 보내는 리포트.
 * 사진 업로드 + (입원이면) 바이털 + 코멘트 + 발송을 한 제출로 끝낸다.
 * 화면을 옮겨 다니게 하면 결국 아무도 안 쓴다.
 */
export async function sendWardReport(
  kind: "v" | "a",
  targetId: string,
  patientId: string,
  formData: FormData
) {
  const back = `/today/${kind}/${targetId}`;
  const fail = (msg: string) => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const report = validateReportInput({
    comment: String(formData.get("comment") ?? ""),
    send: "1", // 이 화면의 버튼은 발송뿐이다 — 코멘트는 필수
  });
  if (!report.ok) fail(report.error);

  const supabase = await createClient();

  // 1) 사진 — 카메라로 찍은 것들
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of photos) {
    const path = mediaPath(patientId, targetId, file.name || "photo.jpg");
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (error) fail(`사진 업로드 실패: ${error.message}`);
    await supabase.from("media").insert({
      patient_id: patientId,
      kind: "리포트",
      storage_path: path,
      file_name: file.name || "photo.jpg",
      ...(kind === "a" ? { admission_id: targetId } : { visit_id: targetId }),
    });
  }

  if (kind === "a") {
    // 2) 바이털 — 하나라도 적혔을 때만 기록한다 (프리필 값 그대로 보내는 경우 포함)
    const vital = validateVitalInput({
      admission_id: targetId,
      temperature: String(formData.get("temperature") ?? ""),
      heart_rate: String(formData.get("heart_rate") ?? ""),
      resp_rate: String(formData.get("resp_rate") ?? ""),
    });
    if (vital.ok) {
      const { error } = await supabase.from("vital").insert(vital.value);
      if (error) fail(`바이털 저장 실패: ${error.message}`);
    }

    // 3) 오늘 일일 리포트
    const { error } = await supabase.from("admission_report").upsert(
      {
        admission_id: targetId,
        report_date: kstToday(),
        comment: report.ok ? report.value.comment : null,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "admission_id,report_date" }
    );
    if (error) fail(error.message);
  } else {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("visit")
      .update({
        report_comment: report.ok ? report.value.comment : null,
        report_sent_at: now,
        closed_at: now,
      })
      .eq("id", targetId);
    if (error) fail(error.message);
  }

  revalidatePath("/today");
  revalidatePath(`/patients/${patientId}`, "layout");
  redirect("/today?sent=1");
}
