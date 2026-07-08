"use server";
import { createClient } from "@/lib/supabase/server";
import { validatePrescriptionInput } from "@/lib/validation/prescription";
import { BUCKET, imagePath, mediaPath } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const vpath = (patientId: string, visitId: string) =>
  `/patients/${patientId}/v/${visitId}`;

export async function updateVisitNote(
  patientId: string,
  visitId: string,
  formData: FormData
) {
  const note = String(formData.get("note") ?? "").trim() || null;
  const supabase = await createClient();
  await supabase.from("visit").update({ note }).eq("id", visitId);
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
    await supabase.from("medical_image").insert({
      visit_id: visitId,
      modality,
      storage_path: path,
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
