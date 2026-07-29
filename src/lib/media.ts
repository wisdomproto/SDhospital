/**
 * 파일 종류 판별 — 서버·클라이언트 양쪽에서 쓴다.
 *
 * `storage.ts` 에 두면 서버 Supabase 클라이언트까지 클라이언트 번들로 끌려온다
 * (실제로 빌드가 깨졌다). 순수 함수는 순수한 파일에 둔다.
 */
export function isVideoFile(fileName: string | null | undefined): boolean {
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(fileName ?? "");
}

export function isImageFile(fileName: string | null | undefined): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|heic|svg)$/i.test(fileName ?? "");
}
