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

export { isVideoFile, isImageFile } from "@/lib/media";

/**
 * 보호자 화면용 의료영상 링크.
 * 기본은 가벼운 사본(preview_path), 원본은 "원본 받기"용으로 따로 준다.
 * 사본이 없는 예전 자료는 원본 하나만 쓴다.
 */
export async function signMedicalImages<
  T extends { storage_path: string; preview_path?: string | null }
>(rows: T[]): Promise<(T & { url: string | null; originalUrl: string | null })[]> {
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      url: await signedUrl(r.preview_path ?? r.storage_path),
      originalUrl: r.preview_path ? await signedUrl(r.storage_path) : null,
    }))
  );
}
