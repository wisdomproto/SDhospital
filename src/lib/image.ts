"use client";

/**
 * 브라우저에서 업로드 전에 사진을 줄인다.
 *
 * 폰 사진은 4000×3000 · 4MB 정도다. 그대로 두면 병동에서 올릴 때 느리고,
 * 보호자가 매일 받아보면 데이터가 그대로 나간다.
 * 1600px + WebP 로 줄이면 15배쯤 작아지고, 화면으로 보는 데는 차고 넘친다.
 *
 * 서버에서 변환하지 않는 이유: 업로드 자체가 빨라져야 입력이 안 끊긴다.
 */
export const REPORT_MAX_EDGE = 1600;
export const REPORT_QUALITY = 0.82;

/** 이 브라우저가 WebP 로 내보낼 수 있는지 (안 되면 JPEG 로 떨어진다) */
function pickType(): "image/webp" | "image/jpeg" {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  return c.toDataURL("image/webp").startsWith("data:image/webp")
    ? "image/webp"
    : "image/jpeg";
}

export function isShrinkable(file: File): boolean {
  // 동영상·DICOM·이미 작은 파일은 건드리지 않는다
  return file.type.startsWith("image/") && file.type !== "image/gif";
}

/**
 * 긴 변을 maxEdge 로 맞추고 WebP 로 다시 인코딩한다.
 * 원본이 이미 작으면 확대하지 않는다. 실패하면 원본을 그대로 돌려준다 —
 * 사진을 못 올리는 것보다 큰 사진을 올리는 게 낫다.
 */
export async function shrinkImage(
  file: File,
  maxEdge = REPORT_MAX_EDGE,
  quality = REPORT_QUALITY
): Promise<File> {
  if (!isShrinkable(file)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const type = pickType();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality)
    );
    if (!blob || blob.size >= file.size) return file; // 줄지 않았으면 원본 유지

    const ext = type === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** <input type="file"> 의 내용을 바꿔치기한다 (폼은 그대로 제출된다) */
export function setInputFiles(input: HTMLInputElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  input.files = dt.files;
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)}MB`
    : `${Math.round(n / 1024)}KB`;
}
