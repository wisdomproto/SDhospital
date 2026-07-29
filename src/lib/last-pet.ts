/**
 * 마지막으로 보던 반려동물 쿠키 이름.
 *
 * ⚠️ 이 상수를 `"use client"` 파일에 두면 안 된다. 서버 컴포넌트가 그 모듈을 import 하면
 * 번들러가 클라이언트 참조로 바꿔치기해 값이 `undefined` 가 되고,
 * 쿠키를 못 읽어 조용히 다른 분기로 새어 나간다 (실제로 겪었다).
 */
export const LAST_PET_COOKIE = "sd-last-pet";
