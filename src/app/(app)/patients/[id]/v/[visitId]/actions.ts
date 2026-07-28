"use server";
import { createClient } from "@/lib/supabase/server";
import { validatePrescriptionInput } from "@/lib/validation/prescription";
import { validateVisitInput } from "@/lib/validation/visit";
import { validateReportInput } from "@/lib/validation/report";
import { BUCKET, imagePath, mediaPath } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const vpath = (patientId: string, visitId: string) =>
  `/patients/${patientId}/v/${visitId}`;

export async function updateVisit(
  patientId: string,
  visitId: string,
  formData: FormData
) {
  const v = validateVisitInput({
    patient_id: patientId,
    visit_date: String(formData.get("visit_date") ?? ""),
    visit_no: String(formData.get("visit_no") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("visit")
    .update({ visit_date: v.value.visit_date, visit_no: v.value.visit_no, note: v.value.note })
    .eq("id", visitId);
  if (error) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(error.message));
  revalidatePath(vpath(patientId, visitId));
  revalidatePath(`/patients/${patientId}`, "layout");
}

// 회차 리포트 저장 / 보호자에게 보내기 (같은 폼의 버튼 두 개)
export async function saveVisitReport(
  patientId: string,
  visitId: string,
  formData: FormData
) {
  const v = validateReportInput({
    comment: String(formData.get("comment") ?? ""),
    send: formData.get("send") as string | null,
  });
  if (!v.ok) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("visit")
    .update({
      report_comment: v.value.comment,
      // 리포트를 보내면 진료도 끝난 것으로 본다 (버튼을 두 번 누르게 하지 않는다)
      ...(v.value.send
        ? { report_sent_at: new Date().toISOString(), closed_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", visitId);
  if (error) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(error.message));
  revalidatePath(vpath(patientId, visitId));
  revalidatePath(`/patients/${patientId}`, "layout");
}

// 진료 종료 / 종료 취소 — "오늘 할 일" 목록에 리포트 보낼 회차로 올라오는 기준
export async function toggleVisitClosed(
  patientId: string,
  visitId: string,
  close: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("visit")
    .update({ closed_at: close ? new Date().toISOString() : null })
    .eq("id", visitId);
  if (error) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(error.message));
  revalidatePath(vpath(patientId, visitId));
  revalidatePath(`/patients/${patientId}`, "layout");
}

export async function updatePrescription(
  patientId: string,
  visitId: string,
  rxId: string,
  formData: FormData
) {
  const v = validatePrescriptionInput({
    visit_id: visitId,
    drug_id: String(formData.get("drug_id") ?? ""),
    dose: String(formData.get("dose") ?? ""),
    frequency: String(formData.get("frequency") ?? ""),
    duration: String(formData.get("duration") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("prescription")
    .update({
      drug_id: v.value.drug_id,
      dose: v.value.dose,
      frequency: v.value.frequency,
      duration: v.value.duration,
    })
    .eq("id", rxId);
  if (error) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(error.message));
  revalidatePath(vpath(patientId, visitId));
}

export async function addPrescription(
  patientId: string,
  visitId: string,
  formData: FormData
) {
  const v = validatePrescriptionInput({
    visit_id: visitId,
    drug_id: String(formData.get("drug_id") ?? ""),
    dose: String(formData.get("dose") ?? ""),
    frequency: String(formData.get("frequency") ?? ""),
    duration: String(formData.get("duration") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("prescription").insert(v.value);
  if (error) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(error.message));
  revalidatePath(vpath(patientId, visitId));
}

export async function deletePrescription(
  patientId: string,
  visitId: string,
  id: string
) {
  const supabase = await createClient();
  await supabase.from("prescription").delete().eq("id", id);
  revalidatePath(vpath(patientId, visitId));
}

async function uploadTo(
  kind: "image" | "media",
  patientId: string,
  visitId: string,
  formData: FormData
) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0)
    redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent("파일을 선택하세요."));
  const supabase = await createClient();
  const path =
    kind === "image"
      ? imagePath(patientId, visitId, file!.name)
      : mediaPath(patientId, visitId, file!.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file!, { contentType: file!.type || undefined });
  if (upErr) redirect(vpath(patientId, visitId) + "?error=" + encodeURIComponent(upErr.message));

  if (kind === "image") {
    const modality = String(formData.get("modality") ?? "other");
    // 원본은 판독용이라 그대로 두고, 보호자에게 보낼 가벼운 사본만 따로 올린다
    const preview = formData.get("preview") as File | null;
    let previewPath: string | null = null;
    if (preview && preview.size > 0) {
      previewPath = imagePath(patientId, visitId, preview.name);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(previewPath, preview, { contentType: preview.type || undefined });
      if (error) previewPath = null; // 사본 실패는 업로드를 막지 않는다
    }
    await supabase.from("medical_image").insert({
      visit_id: visitId,
      modality,
      storage_path: path,
      preview_path: previewPath,
      file_name: file!.name,
    });
  } else {
    const mkind = String(formData.get("kind") ?? "").trim() || null;
    await supabase.from("media").insert({
      patient_id: patientId,
      visit_id: visitId,
      kind: mkind,
      storage_path: path,
      file_name: file!.name,
    });
  }
  revalidatePath(vpath(patientId, visitId));
}

export async function uploadImage(patientId: string, visitId: string, formData: FormData) {
  await uploadTo("image", patientId, visitId, formData);
}

export async function uploadMedia(patientId: string, visitId: string, formData: FormData) {
  await uploadTo("media", patientId, visitId, formData);
}

export async function deleteFile(
  patientId: string,
  visitId: string,
  table: "medical_image" | "media",
  id: string,
  path: string
) {
  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from(table).delete().eq("id", id);
  revalidatePath(vpath(patientId, visitId));
}
