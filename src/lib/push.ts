import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * 웹 푸시 — 보호자 알림 채널.
 *
 * 문자·알림톡 대신 이걸 쓰는 이유: 발신번호도 사업자 등록도 건당 요금도 없고,
 * 보호자 앱이 이미 PWA다. 대신 **보호자가 홈 화면에 설치하고 알림을 켜야** 도착한다
 * (iOS 는 설치가 필수). 그래서 설치 안내 = 알림 설정이고, 그 전환율이 곧 도달률이다.
 *
 * 알림에는 **환자 이름과 "리포트가 왔다"까지만** 넣는다. 잠금화면은 누구나 본다 —
 * 진단명이나 상태를 밀어 넣으면 그게 곧 유출이다.
 */

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@sdamc.co.kr";

export const pushConfigured = Boolean(PUBLIC && PRIVATE);
if (pushConfigured) webpush.setVapidDetails(SUBJECT, PUBLIC!, PRIVATE!);

export type PushPayload = { title: string; body: string; url: string };

/**
 * 한 환자의 보호자에게 보낸다. 알림 실패가 리포트 발송을 막지 않는다 —
 * 기록은 이미 남았고, 못 받은 알림 때문에 저장을 되돌리는 게 더 나쁘다.
 */
export async function notifyOwner(
  supabase: SupabaseClient<Database>,
  patientId: string,
  payload: PushPayload
): Promise<number> {
  return send(supabase, "push_targets_for_patient", patientId, payload);
}

/**
 * 의뢰한 1차 병원 원장에게. 원장이 매일 우리 사이트에 들어와서 확인할 리가 없다 —
 * 화면을 아무리 잘 만들어도 안 들어오면 0이다. 밀어야 다음 의뢰가 온다.
 */
export async function notifyReferringVet(
  supabase: SupabaseClient<Database>,
  patientId: string,
  payload: PushPayload
): Promise<number> {
  return send(supabase, "push_targets_for_hospital", patientId, payload);
}

/**
 * 우리 병원 직원에게. 병동 입력을 끝낸 사람과 보호자에게 내보낼지 정하는 사람이 다르므로,
 * "발송 준비됐다"를 알려 줘야 판단 단계가 실제로 돌아간다.
 */
export async function notifyStaff(
  supabase: SupabaseClient<Database>,
  payload: PushPayload
): Promise<number> {
  if (!pushConfigured) return 0;
  const { data: targets } = await supabase.rpc("push_targets_staff");
  return deliver(supabase, targets ?? [], payload);
}

async function send(
  supabase: SupabaseClient<Database>,
  fn: "push_targets_for_patient" | "push_targets_for_hospital",
  patientId: string,
  payload: PushPayload
): Promise<number> {
  if (!pushConfigured) return 0;
  const { data: targets } = await supabase.rpc(fn, { p_patient_id: patientId });
  return deliver(supabase, targets ?? [], payload);
}

export type Target = { id: string; endpoint: string; p256dh: string; auth: string };

export async function deliver(
  supabase: SupabaseClient<Database>,
  targets: Target[],
  payload: PushPayload
): Promise<number> {
  if (!targets.length) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          body
        );
        sent += 1;
      } catch (e) {
        // 410/404 는 그 기기의 구독이 끝난 것. 다음부터 시도하지 않게 표시한다.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await supabase.rpc("mark_push_failed", { p_id: t.id });
        }
      }
    })
  );
  return sent;
}
