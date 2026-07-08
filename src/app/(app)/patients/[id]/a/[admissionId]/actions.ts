"use server";
import { createClient } from "@/lib/supabase/server";
import { validateVitalInput } from "@/lib/validation/vital";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const apath = (patientId: string, admissionId: string) =>
  `/patients/${patientId}/a/${admissionId}`;

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
