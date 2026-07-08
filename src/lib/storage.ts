import { createClient } from "@/lib/supabase/server";

export const BUCKET = "patient-files";

// Deterministic, collision-resistant object paths.
export function imagePath(patientId: string, visitId: string, fileName: string) {
  return `images/${patientId}/${visitId}/${crypto.randomUUID()}-${fileName}`;
}
export function mediaPath(patientId: string, visitId: string, fileName: string) {
  return `media/${patientId}/${visitId}/${crypto.randomUUID()}-${fileName}`;
}

// Mint a short-lived signed URL for viewing/downloading a stored object.
export async function signedUrl(path: string, expiresIn = 300): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export function isVideoFile(fileName: string | null | undefined): boolean {
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(fileName ?? "");
}
export function isImageFile(fileName: string | null | undefined): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|heic|svg)$/i.test(fileName ?? "");
}
