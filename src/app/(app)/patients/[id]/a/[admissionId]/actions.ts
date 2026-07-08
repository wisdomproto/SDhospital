"use server";
import { createClient } from "@/lib/supabase/server";
import { validateVitalInput } from "@/lib/validation/vital";
import { validateAdmissionInput } from "@/lib/validation/admission";
import { BUCKET, imagePath, mediaPath } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const apath = (patientId: string, admissionId: string) =>
  `/patients/${patientId}/a/${admissionId}`;

async function uploadAdmFile(
  kind: "image" | "media",
  patientId: string,
  admissionId: string,
  formData: FormData
) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0)
    redirect(apath(patientId, admissionId) + "?error=" + encodeURIComponent("파일을 선택하세요."));
  const supabase = await createClient();
  const path =
    kind === "image"
      ? imagePath(patientId, admissionId, file!.name)
      : mediaPath(patientId, admissionId, file!.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file!, { contentType: file!.type || undefined });
  if (upErr) redirect(apath(patientId, admissionId) + "?error=" + encodeURIComponent(upErr.message));

  if (kind === "image") {
    const modality = String(formData.get("modality") ?? "other");
    await supabase.from("medical_image").insert({
      admission_id: admissionId,
      modality,
      storage_path: path,
      file_name: file!.name,
    });
  } else {
    const mkind = String(formData.get("kind") ?? "").trim() || null;
    await supabase.from("media").insert({
      patient_id: patientId,
      admission_id: admissionId,
      kind: mkind,
      storage_path: path,
      file_name: file!.name,
    });
  }
  revalidatePath(apath(patientId, admissionId));
}

export async function uploadAdmImage(patientId: string, admissionId: string, formData: FormData) {
  await uploadAdmFile("image", patientId, admissionId, formData);
}

export async function uploadAdmMedia(patientId: string, admissionId: string, formData: FormData) {
  await uploadAdmFile("media", patientId, admissionId, formData);
}

export async function deleteAdmFile(
  patientId: string,
  admissionId: string,
  table: "medical_image" | "media",
  id: string,
  path: string
) {
  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from(table).delete().eq("id", id);
  revalidatePath(apath(patientId, admissionId));
}

export async function updateAdmission(
  patientId: string,
  admissionId: string,
  formData: FormData
) {
  const v = validateAdmissionInput({
    patient_id: patientId,
    admitted_at: String(formData.get("admitted_at") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(apath(patientId, admissionId) + "?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("admission")
    .update({ admitted_at: v.value.admitted_at, note: v.value.note })
    .eq("id", admissionId);
  if (error) redirect(apath(patientId, admissionId) + "?error=" + encodeURIComponent(error.message));
  revalidatePath(apath(patientId, admissionId));
  revalidatePath(`/patients/${patientId}`, "layout");
}

export async function updateVital(
  patientId: string,
  admissionId: string,
  vitalId: string,
  formData: FormData
) {
  const v = validateVitalInput({
    admission_id: admissionId,
    temperature: String(formData.get("temperature") ?? ""),
    heart_rate: String(formData.get("heart_rate") ?? ""),
    resp_rate: String(formData.get("resp_rate") ?? ""),
    systolic: String(formData.get("systolic") ?? ""),
    diastolic: String(formData.get("diastolic") ?? ""),
  });
  if (!v.ok) redirect(apath(patientId, admissionId) + "?error=" + encodeURIComponent(v.error));

  const measuredRaw = String(formData.get("measured_at") ?? "").trim();
  const patch: Record<string, unknown> = {
    temperature: v.value.temperature,
    heart_rate: v.value.heart_rate,
    resp_rate: v.value.resp_rate,
    systolic: v.value.systolic,
    diastolic: v.value.diastolic,
  };
  if (measuredRaw) patch.measured_at = new Date(measuredRaw).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("vital").update(patch).eq("id", vitalId);
  if (error) redirect(apath(patientId, admissionId) + "?error=" + encodeURIComponent(error.message));
  revalidatePath(apath(patientId, admissionId));
}

export async function discharge(
  patientId: string,
  admissionId: string,
  formData: FormData
) {
  const raw = String(formData.get("discharged_at") ?? "").trim();
  const discharged_at = raw || new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  await supabase
    .from("admission")
    .update({ discharged_at, status: "discharged" })
    .eq("id", admissionId);
  revalidatePath(apath(patientId, admissionId));
}

export async function reopenAdmission(patientId: string, admissionId: string) {
  const supabase = await createClient();
  await supabase
    .from("admission")
    .update({ discharged_at: null, status: "admitted" })
    .eq("id", admissionId);
  revalidatePath(apath(patientId, admissionId));
}

export async function addVital(
  patientId: string,
  admissionId: string,
  formData: FormData
) {
  const v = validateVitalInput({
    admission_id: admissionId,
    temperature: String(formData.get("temperature") ?? ""),
    heart_rate: String(formData.get("heart_rate") ?? ""),
    resp_rate: String(formData.get("resp_rate") ?? ""),
    systolic: String(formData.get("systolic") ?? ""),
    diastolic: String(formData.get("diastolic") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(apath(patientId, admissionId) + "?error=" + encodeURIComponent(v.error));

  const measuredRaw = String(formData.get("measured_at") ?? "").trim();
  const row: Record<string, unknown> = { ...v.value };
  if (measuredRaw) row.measured_at = new Date(measuredRaw).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("vital").insert(row);
  if (error) redirect(apath(patientId, admissionId) + "?error=" + encodeURIComponent(error.message));
  revalidatePath(apath(patientId, admissionId));
}

export async function deleteVital(
  patientId: string,
  admissionId: string,
  id: string
) {
  const supabase = await createClient();
  await supabase.from("vital").delete().eq("id", id);
  revalidatePath(apath(patientId, admissionId));
}
