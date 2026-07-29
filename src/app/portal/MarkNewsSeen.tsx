"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NEWS_SEEN_COOKIE } from "@/lib/seen";

/**
 * 병원 소식 화면을 열면 "여기까지 봤다"를 남긴다. 다음부터는 그 뒤 것만 새 소식이다.
 *
 * 배지를 든 레이아웃은 이 화면보다 먼저 렌더되므로, 새 소식이 있었을 때만 한 번 새로 고쳐
 * 탭 숫자를 지운다. 새로 고친 뒤에는 `hasNew` 가 false 라 다시 돌지 않는다.
 */
export function MarkNewsSeen({ hasNew }: { hasNew: boolean }) {
  const router = useRouter();
  useEffect(() => {
    document.cookie = `${NEWS_SEEN_COOKIE}=${new Date().toISOString()}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    if (hasNew) router.refresh();
  }, [hasNew, router]);
  return null;
}
