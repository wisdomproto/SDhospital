import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * RLS 를 우회하는 클라이언트. **스케줄러 전용이다.**
 *
 * 재검 알림은 로그인한 사람이 없는 시각에 돌아야 해서 세션이 없다. 세션이 없으면
 * `current_role_name()` 이 비고, 우리 정책은 전부 거기서 갈린다 — 그래서 이 경로만
 * 열쇠를 따로 쓴다. 화면 코드에서는 **절대 쓰지 말 것**: 실수로 한 번 쓰면
 * 그 화면에서 RLS 는 없는 것이 된다.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
