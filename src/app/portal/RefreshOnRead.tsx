"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 읽음 처리 직후 한 번만 새로 고친다.
 *
 * 열람 표시는 이 화면(서버 컴포넌트)이 렌더되는 중에 찍히는데, 하단 탭 배지는 그보다 먼저
 * 렌더된 **레이아웃**이 들고 있다. 그래서 리포트를 읽어도 배지가 그대로 남았다.
 * router.refresh() 는 레이아웃까지 다시 그린다 — 이번에 읽은 게 있을 때만 부른다.
 */
export function RefreshOnRead({ when }: { when: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (when) router.refresh();
  }, [when, router]);
  return null;
}
