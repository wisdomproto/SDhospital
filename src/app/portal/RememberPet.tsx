"use client";
import { useEffect } from "react";
import { LAST_PET_COOKIE } from "@/lib/last-pet";

/**
 * 마지막으로 보던 아이를 기억한다.
 *
 * 앱을 열 때마다 "어떤 아이를 볼까요?"를 묻는 건 대부분의 보호자에게 군더더기다 —
 * 매번 같은 아이를 고른다. 마지막에 본 아이로 바로 들어가고, 바꿀 일이 있으면 헤더에서 바꾼다.
 *
 * localStorage 가 아니라 쿠키인 이유: `/portal` 의 리다이렉트는 서버에서 일어난다.
 * 값은 반려동물 id 뿐이고, 그 아이를 볼 권한은 어차피 RLS 가 다시 확인한다.
 */
export function RememberPet({ patientId }: { patientId: string }) {
  useEffect(() => {
    document.cookie = `${LAST_PET_COOKIE}=${patientId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [patientId]);
  return null;
}
