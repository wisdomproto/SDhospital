"use server";
import { createClient } from "@/lib/supabase/server";
import { validateReportInput } from "@/lib/validation/report";
import { validateVitalInput } from "@/lib/validation/vital";
import { BUCKET, mediaPath } from "@/lib/storage";
import { kstToday } from "@/lib/worklist";
import { canSendDaily, dailySummary } from "@/lib/admission-report";
import { notifyOwner, notifyStaff } from "@/lib/push";
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
  /** ready = 입력만 끝내고 수의사 확인 요청 · send = 보호자에게 발송 */
  mode: "ready" | "send",
  formData: FormData
) {
  const back = `/today/${kind}/${targetId}`;
  const fail = (msg: string) => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const comment = String(formData.get("comment") ?? "").trim();
  const daily = {
    feeding: (String(formData.get("feeding") ?? "").trim() || null),
    elimination: (String(formData.get("elimination") ?? "").trim() || null),
    special: (String(formData.get("special") ?? "").trim() || null),
    comment: comment || null,
  };

  // 회차 리포트는 코멘트가 필수다(사람 말 한 줄 없이 나가면 통보로 읽힌다).
  // 입원 일일 리포트는 식사·배변만 골라도 보낼 수 있다 — 매일 문장을 쓰게 하면 며칠 만에 끊긴다.
  const report =
    kind === "a"
      ? ({ ok: true, value: { comment: daily.comment, send: true } } as const)
      : validateReportInput({ comment, send: "1" });
  if (!report.ok) fail(report.error);
  if (kind === "a" && !canSendDaily(daily)) {
    fail("오늘 식사나 배변 중 하나는 골라주세요.");
  }

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
    const now = new Date().toISOString();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("admission_report").upsert(
      {
        admission_id: targetId,
        report_date: kstToday(),
        comment: daily.comment,
        feeding: daily.feeding,
        elimination: daily.elimination,
        special: daily.special,
        ready_at: now,
        ready_by: user?.id ?? null,
        // 보호자에게 나가는 건 수의사가 확인한 뒤다. 병동 입력이 곧 발송이면 그 판단 단계가 없다.
        ...(mode === "send" ? { sent_at: now } : {}),
      },
      { onConflict: "admission_id,report_date" }
    );
    if (error) fail(error.message);
  } else {
    const now = new Date().toISOString();
    const weight = parseFloat(String(formData.get("weight_kg") ?? ""));
    const { error } = await supabase
      .from("visit")
      .update({
        report_comment: report.ok ? report.value.comment : null,
        chief_complaint: String(formData.get("chief_complaint") ?? "").trim() || null,
        weight_kg: Number.isFinite(weight) ? weight : null,
        report_sent_at: now,
        closed_at: now,
      })
      .eq("id", targetId);
    if (error) fail(error.message);
  }

  const { data: pet } = await supabase.from("patient").select("name").eq("id", patientId).single();

  if (kind === "a" && mode === "ready") {
    // 보호자가 아니라 우리 수의사에게 간다 — "확인하고 보내주세요"
    await notifyStaff(supabase, {
      title: `${pet?.name ?? "입원 환자"} 입원 리포트 준비됐습니다`,
      body: dailySummary(daily) || "확인 후 보호자에게 보내주세요.",
      url: `/today/a/${targetId}`,
    });
    revalidatePath("/today");
    redirect("/today?ready=1");
  }

  await notifyOwner(supabase, patientId, {
    title:
      kind === "a"
        ? `${pet?.name ?? "반려동물"} 오늘 입원 경과예요`
        : `${pet?.name ?? "반려동물"} 진료 리포트가 도착했어요`,
    body: kind === "a" ? "오늘 하루 어떻게 지냈는지 확인해 주세요." : "오늘 진료 내용을 확인해 주세요.",
    url:
      kind === "a"
        ? `/portal/patients/${patientId}/admissions/${targetId}`
        : `/portal/patients/${patientId}/visits/${targetId}`,
  });

  revalidatePath("/today");
  revalidatePath(`/patients/${patientId}`, "layout");
  redirect("/today?sent=1");
}
