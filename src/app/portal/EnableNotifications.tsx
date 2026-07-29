"use client";
import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "./push-actions";

type State = "loading" | "unsupported" | "needs-install" | "off" | "on" | "denied";

/** VAPID 공개키(base64url) → Uint8Array */
function toKey(base64: string): ArrayBuffer {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as { standalone?: boolean }).standalone === true;

/**
 * 알림 켜기.
 *
 * 발신번호 없이 보호자에게 밀어 넣을 수 있는 유일한 경로다. 단 조건이 둘 있다:
 * 브라우저 권한, 그리고 **iOS 는 홈 화면에 추가된 상태**여야 한다는 것.
 * 안 되는 이유를 뭉뚱그리면 보호자는 그냥 포기하므로, 상태마다 다른 안내를 준다.
 */
export function EnableNotifications() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      // iOS 는 홈 화면에 추가하기 전까지 PushManager 자체가 없다 — 설치하면 생긴다
      setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [key]);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toKey(key!),
        }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      setState(r.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  return (
    <div className="portal-card push-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ fontSize: 20 }}>🔔</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: ".95rem" }}>
            {state === "on" ? "알림을 받고 있어요" : "새 리포트 알림 받기"}
          </div>
          <p className="portal-tile-sub" style={{ margin: "2px 0 0" }}>
            {state === "on" && "리포트가 도착하면 바로 알려드려요."}
            {state === "off" && "진료·입원 리포트가 도착하면 바로 알려드려요."}
            {state === "denied" && "브라우저 설정에서 이 사이트의 알림을 허용해 주세요."}
            {state === "needs-install" && "먼저 공유 → 홈 화면에 추가를 해주세요. 그다음 알림을 켤 수 있어요."}
          </p>
        </div>
        {state === "off" && (
          <button className="btn btn-primary btn-sm" onClick={enable} disabled={busy}>
            {busy ? "…" : "켜기"}
          </button>
        )}
        {state === "on" && (
          <button className="btn btn-ghost btn-sm" onClick={disable} disabled={busy}>
            끄기
          </button>
        )}
      </div>
    </div>
  );
}
