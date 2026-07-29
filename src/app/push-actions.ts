"use server";
import { createClient } from "@/lib/supabase/server";

/** 브라우저가 만든 구독을 저장한다. 기기마다 하나씩 쌓인다(폰·태블릿). */
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };

  const { error } = await supabase.from("push_subscription").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
      failed_at: null,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subscription").delete().eq("endpoint", endpoint);
  return { ok: true as const };
}
