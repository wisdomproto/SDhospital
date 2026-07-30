import { createServiceClient } from "@/lib/supabase/service";
import { deliver, pushConfigured, type Target } from "@/lib/push";
import { kstToday } from "@/lib/worklist";
import { NextResponse } from "next/server";

/**
 * 재검일 알림 — 하루 한 번 스케줄러가 부른다.
 *
 * 결과서에는 이미 "3개월 뒤 재검"이 적혀 있지만 그 종이는 서랍에 들어간다.
 * 재검이 안 오는 건 필요 없어서가 아니라 잊어서다.
 *
 * **지난 날짜도 함께 집는다**(`<=`). 스케줄러가 하루 죽어 있었다고 그날 재검이
 * 영영 사라지면 안 된다. 대신 `recheck_notified_at` 을 찍어 두 번 보내지 않는다.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/recheck
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY 미설정" }, { status: 503 });

  const today = kstToday();
  // 보호자가 결과를 받은 검진만 — 안 보낸 검진의 재검을 먼저 알리면 앞뒤가 바뀐다
  const { data: due, error } = await supabase
    .from("checkup")
    .select("id, patient_id, recheck_on, recheck_note, patient:patient_id(name, owner_id)")
    .lte("recheck_on", today)
    .is("recheck_notified_at", null)
    .not("sent_at", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ today, due: 0, sent: 0 });

  // 구독은 소속으로 찾는다. 세션이 없어 DEFINER 함수(직원 전용)를 못 쓰므로 직접 읽는다 —
  // 이 경로가 service role 을 쓰는 유일한 이유다.
  const [{ data: subs }, { data: profiles }] = await Promise.all([
    supabase.from("push_subscription").select("id, endpoint, p256dh, auth, user_id").is("failed_at", null),
    supabase.from("profile").select("id, role, owner_id"),
  ]);
  const roleOf = new Map((profiles ?? []).map((p) => [p.id, p]));
  const byOwner = new Map<string, Target[]>();
  const staff: Target[] = [];
  for (const s of subs ?? []) {
    const pr = roleOf.get(s.user_id);
    const t: Target = { id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth };
    if (pr?.role === "staff") staff.push(t);
    else if (pr?.role === "owner" && pr.owner_id) {
      byOwner.set(pr.owner_id, [...(byOwner.get(pr.owner_id) ?? []), t]);
    }
  }

  let sent = 0;
  const names: string[] = [];
  for (const c of due) {
    const pat = c.patient as unknown as { name: string; owner_id: string } | null;
    names.push(pat?.name ?? "-");
    if (pushConfigured) {
      sent += await deliver(supabase, byOwner.get(pat?.owner_id ?? "") ?? [], {
        title: `${pat?.name ?? "반려동물"} 재검 시기예요`,
        body: c.recheck_note ?? "지난 검진에서 안내드린 재검 시기입니다.",
        url: `/portal/patients/${c.patient_id}/checkups/${c.id}`,
      });
    }
    // 알림을 못 보냈어도(구독 없음·키 없음) 찍는다. 안 찍으면 매일 다시 시도한다.
    await supabase.from("checkup").update({ recheck_notified_at: new Date().toISOString() }).eq("id", c.id);
  }

  // 우리 직원에게는 한 번만 — 전화를 걸어야 하는 건 사람이다
  if (pushConfigured && staff.length) {
    sent += await deliver(supabase, staff, {
      title: `재검 예정 ${due.length}건`,
      body: names.slice(0, 3).join(", ") + (names.length > 3 ? ` 외 ${names.length - 3}` : ""),
      url: "/today",
    });
  }

  return NextResponse.json({ today, due: due.length, sent });
}
